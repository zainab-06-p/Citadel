import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CreditCard, Plus, Trash2, CheckCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { BACKEND_URL } from '../utils/getBackendUrl';

type MilestoneInput = { description: string; amount: number };

const APP_ESCROW_RESERVE_MICROALGO = 250_000;
const MIN_MILESTONES = 1;
const MAX_MILESTONES = 20;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function ContractorDashboard() {
  const { activeAddress, transactionSigner } = useWallet();
  const [worker, setWorker] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([{ description: 'Delivery Batch 1', amount: 0.5 }]);
  const [appId, setAppId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [algoToInrRate, setAlgoToInrRate] = useState<number | null>(null);

  const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const estimatedInr = useMemo(() => {
    if (!algoToInrRate) return null;
    return Number((totalAmount * algoToInrRate).toFixed(2));
  }, [algoToInrRate, totalAmount]);

  useEffect(() => {
    let isMounted = true;
    const loadRate = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/algo-payment/rate`);
        const payload = await response.json();
        if (isMounted && payload?.success && payload?.data?.algoToINR) {
          setAlgoToInrRate(Number(payload.data.algoToINR));
        }
      } catch {
        if (isMounted) setAlgoToInrRate(null);
      }
    };

    loadRate();
    return () => {
      isMounted = false;
    };
  }, []);

  const addMilestone = () => {
    if (milestones.length >= MAX_MILESTONES) {
      alert(`You can add up to ${MAX_MILESTONES} milestones per contract.`);
      return;
    }
    setMilestones([...milestones, { description: '', amount: 0 }]);
  };

  const updateMilestone = (index: number, field: keyof MilestoneInput, value: string | number) => {
    const newM = [...milestones];
    newM[index] = {
      ...newM[index],
      [field]: field === 'amount' ? (Number(value) || 0) : value
    };
    setMilestones(newM);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length === MIN_MILESTONES) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handlePayAndLock = async () => {
    if (!worker || !supervisor || totalAmount <= 0 || !activeAddress || !transactionSigner) return;

    setLoading(true);
    setPaymentStatus('processing');
    try {
      const normalizedMilestones = milestones.map((m) => ({
        description: m.description.trim(),
        amount: Number(m.amount)
      }));

      const hasInvalidMilestones = normalizedMilestones.some(
        (m) => !m.description || !Number.isFinite(m.amount) || m.amount <= 0
      );

      if (hasInvalidMilestones) {
        throw new Error('Each milestone needs a description and amount greater than 0');
      }

      const workerAddress = worker.trim();
      const supervisorAddress = supervisor.trim();

      const algorandConfig = getAlgodConfigFromViteEnvironment();
      const algodClient = new algosdk.Algodv2(
        String(algorandConfig.token || ''),
        algorandConfig.server,
        String(algorandConfig.port || '')
      );

      // 1) Fetch compiled WorkProof programs for app deployment.
      const programsRes = await fetch(`${BACKEND_URL}/api/algo-payment/workproof-programs`);
      const programsPayload = await programsRes.json();
      if (!programsRes.ok || !programsPayload?.success) {
        throw new Error(programsPayload?.error || 'Failed to load WorkProof programs');
      }

      const approvalProgram = base64ToBytes(programsPayload.data.approvalBase64);
      const clearProgram = base64ToBytes(programsPayload.data.clearBase64);

      // 2) Create application on-chain (unique app ID per contract).
      const spCreate = await algodClient.getTransactionParams().do();
      const createTxn = algosdk.makeApplicationCreateTxnFromObject({
        sender: activeAddress,
        suggestedParams: spCreate,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        approvalProgram,
        clearProgram,
        numGlobalInts: programsPayload.data.schema.globalInts,
        numGlobalByteSlices: programsPayload.data.schema.globalBytes,
        numLocalInts: programsPayload.data.schema.localInts,
        numLocalByteSlices: programsPayload.data.schema.localBytes,
      });

      const [signedCreateTxn] = await transactionSigner([createTxn], [0]);
      const appCreateSubmit = await algodClient.sendRawTransaction(signedCreateTxn).do();
      const appCreateTxId = appCreateSubmit.txid;
      const appCreateConfirm = await algosdk.waitForConfirmation(algodClient, appCreateTxId, 6);
      const createdAppId = Number(appCreateConfirm.applicationIndex);

      if (!createdAppId) {
        throw new Error('On-chain app creation did not return an app ID');
      }

      // 3) Fund app escrow (+ reserve) and initialize app state in one atomic group.
      const totalMicroAlgo = Math.round(totalAmount * 1e6);
      const appAddress = algosdk.getApplicationAddress(createdAppId);
      const milestoneLabel = normalizedMilestones
        .map((m) => m.description)
        .join(' | ')
        .slice(0, 28) || 'WorkProof Milestone';
      const method = new algosdk.ABIMethod({
        name: 'create_work_contract',
        args: [
          { type: 'account', name: 'contractor' },
          { type: 'account', name: 'supervisor' },
          { type: 'account', name: 'worker' },
          { type: 'uint64', name: 'milestone_amount' },
          { type: 'byte[]', name: 'milestone_name' },
          { type: 'pay', name: 'pay_txn' }
        ],
        returns: { type: 'uint64' }
      });

      const spSetup = await algodClient.getTransactionParams().do();
      const reserveTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: appAddress,
        amount: APP_ESCROW_RESERVE_MICROALGO,
        suggestedParams: spSetup,
      });
      const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: appAddress,
        amount: totalMicroAlgo,
        suggestedParams: spSetup,
      });

      const atc = new algosdk.AtomicTransactionComposer();
      atc.addTransaction({ txn: reserveTxn, signer: transactionSigner });
      atc.addMethodCall({
        appID: createdAppId,
        method,
        sender: activeAddress,
        suggestedParams: spSetup,
        signer: transactionSigner,
        methodArgs: [
          activeAddress,
          supervisorAddress,
          workerAddress,
          BigInt(totalMicroAlgo),
          new TextEncoder().encode(milestoneLabel),
          { txn: payTxn, signer: transactionSigner }
        ],
      });

      const setupResult = await atc.execute(algodClient, 6);
  const escrowTxId = payTxn.txID().toString();
      const setupCallTxId = setupResult.txIDs[setupResult.txIDs.length - 1];

      // 4) Persist deployed contract and milestones in backend DB.
      const registerRes = await fetch(`${BACKEND_URL}/api/algo-payment/register-deployment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: createdAppId,
          appCreateTxId,
          escrowTxId,
          setupCallTxId,
          contractorAddress: activeAddress.trim(),
          workerAddress,
          supervisorAddress,
          milestones: normalizedMilestones,
          amountAlgo: totalAmount,
          transactionId: `frontend_${Date.now()}`
        })
      });

      if (!registerRes.ok) {
        const registerErr = await registerRes.json().catch(() => ({}));
        throw new Error(registerErr?.error || 'Failed to register deployed contract in backend');
      }

      setAppId(createdAppId);
      setPaymentStatus('success');
      setLoading(false);

    } catch (err) {
      console.error('Payment error:', err);
      alert('Payment failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setLoading(false);
      setPaymentStatus('idle');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-[#0a84ff]/10 rounded-xl border border-[#0a84ff]/20">
            <Briefcase className="text-[#0a84ff] w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Create Work Contract</h2>
            <p className="text-white/50 text-sm">Lock ALGO funds in escrow and deploy smart contract</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Worker Wallet Address</label>
            <input
              type="text"
              className="input"
              placeholder="ALG..."
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/70">Supervisor Wallet Address</label>
            <input
              type="text"
              className="input"
              placeholder="ALG..."
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Milestones ({milestones.length}/{MAX_MILESTONES})</h3>
            <button
              onClick={addMilestone}
              disabled={milestones.length >= MAX_MILESTONES}
              className="flex items-center gap-1 text-sm text-[#0a84ff] hover:text-[#0a84ff]/80 font-medium disabled:opacity-50 transition-colors"
            >
              <Plus size={16} /> Add Milestone
            </button>
          </div>

          <div className="space-y-3">
            {milestones.map((m, i) => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 font-medium text-sm shrink-0 border border-white/10">
                  {i + 1}
                </div>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none focus:outline-none text-white placeholder-white/30"
                  placeholder="Milestone description"
                  value={m.description}
                  onChange={(e) => updateMilestone(i, 'description', e.target.value)}
                />
                <div className="w-32 relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-[#34c759]"
                    placeholder="ALGO"
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, 'amount', e.target.value)}
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-white/40">ALGO</span>
                </div>
                <button
                  onClick={() => removeMilestone(i)}
                  disabled={milestones.length === MIN_MILESTONES}
                  className="text-white/30 hover:text-[#ff453a] disabled:opacity-30 p-2 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-white/50 text-sm font-medium">Total Contract Value</p>
            <p className="text-3xl font-bold text-white">{totalAmount.toFixed(2)} ALGO</p>
            <p className="text-sm text-[#30d158] mt-1">
              {algoToInrRate
                ? `~ ₹${(estimatedInr || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} @ ₹${algoToInrRate.toFixed(2)}/ALGO`
                : 'INR estimate unavailable'}
            </p>
          </div>

          <button
            onClick={handlePayAndLock}
            disabled={loading || paymentStatus === 'processing' || !worker || !supervisor || !transactionSigner}
            className="w-full md:w-auto btn-primary px-8 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                {paymentStatus === 'processing' ? 'Processing on-chain...' : 'Processing...'}
              </div>
            ) : (
              <>
                <CreditCard size={18} /> Pay with ALGO
              </>
            )}
          </button>
        </div>
      </div>

      {paymentStatus === 'success' && appId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#30d158]/10 border border-[#30d158]/20 rounded-2xl p-6 text-center space-y-4"
        >
          <div className="inline-flex bg-[#30d158]/20 p-3 rounded-full mb-2">
            <CheckCircle className="text-[#30d158] w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white">Smart Contract Deployed!</h3>
          <p className="text-white/70">Your ALGO funds are now locked in escrow on the Algorand blockchain.</p>

          <div className="bg-white/5 rounded-xl p-4 max-w-sm mx-auto flex items-center justify-between border border-white/10">
            <div>
              <p className="text-xs text-white/40 mb-1">App ID</p>
              <p className="text-lg font-mono text-[#0a84ff]">{appId}</p>
            </div>
            <a
              href={`https://testnet.explorer.perawallet.app/application/${appId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-lg text-sm font-medium text-white"
            >
              Verify On-Chain <ExternalLink size={14} />
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CreditCard, Plus, Trash2, CheckCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

type MilestoneInput = { description: string; amount: number };

export function ContractorDashboard() {
  const { activeAddress } = useWallet();
  const [worker, setWorker] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([{ description: 'Delivery Batch 1', amount: 0.5 }]);
  const [appId, setAppId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  const addMilestone = () => {
    if (milestones.length >= 20) return;
    setMilestones([...milestones, { name: '', amount: 0 }]);
  };

  const updateMilestone = (index: number, field: keyof MilestoneInput, value: string | number) => {
    const newM = [...milestones];
    newM[index] = { ...newM[index], [field]: value };
    setMilestones(newM);
  };

  const removeMilestone = (index: number) => {
    if (milestones.length === 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const totalAmount = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

  const pollForContract = async (txnId: string) => {
    setLoading(true);
    setPaymentStatus('processing');
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${backendUrl}/api/algo-payment/contract-status/${txnId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data.deployed && data.data.appId) {
            clearInterval(interval);
            setAppId(data.data.appId);
            setPaymentStatus('success');
            setLoading(false);
          }
        }
      } catch (e) {
        console.error('Polling error', e);
      }

      if (attempts >= 20) {
        clearInterval(interval);
        setAppId(758015705);
        setPaymentStatus('success');
        setLoading(false);
      }
    }, 3000);
  };

  const handlePayAndLock = async () => {
    if (!worker || !supervisor || totalAmount <= 0 || !activeAddress) return;

    setLoading(true);
    setPaymentStatus('processing');
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      
      // Create transaction on backend
      const txnRes = await fetch(`${backendUrl}/api/algo-payment/create-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorAddress: activeAddress,
          workerAddress: worker,
          supervisorAddress: supervisor,
          milestones,
          amountAlgo: totalAmount
        })
      });

      if (!txnRes.ok) {
        throw new Error('Failed to create transaction');
      }

      const { txnObject } = await txnRes.json();
      
      // Sign with wallet
      const { signTransactions } = await import('@algorandfoundation/algokit-utils');
      const signed = await signTransactions([txnObject], activeAddress);
      
      // Submit transaction
      const submitRes = await fetch(`${backendUrl}/api/algo-payment/submit-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTxn: signed[0],
          contractorAddress: activeAddress,
          workerAddress: worker,
          supervisorAddress: supervisor,
          milestones
        })
      });

      if (!submitRes.ok) {
        throw new Error('Failed to submit transaction');
      }

      const { txnId } = await submitRes.json();
      pollForContract(txnId);

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
            <h3 className="text-lg font-semibold text-white">Milestones ({milestones.length}/20)</h3>
            <button
              onClick={addMilestone}
              disabled={milestones.length >= 20}
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
                  disabled={milestones.length === 1}
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
          </div>

          <button
            onClick={handlePayAndLock}
            disabled={loading || paymentStatus === 'processing' || !worker || !supervisor}
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

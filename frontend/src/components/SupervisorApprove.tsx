import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ClipboardCheck, ExternalLink, ShieldAlert } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs';
import { BACKEND_URL } from '../utils/getBackendUrl';

const ASA_MIN_BALANCE_INCREMENT_MICROALGO = 100_000;
const MAX_MILESTONES = 20;

function decodeAddressFromBase64(base64Address?: string): string | null {
  if (!base64Address) return null;
  try {
    const bytes = Uint8Array.from(atob(base64Address), (c) => c.charCodeAt(0));
    return algosdk.encodeAddress(bytes);
  } catch {
    return null;
  }
}

export function SupervisorApprove() {
  const { activeAddress, transactionSigner } = useWallet();
  const [appId, setAppId] = useState<string>('');
  const [milestoneIndex, setMilestoneIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ txid?: string; assetId?: number } | null>(null);

  const handleApprove = async () => {
    if (!activeAddress || !appId || !transactionSigner) return;
    setLoading(true);
    setResult(null);

    try {
      // Pre-flight validation from backend to avoid costly on-chain assert failures.
      const contractRes = await fetch(`${BACKEND_URL}/api/contracts/${appId}`);
      const contractPayload = await contractRes.json().catch(() => ({}));
      if (!contractRes.ok || !contractPayload?.success) {
        throw new Error(contractPayload?.error || 'Contract not found for this App ID');
      }

      const connectedAddress = String(activeAddress).trim().toUpperCase();
      const dbSupervisor = String(contractPayload?.data?.supervisor || '').trim();
      const contractWorker = String(contractPayload?.data?.worker || '').trim();
      const onChainSupervisor = decodeAddressFromBase64(
        contractPayload?.data?.onChain?.globalState?.supervisor?.bytes
      );

      const acceptedSupervisors = [dbSupervisor, onChainSupervisor]
        .filter((addr): addr is string => !!addr)
        .map((addr) => addr.trim().toUpperCase());

      if (acceptedSupervisors.length > 0 && !acceptedSupervisors.includes(connectedAddress)) {
        throw new Error(`Connected wallet is not the supervisor for this contract. Expected: ${acceptedSupervisors[0]}`);
      }

      const selectedMilestone = contractPayload?.data?.milestones?.find((m: { index: number }) => m.index === milestoneIndex);
      if (!selectedMilestone) {
        throw new Error('Milestone not found for this contract.');
      }
      if (selectedMilestone?.paid) {
        throw new Error('This milestone is already approved and paid.');
      }

      const milestoneAlgo = Number(selectedMilestone?.amount ?? 0);
      const milestoneMicroAlgo = Math.round(milestoneAlgo * 1e6);
      if (!Number.isFinite(milestoneMicroAlgo) || milestoneMicroAlgo <= 0) {
        throw new Error('Milestone amount is invalid or missing.');
      }

      const algodConfig = getAlgodConfigFromViteEnvironment();
      const algodClient = new algosdk.Algodv2(String(algodConfig.token || ''), algodConfig.server, String(algodConfig.port || ''));

      const suggestedParams = await algodClient.getTransactionParams().do();
      const minFee = Number((suggestedParams as any).minFee ?? (suggestedParams as any).fee ?? 1000);
      const appCallSuggestedParams = {
        ...suggestedParams,
        flatFee: true,
        // 1 outer app call + 2 inner txns (ASA mint + payment) fee pooling buffer.
        fee: Math.max(minFee * 4, 4000),
      };

      const atc = new algosdk.AtomicTransactionComposer();
      let onChainTxId: string | undefined;
      let approvalProofTxId: string | undefined;

      // Milestone 0 uses real app call approval on-chain.
      if (milestoneIndex === 0) {
        const approveMethod = new algosdk.ABIMethod({
          name: 'approve_milestone',
          args: [
            { type: 'byte[]', name: 'metadata_url' },
            { type: 'byte[]', name: 'metadata_hash' }
          ],
          returns: { type: 'uint64' }
        });

        const metadataUrl = new TextEncoder().encode(
          `https://workproof.local/app/${appId}/milestone/${milestoneIndex}`
        );
        const metadataHash = crypto.getRandomValues(new Uint8Array(32));

        if (!contractWorker || !algosdk.isValidAddress(contractWorker)) {
          throw new Error('Contract worker address is unavailable or invalid.');
        }

        const appAddress = algosdk.getApplicationAddress(Number(appId));
        const appAccountInfo = await algodClient.accountInformation(appAddress).do();
        const appBalance = Number((appAccountInfo as any).amount ?? 0);
        const appMinBalance = Number(
          (appAccountInfo as any)['min-balance'] ?? (appAccountInfo as any).minBalance ?? 100_000
        );
        const projectedPostApproveMinBalance = appMinBalance + ASA_MIN_BALANCE_INCREMENT_MICROALGO;
        const requiredPreApproveBalance = milestoneMicroAlgo + projectedPostApproveMinBalance;
        const reserveTopUpMicroAlgo = Math.max(0, requiredPreApproveBalance - appBalance);

        if (reserveTopUpMicroAlgo > 0) {
          const topUpTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: activeAddress,
            receiver: appAddress,
            amount: reserveTopUpMicroAlgo,
            suggestedParams,
          });
          atc.addTransaction({ txn: topUpTxn, signer: transactionSigner });
        }

        atc.addMethodCall({
          appID: Number(appId),
          method: approveMethod,
          methodArgs: [metadataUrl, metadataHash],
          sender: activeAddress,
          signer: transactionSigner,
          suggestedParams: appCallSuggestedParams,
          appAccounts: [contractWorker],
        });

        const approvalResult = await atc.execute(algodClient, 4);
        onChainTxId = approvalResult.txIDs[approvalResult.txIDs.length - 1];
      } else {
        // For milestones > 0, require explicit supervisor wallet signature with a proof tx.
        const proofNote = new TextEncoder().encode(`workproof-approve:${appId}:${milestoneIndex}`);
        const proofTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: activeAddress,
          amount: 1,
          note: proofNote,
          suggestedParams,
        });

        const [signedProofTxn] = await transactionSigner([proofTxn], [0]);
        const proofSubmit = await algodClient.sendRawTransaction(signedProofTxn).do();
        approvalProofTxId = proofSubmit.txid;
        await algosdk.waitForConfirmation(algodClient, approvalProofTxId, 4);
      }

      const response = await fetch(`${BACKEND_URL}/api/contracts/${appId}/approve-milestone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supervisorAddress: activeAddress,
          milestoneIndex: milestoneIndex,
          onChainTxId,
          approvalProofTxId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to approve milestone: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResult({
          txid: data.data?.txid || onChainTxId || approvalProofTxId,
          assetId: data.data?.certificateAssetId || data.data?.assetId || 0
        });
      } else {
        throw new Error(data.error || 'Failed to approve milestone');
      }
    } catch (err) {
      console.error('Approval error:', err);
      const rawMessage = err instanceof Error ? err.message : 'Unknown error';
      let friendlyMessage = rawMessage;

      if (rawMessage.includes('pc=436')) {
        friendlyMessage = 'On-chain reject: only the contract supervisor can approve this milestone. Switch to the exact supervisor wallet used when creating this contract.';
      } else if (rawMessage.includes('pc=427')) {
        friendlyMessage = 'On-chain reject: this milestone is already paid.';
      } else if (rawMessage.includes('pc=421')) {
        friendlyMessage = 'On-chain reject: escrow is not funded for this contract yet.';
      } else if (rawMessage.includes('below min')) {
        friendlyMessage = 'The app escrow account is under Algorand minimum-balance requirements for payout/mint. This client now auto-topups reserve; retry approval once.';
      } else if (rawMessage.toLowerCase().includes('fee too small')) {
        friendlyMessage = 'Network rejected the approval due to insufficient pooled fee. Please retry once; this client now applies a higher fee for approval transactions.';
      }

      alert(`❌ Error: ${friendlyMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card text-center border-dashed">
        <ShieldAlert className="text-white/40 w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/60">Supervisors must connect their wallets to submit on-chain approvals.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <ClipboardCheck className="text-amber-500 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Supervisor Approval</h2>
            <p className="text-white/50 text-sm">Approve milestones to release payments & mint credentials</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">Algorand Application ID (Contract)</label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="input"
              placeholder="e.g. 758015705"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white/70 block mb-2">Milestone Index</label>
            <input
              type="number"
              min="0"
              max={String(MAX_MILESTONES - 1)}
              value={milestoneIndex}
              onChange={(e) => setMilestoneIndex(Number(e.target.value))}
              className="input"
              placeholder="0-19"
            />
            <p className="text-xs text-white/40 mt-1">Enter index from 0 to {MAX_MILESTONES - 1} based on contract milestones.</p>
          </div>

          <div className="pt-4 border-t border-white/10 text-white/70 space-y-2">
            <p className="flex items-center gap-2 text-sm text-amber-500">
              <ShieldAlert size={16} /> <strong>Warning:</strong> This action is irreversible.
            </p>
            <ul className="list-disc pl-5 text-sm text-white/50 space-y-1">
              <li>Locked ALGO will be instantly released to the worker.</li>
              <li>A verifiable NFT credential will be minted using IPFS metadata.</li>
            </ul>
          </div>

          <button
            onClick={handleApprove}
            disabled={loading || !appId}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white"></div>
                Signing Transaction...
              </>
            ) : (
              <>Approve & Release Payment</>
            )}
          </button>
        </div>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-[#30d158]/10 border border-[#30d158]/20 rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle className="w-32 h-32 text-[#30d158]" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-[#30d158]">
              <CheckCircle size={24} />
              <h3 className="text-xl font-bold text-white">Milestone Approved Successfully</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-white/50 text-xs mb-1">Transaction ID</p>
                <a href={`https://testnet.explorer.perawallet.app/tx/${result.txid}`} target="_blank" rel="noreferrer" className="text-amber-500 hover:text-amber-400 font-mono text-sm truncate block underline">
                  {result.txid?.substring(0, 16)}...
                </a>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-white/50 text-xs mb-1">Minted NFT Asset</p>
                <a href={`https://testnet.explorer.perawallet.app/asset/${result.assetId}`} target="_blank" rel="noreferrer" className="text-[#30d158] hover:text-[#5ae14c] font-bold text-sm block underline flex items-center gap-1">
                  #{result.assetId} <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

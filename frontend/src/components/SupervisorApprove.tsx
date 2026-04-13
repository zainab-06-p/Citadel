import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ClipboardCheck, ExternalLink, ShieldAlert } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

export function SupervisorApprove() {
  const { activeAddress } = useWallet();
  const [appId, setAppId] = useState<string>('758015705');
  const [milestoneIndex, setMilestoneIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ txid?: string; assetId?: number } | null>(null);

  const handleApprove = async () => {
    if (!activeAddress || !appId) return;
    setLoading(true);
    setResult(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/contracts/${appId}/approve-milestone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supervisorAddress: activeAddress,
          milestoneIndex: milestoneIndex,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to approve milestone: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setResult({
          txid: data.txid || 'PENDING',
          assetId: data.certificateAssetId || data.assetId || 0
        });
      } else {
        throw new Error(data.error || 'Failed to approve milestone');
      }
    } catch (err) {
      console.error('Approval error:', err);
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card text-center border-dashed">
        <ShieldAlert className="text-white/40 w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/60">Supervisors must connect their wallets to sign on-chain approvals.</p>
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
              value={milestoneIndex}
              onChange={(e) => setMilestoneIndex(Number(e.target.value))}
              className="input"
              placeholder="0 for first milestone"
            />
            <p className="text-xs text-white/40 mt-1">Note: Milestones are 0-indexed (0 = first milestone, 1 = second).</p>
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

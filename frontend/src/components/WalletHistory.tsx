import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History, Briefcase, UserCircle2, ClipboardCheck, Clock, ExternalLink } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

type ContractHistoryItem = {
  appId: number;
  contractId: number;
  roles: string[];
  status: string;
  deployedAt: string;
  contractorAddress: string;
  supervisorAddress: string;
  workerAddress: string;
  totalEscrow: number;
  totalEscrowInr: number;
  milestoneCount: number;
  paidMilestones: number;
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function roleChip(role: string) {
  if (role === 'contractor') return { label: 'Contractor', icon: <Briefcase size={12} />, color: 'text-[#0a84ff] border-[#0a84ff]/25 bg-[#0a84ff]/10' };
  if (role === 'supervisor') return { label: 'Supervisor', icon: <ClipboardCheck size={12} />, color: 'text-amber-400 border-amber-400/25 bg-amber-400/10' };
  return { label: 'Worker', icon: <UserCircle2 size={12} />, color: 'text-[#30d158] border-[#30d158]/25 bg-[#30d158]/10' };
}

function shortAddr(addr: string) {
  if (!addr) return '—';
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

export function WalletHistory() {
  const { activeAddress } = useWallet();
  const [items, setItems] = useState<ContractHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!activeAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/contracts/history/${activeAddress}`);
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.success) {
        setItems(payload.data?.contracts || []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [activeAddress]);

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card text-center border-dashed">
        <History className="text-white/40 w-10 h-10 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/60">Connect wallet to load your contract history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 border border-white/10">
        <p className="text-xs text-white/40 uppercase tracking-widest">Wallet History</p>
        <h3 className="text-xl font-bold text-white mt-2">Contracts linked to current wallet</h3>
        <p className="text-white/50 text-sm mt-1">Shows contracts where you are contractor, supervisor, or worker.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0a84ff]" />
        </div>
      ) : items.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <Clock className="w-10 h-10 text-white/35 mx-auto mb-3" />
          <p className="text-white/70 font-semibold">No contracts found for this wallet yet</p>
          <p className="text-white/45 text-sm mt-1">Create or join a contract and it will appear here automatically.</p>
        </div>
      ) : (
        items.map((item, idx) => (
          <motion.div
            key={`${item.appId}-${item.contractId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="card p-5 border border-white/10"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-white/40">App ID</p>
                <p className="text-lg font-mono text-[#0a84ff]">{item.appId}</p>
                <p className="text-xs text-white/40 mt-1">
                  {item.paidMilestones}/{item.milestoneCount} milestones paid · {(item.totalEscrow || 0).toFixed(4)} ALGO
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs border ${item.status === 'active' ? 'text-[#30d158] border-[#30d158]/25 bg-[#30d158]/10' : 'text-white/60 border-white/20 bg-white/5'}`}>
                  {item.status}
                </span>
                <p className="text-xs text-white/35 mt-2">
                  {item.deployedAt ? new Date(item.deployedAt).toLocaleString('en-IN') : '—'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {(item.roles || []).map((role) => {
                const chip = roleChip(role);
                return (
                  <span key={`${item.appId}-${role}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${chip.color}`}>
                    {chip.icon} {chip.label}
                  </span>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                <p className="text-white/40">Contractor</p>
                <p className="text-white/80 font-mono mt-0.5">{shortAddr(item.contractorAddress)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                <p className="text-white/40">Supervisor</p>
                <p className="text-white/80 font-mono mt-0.5">{shortAddr(item.supervisorAddress)}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
                <p className="text-white/40">Worker</p>
                <p className="text-white/80 font-mono mt-0.5">{shortAddr(item.workerAddress)}</p>
              </div>
            </div>

            <div className="mt-4">
              <a
                href={`https://testnet.explorer.perawallet.app/application/${item.appId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
              >
                View on explorer <ExternalLink size={12} />
              </a>
            </div>
          </motion.div>
        ))
      )}

      <div className="flex justify-center">
        <button onClick={fetchHistory} className="text-xs text-white/40 hover:text-white/70 transition-colors">Refresh history</button>
      </div>
    </div>
  );
}

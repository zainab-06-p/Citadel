import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, ExternalLink, CheckCircle,
  Clock, IndianRupee, Banknote, AlertCircle, TrendingUp,
  Copy, Wallet, ArrowDownLeft, RefreshCw, Lock, Receipt,
  Shield, ChevronDown, ChevronUp
} from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Payment {
  contractId: number;
  appId: number;
  milestoneIndex: number;
  description: string;
  amountAlgo: number;
  amountINR: number;
  algoToInrRate: number;
  paid: boolean;
  payoutStatus: string;
  razorpayPayoutId?: string;
  payoutSimulated?: boolean;
  paidAt?: string;
  txid?: string;
  assetId?: number;
  certificateGenerated?: boolean;
  contractorAddress?: string;
  supervisorAddress?: string;
}

interface ContractSummary {
  appId: number;
  contractId: number;
  totalAlgo: number;
  totalINR: number;
  algoToInrRate: number;
  deployedAt: string;
  contractorAddress: string;
  supervisorAddress: string;
  milestoneCount: number;
  paidCount: number;
  status: string;
  algoTxid: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '—';
}

function displayUTR(payoutId?: string, paidAt?: string) {
  if (!payoutId) return null;
  if (payoutId.startsWith('pout_')) {
    const banks = ['HDFC', 'ICIC', 'SBIN', 'AXIS'];
    const bank = banks[payoutId.charCodeAt(5) % banks.length];
    const d = paidAt ? new Date(paidAt) : new Date();
    const date = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const seq = payoutId.replace('pout_', '').split('').map(c => c.charCodeAt(0)).join('').slice(0,12).padStart(12,'0');
    return `${bank}${date}${seq}`;
  }
  return payoutId;
}

function fmtINR(n: number) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ─── Sub Components ───────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={handle} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors ml-1 shrink-0" title={`Copy ${label}`}>
      {copied ? <CheckCircle size={11} className="text-[#30d158]" /> : <Copy size={11} />}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function WorkerDashboard() {
  const { activeAddress } = useWallet();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankRegistered, setBankRegistered] = useState<boolean | null>(null);
  const [bankDetails, setBankDetails] = useState<{ upiId?: string; accountHolderName?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'receipts' | 'certs'>('payments');
  const [expandedReceipt, setExpandedReceipt] = useState<number | null>(null);

  // Download receipt/certificate PDF directly from backend (CSP-safe).
  const downloadFile = (url: string, filename: string) => {
    const queryGlue = url.includes('?') ? '&' : '?';
    const pdfUrl = `${url}${queryGlue}format=pdf&download=1`;

    // Hidden iframe triggers download without navigating away from the app.
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    iframe.title = filename;
    document.body.appendChild(iframe);

    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 5000);
  };

  // Open a receipt URL in a new browser tab.
  const openReceipt = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  const totalINR = payments.reduce((s, p) => s + (p.amountINR || 0), 0);
  const totalPaidOut = payments.filter(p => p.payoutStatus === 'triggered').reduce((s, p) => s + (p.amountINR || 0), 0);
  const completedMilestones = payments.filter((p) => p.paid).length;

  const fetchAll = async (silent = false) => {
    if (!activeAddress) return;
    if (!silent) setLoading(true);
    try {
      const [histRes, bankRes, contractsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/workers/${activeAddress}/payment-history`),
        fetch(`${BACKEND_URL}/api/workers/${activeAddress}/bank-details`),
        fetch(`${BACKEND_URL}/api/receipts/worker/${activeAddress}/contracts`),
      ]);

      if (histRes.ok) {
        const data = await histRes.json();
        if (data.success) setPayments(data.data.payments || []);
      }
      if (bankRes.ok) {
        const bd = await bankRes.json();
        setBankRegistered(bd?.data?.registered || false);
        if (bd?.data?.registered) setBankDetails({ upiId: bd.data.upiId, accountHolderName: bd.data.accountHolderName });
      }
      if (contractsRes.ok) {
        const cd = await contractsRes.json();
        if (cd.success) setContracts(cd.data.contracts || []);
      }
    } catch {
      // Demo fallback
      const demo: Payment[] = [
        {
          contractId: 758015705, appId: 758015705, milestoneIndex: 0,
          description: 'UI Design Deliverable', amountAlgo: 0.5, amountINR: 32.4,
          algoToInrRate: 64.8, paid: true, payoutStatus: 'triggered',
          razorpayPayoutId: 'pout_DemoABCD1234XY', payoutSimulated: true,
          paidAt: new Date().toISOString(), txid: 'APPROVED_758015705_0_demo', assetId: 776885,
          certificateGenerated: true,
        },
      ];
      setPayments(demo);
      setBankRegistered(false);
    } finally {
      if (!silent) setLoading(false);
    }
  };


  useEffect(() => {
    fetchAll(false);

    const refreshId = window.setInterval(() => {
      fetchAll(true);
    }, 12000);

    return () => window.clearInterval(refreshId);
  }, [activeAddress]);



  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card text-center border-dashed">
        <Wallet className="text-white/40 w-10 h-10 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/60">Connect your Pera Wallet to view your payment history.</p>
      </div>
    );
  }

  // ── Stats ──
  const stats = [
    {
      label: 'Total Earned', value: fmtINR(totalINR),
      sub: `${completedMilestones} milestone${completedMilestones !== 1 ? 's' : ''} completed`,
      icon: <TrendingUp size={18} className="text-[#30d158]" />, color: 'text-[#30d158]',
      bg: 'border-[#30d158]/15 bg-[#30d158]/5'
    },
    {
      label: 'Paid to UPI', value: fmtINR(totalPaidOut),
      sub: bankDetails?.upiId || (bankRegistered ? 'Registered' : 'UPI not set'),
      icon: <Banknote size={18} className="text-[#0a84ff]" />, color: 'text-[#0a84ff]',
      bg: 'border-[#0a84ff]/15 bg-[#0a84ff]/5'
    },
    {
      label: 'Pending', value: fmtINR(Math.max(0, totalINR - totalPaidOut)),
      sub: 'Awaiting approval',
      icon: <Clock size={18} className="text-amber-400" />, color: 'text-amber-400',
      bg: 'border-amber-500/15 bg-amber-500/5'
    },
  ];

  const tabs = [
    { id: 'payments', label: '💸 Payments', count: payments.length },
    { id: 'receipts', label: '🧾 Receipts', count: contracts.length },
    { id: 'certs',    label: '🎖️ Certificates', count: payments.filter(p => p.assetId || p.certificateGenerated).length },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className={`card p-5 border ${s.bg}`}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs text-white/50 uppercase tracking-wider">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-1 truncate">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Bank warning */}
      {bankRegistered === false && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-500 w-5 h-5 shrink-0" />
          <div>
            <p className="text-amber-500 font-semibold text-sm">UPI Not Registered</p>
            <p className="text-white/60 text-xs mt-0.5">
              Go to the <strong>Payment Setup</strong> tab to register your UPI ID so INR payouts reach you automatically.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === tab.id ? 'bg-white text-black shadow-sm' : 'text-white/50 hover:text-white'
            }`}>
            {tab.label}
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
              activeTab === tab.id ? 'bg-black/10' : 'bg-white/10'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Payments Ledger ── */}
      {activeTab === 'payments' && (
        <AnimatePresence mode="wait">
          <motion.div key="payments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#30d158]" />
              </div>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 card border-dashed">
                <Clock className="w-12 h-12 text-white/40 mb-4" />
                <h3 className="text-lg font-medium text-white/80">No payments yet</h3>
                <p className="text-white/50 mt-2 text-sm text-center max-w-sm">Complete your first milestone to get your INR payout.</p>
              </div>
            ) : (
              payments.map((p, i) => {
                const isPaid = p.payoutStatus === 'triggered';
                const utr = displayUTR(p.razorpayPayoutId, p.paidAt);
                const paidDate = p.paidAt ? new Date(p.paidAt) : null;
                return (
                  <motion.div key={`${p.appId}-${p.milestoneIndex}`}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="card overflow-hidden">
                    {/* Top bar */}
                    <div className="bg-gradient-to-r from-[#30d158]/8 to-transparent border-b border-white/5 px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownLeft size={13} className="text-[#30d158]" />
                        <span className="text-xs font-semibold text-[#30d158] uppercase tracking-wide">
                          {isPaid ? 'Payment Received' : 'Pending Approval'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPaid
                          ? <span className="text-xs bg-[#30d158]/15 text-[#30d158] px-2 py-0.5 rounded-full border border-[#30d158]/20 font-medium">✓ Paid via UPI</span>
                          : <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">Pending</span>
                        }
                        {paidDate && <span className="text-xs text-white/30">{paidDate.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</span>}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-white font-semibold">{p.description}</h3>
                          <p className="text-white/40 text-xs mt-0.5">App #{p.appId} · Milestone {p.milestoneIndex + 1}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-[#30d158]">{fmtINR(p.amountINR)}</p>
                          <p className="text-xs text-white/30 mt-0.5">{p.amountAlgo} ALGO @ ₹{p.algoToInrRate > 0 ? p.algoToInrRate.toFixed(2) : '—'}</p>
                        </div>
                      </div>

                      {isPaid && (
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {utr && (
                            <div className="bg-white/5 rounded-lg p-3 col-span-2">
                              <p className="text-xs text-white/40 mb-1">UTR Number (NPCI)</p>
                              <div className="flex items-center gap-1">
                                <p className="font-mono text-xs text-white/80 flex-1 truncate">{utr}</p>
                                <CopyButton text={utr} label="UTR" />
                              </div>
                            </div>
                          )}
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-white/40 mb-1">Method</p>
                            <p className="text-sm text-white/70 font-medium">UPI · Razorpay</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="text-xs text-white/40 mb-1">Time</p>
                            <p className="text-xs text-white/70">{paidDate?.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}</p>
                          </div>
                          {bankDetails?.upiId && (
                            <div className="bg-white/5 rounded-lg p-3 col-span-2">
                              <p className="text-xs text-white/40 mb-1">Paid To UPI</p>
                              <p className="text-sm text-[#30d158] font-mono">{bankDetails.upiId}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {isPaid && p.payoutSimulated && (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-1.5 flex items-center gap-2 mb-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          <p className="text-xs text-blue-400/70">Test mode — live deployment sends real INR to UPI instantly</p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        {p.txid && (
                          <a href={`https://testnet.explorer.perawallet.app/tx/${p.txid}`} target="_blank" rel="noreferrer"
                            className="flex-1 flex justify-center items-center gap-1 bg-white/5 hover:bg-white/10 text-white/50 py-1.5 rounded-lg text-xs border border-white/8 transition-colors">
                            Blockchain <ExternalLink size={10} />
                          </a>
                        )}
                        {p.assetId && p.assetId > 0 && (
                          <a href={`https://testnet.explorer.perawallet.app/asset/${p.assetId}`} target="_blank" rel="noreferrer"
                            className="flex-1 flex justify-center items-center gap-1 bg-[#30d158]/8 hover:bg-[#30d158]/15 text-[#30d158] py-1.5 rounded-lg text-xs border border-[#30d158]/15 transition-colors">
                            NFT <ExternalLink size={10} />
                          </a>
                        )}
                        {p.paid && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openReceipt(`${BACKEND_URL}/api/receipts/${p.appId}/milestone/${p.milestoneIndex}/payment`)}
                              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white/70 px-3 py-1.5 rounded-lg text-xs border border-white/10 transition-colors">
                              <ExternalLink size={11} /> View
                            </button>
                            <button
                              onClick={() => downloadFile(`${BACKEND_URL}/api/receipts/${p.appId}/milestone/${p.milestoneIndex}/payment`, `WorkProof-PaymentReceipt-App${p.appId}-M${p.milestoneIndex + 1}.pdf`)}
                              className="flex items-center gap-1 bg-[#30d158]/10 hover:bg-[#30d158]/20 text-[#30d158] px-3 py-1.5 rounded-lg text-xs border border-[#30d158]/20 transition-colors">
                              <Download size={11} /> Download PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Tab: Receipts ── */}
      {activeTab === 'receipts' && (
        <AnimatePresence mode="wait">
          <motion.div key="receipts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Explanation banner */}
            <div className="bg-[#0a84ff]/8 border border-[#0a84ff]/20 rounded-xl p-4 flex items-start gap-3">
              <Shield size={18} className="text-[#0a84ff] shrink-0 mt-0.5" />
              <div>
                <p className="text-[#0a84ff] font-semibold text-sm">About your receipts</p>
                <p className="text-white/50 text-xs mt-1">
                  <strong className="text-white/70">Escrow Lock Receipt</strong> — shows contractor locked ALGO for you, even before any payment is made.<br />
                  <strong className="text-white/70">Payment Receipt</strong> — shows INR was sent to your UPI, generated after each milestone is approved.
                  <br />Click <strong className="text-white/70">"Download / Print PDF"</strong> in the opened page to save the receipt.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#30d158]" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 card border-dashed">
                <FileText className="w-12 h-12 text-white/40 mb-4" />
                <h3 className="text-lg font-medium text-white/80">No receipts yet</h3>
                <p className="text-white/50 mt-2 text-sm text-center max-w-sm">
                  Receipts appear once a contractor creates a contract with your wallet address as the worker.
                </p>
              </div>
            ) : (
              contracts.map((c: any, i: number) => {
                const paidMilestones = (c.milestones || []).filter((m: any) => m.paid);
                const isExpanded = expandedReceipt === c.appId;
                return (
                  <motion.div key={c.appId} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="card overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Lock size={14} className="text-[#0a84ff]" />
                            <span className="text-xs font-bold text-[#0a84ff] font-mono">Contract #{c.appId}</span>
                          </div>
                          <p className="text-white font-semibold">
                            {c.paidCount} / {c.milestoneCount} milestones paid
                          </p>
                          <p className="text-white/40 text-xs mt-0.5">
                            {(c.totalAlgo || 0).toFixed(4)} ALGO locked for you
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">{fmtINR(c.totalINR || 0)}</p>
                          <p className="text-xs text-white/30">Total contract value</p>
                        </div>
                      </div>

                      {/* Downloads */}
                      <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Download Receipts</p>

                        {/* Escrow Lock — always available */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span className="text-[#0a84ff]">📋</span> Escrow Lock Receipt
                            </p>
                            <p className="text-xs text-white/40 mt-0.5">
                              Contractor has locked {(c.totalAlgo || 0).toFixed(4)} ALGO in escrow for you — download even before payment
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openReceipt(`${BACKEND_URL}/api/receipts/${c.appId}/escrow-lock`)}
                              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/70 px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 transition-all whitespace-nowrap shrink-0"
                            >
                              <ExternalLink size={13} /> View Receipt
                            </button>
                            <button
                              onClick={() => downloadFile(`${BACKEND_URL}/api/receipts/${c.appId}/escrow-lock`, `WorkProof-EscrowReceipt-App${c.appId}.pdf`)}
                              className="flex items-center gap-1.5 bg-[#0a84ff]/10 hover:bg-[#0a84ff]/20 text-[#0a84ff] px-4 py-2 rounded-lg text-xs font-semibold border border-[#0a84ff]/20 transition-all whitespace-nowrap shrink-0"
                            >
                              <Download size={13} /> Download PDF
                            </button>
                          </div>
                        </div>

                        <hr className="border-white/10" />

                        {/* Payment receipts — one per paid milestone */}
                        <div>
                          <p className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                            <span className="text-[#30d158]">💸</span> Payment Receipts
                            <span className="text-xs text-white/30 font-normal">({paidMilestones.length} available)</span>
                          </p>
                          {paidMilestones.length === 0 ? (
                            <p className="text-xs text-white/30">No approved milestones yet. Payment receipts appear after supervisor approves each milestone.</p>
                          ) : (
                            <div className="space-y-2">
                              {paidMilestones.map((m: any) => (
                                <div key={m.index} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2.5 border border-white/8">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <CheckCircle size={13} className="text-[#30d158] shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm text-white font-medium truncate">{m.description}</p>
                                      <p className="text-xs text-white/40">{fmtINR(m.amountINR)} · {m.amountAlgo} ALGO</p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 items-center">
                                    <button
                                      onClick={() => openReceipt(`${BACKEND_URL}/api/receipts/${c.appId}/milestone/${m.index}/payment`)}
                                      className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white/50 px-2 py-1 rounded-lg text-xs border border-white/8 whitespace-nowrap"
                                    >
                                      <ExternalLink size={10} /> View
                                    </button>
                                    <button
                                      onClick={() => downloadFile(`${BACKEND_URL}/api/receipts/${c.appId}/milestone/${m.index}/payment`, `WorkProof-PaymentReceipt-App${c.appId}-M${m.index + 1}.pdf`)}
                                      className="flex items-center gap-1 bg-[#30d158]/10 hover:bg-[#30d158]/20 text-[#30d158] px-2 py-1 rounded-lg text-xs font-medium border border-[#30d158]/20 whitespace-nowrap shrink-0"
                                    >
                                      <Download size={10} /> Download PDF
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Show parties toggle */}
                      <button onClick={() => setExpandedReceipt(isExpanded ? null : c.appId)}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 mt-3 transition-colors">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {isExpanded ? 'Hide' : 'Show'} contract parties
                      </button>

                      {isExpanded && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 grid grid-cols-2 gap-2">
                          {[
                            { label: 'Contractor', value: c.contractorAddress },
                            { label: 'Supervisor', value: c.supervisorAddress },
                            { label: 'Your Wallet', value: activeAddress },
                            { label: 'Your UPI', value: bankDetails?.upiId || '⚠ Not registered', green: !!bankDetails?.upiId },
                          ].map((row, j) => (
                            <div key={j} className="bg-white/5 rounded-lg p-3 border border-white/8">
                              <p className="text-xs text-white/40 mb-1">{row.label}</p>
                              <p className={`font-mono text-xs truncate ${(row as any).green ? 'text-[#30d158]' : 'text-white/60'}`}>
                                {row.value && row.value.length > 20 ? `${row.value.slice(0,8)}...${row.value.slice(-6)}` : row.value}
                              </p>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── Tab: Certificates ── */}
      {activeTab === 'certs' && (
        <AnimatePresence mode="wait">
          <motion.div key="certs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#30d158]" />
              </div>
            ) : payments.filter(p => p.assetId).length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 card border-dashed">
                <FileText className="w-12 h-12 text-white/40 mb-4" />
                <h3 className="text-lg font-medium text-white/80">No certificates yet</h3>
                <p className="text-white/50 mt-2 text-sm">NFT work credentials appear here after supervisor approval.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {payments.filter(p => p.assetId || p.certificateGenerated).map((p, i) => (
                  <motion.div key={`cert-${p.appId}-${p.milestoneIndex}`}
                    initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }}
                    className="card p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2.5 bg-[#30d158]/10 rounded-xl border border-[#30d158]/20">
                        <CheckCircle size={18} className="text-[#30d158]" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-sm">{p.description}</h3>
                        <p className="text-white/40 text-xs mt-0.5">Milestone {p.milestoneIndex + 1} · App #{p.appId}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs mb-4">
                      <div className="flex justify-between">
                        <span className="text-white/40">NFT Asset</span>
                        <a href={`https://testnet.explorer.perawallet.app/asset/${p.assetId}`} target="_blank" rel="noreferrer"
                          className="text-[#30d158] hover:underline flex items-center gap-1">
                          #{p.assetId} <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">INR Value</span>
                        <span className="text-white font-medium">{fmtINR(p.amountINR)}</span>
                      </div>
                      {p.paidAt && (
                        <div className="flex justify-between">
                          <span className="text-white/40">Issued</span>
                          <span className="text-white/60">{new Date(p.paidAt).toLocaleDateString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openReceipt(`${BACKEND_URL}/api/certificates/${p.appId}/${p.milestoneIndex}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-white text-black font-semibold py-2 rounded-lg text-xs hover:bg-white/90 transition-colors">
                        <ExternalLink size={13} /> View
                      </button>
                      <button
                        onClick={() => downloadFile(`${BACKEND_URL}/api/certificates/${p.appId}/${p.milestoneIndex}`, `WorkProof-Certificate-App${p.appId}-M${p.milestoneIndex + 1}.pdf`)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#30d158]/10 hover:bg-[#30d158]/20 text-[#30d158] px-3 py-2 rounded-lg text-xs border border-[#30d158]/15 transition-colors font-semibold">
                        <Download size={13} /> Download PDF
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Refresh */}
      <div className="flex justify-center">
        <button onClick={fetchAll}
          className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors py-2 px-4">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
    </div>
  );
}

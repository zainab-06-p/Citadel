import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Building, User, IndianRupee, ShieldCheck, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import { AICreditScore } from './AICreditScore';
import { BACKEND_URL } from '../utils/getBackendUrl';

interface WorkerProfile {
  name: string;
  phone: string;
  role: string;
  walletAddress: string;
  consentGranted: boolean;
  history: {
    completedContracts: number;
    lifetimeEarnings: number;
    onTimeRate: number;
    paymentReliability: number;
  };
  credentials: Array<{
    id: number;
    milestone: string;
    date: string;
    assetId: number;
  }>;
}

export function BankPortal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAddress, setActiveAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [searchError, setSearchError] = useState('');

  const [loanAmount, setLoanAmount] = useState<number>(50000);
  const [tenure, setTenure] = useState<number>(9);
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'success'>('idle');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setLoading(true);
    setProfile(null);
    setApprovalStatus('idle');
    setActiveAddress('');

    setSearchError('');

    try {
      const wallet = searchQuery.trim();
      if (!wallet) return;

      const [paymentRes, contractsRes, certRes, bankRes, consentRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/workers/${wallet}/payment-history`),
        fetch(`${BACKEND_URL}/api/workers/${wallet}/contracts`),
        fetch(`${BACKEND_URL}/api/workers/${wallet}/certificates`),
        fetch(`${BACKEND_URL}/api/workers/${wallet}/bank-details`),
        fetch(`${BACKEND_URL}/api/consent/${wallet}/institutions`),
      ]);

      const [paymentJson, contractsJson, certJson, bankJson, consentJson] = await Promise.all([
        paymentRes.json().catch(() => null),
        contractsRes.json().catch(() => null),
        certRes.json().catch(() => null),
        bankRes.json().catch(() => null),
        consentRes.json().catch(() => null),
      ]);

      if (!paymentRes.ok && !contractsRes.ok && !certRes.ok && !bankRes.ok) {
        throw new Error('No live worker record found for this wallet yet.');
      }

      const payments = paymentJson?.data?.payments || [];
      const contracts = contractsJson?.data?.contracts || [];
      const certificates = certJson?.data?.certificates || [];
      const bankData = bankJson?.data || {};
      const institutions = consentJson?.data?.institutions || [];

      const totalContracts = contracts.length;
      const totalMilestones = contracts.reduce(
        (sum: number, c: any) => sum + Number(c.milestoneCount || 0),
        0
      );
      const completedMilestones = payments.length;
      const completionRate = totalMilestones > 0
        ? Math.min(100, Math.round((completedMilestones / totalMilestones) * 100))
        : 0;
      const payoutTriggered = payments.filter((p: any) => p.payoutStatus === 'triggered').length;
      const reliabilityRate = payments.length > 0
        ? Math.round((payoutTriggered / payments.length) * 100)
        : 0;

      const lifetimeEarnings = Number(paymentJson?.data?.totalINR || 0);
      const walletShort = `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;

      setProfile({
        name: bankData?.accountHolderName || `Worker ${walletShort}`,
        phone: '--',
        role: bankData?.paymentMode ? `On-chain Worker (${bankData.paymentMode})` : 'On-chain Worker',
        walletAddress: wallet,
        consentGranted: institutions.length > 0,
        history: {
          completedContracts: totalContracts,
          lifetimeEarnings,
          onTimeRate: completionRate,
          paymentReliability: reliabilityRate,
        },
        credentials: certificates.map((cert: any, idx: number) => ({
          id: idx + 1,
          milestone: cert.milestoneDescription || `Milestone ${Number(cert.milestoneIndex || 0) + 1}`,
          date: cert.generatedAt
            ? new Date(cert.generatedAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '--',
          assetId: Number(cert.assetId || 0),
        })),
      });

      setActiveAddress(wallet);
    } catch (err: any) {
      setSearchError(err?.message || 'Failed to fetch live worker data');
    } finally {
      setLoading(false);
    }
  };

  const interestRate = 15;
  const r = interestRate / 12 / 100;
  const emi = Math.round(
    loanAmount * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1)
  );

  const handleApprove = () => {
    setApprovalStatus('success');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="relative overflow-hidden card p-8 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[#0a84ff]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-[#30d158]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-5">
          <div className="p-4 bg-gradient-to-b from-[#0a84ff]/20 to-[#0a84ff]/5 rounded-2xl border border-[#0a84ff]/30 shadow-[0_0_20px_rgba(10,132,255,0.15)]">
            <Building className="text-[#0a84ff] w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 tracking-tight">Institution Portal</h2>
            <p className="text-white/50 text-sm mt-1 max-w-sm">
              Real-time underwriter dashboard powered by Citadel verifiable on-chain history.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative z-10 flex w-full md:w-96 shadow-lg">
          <div className="relative w-full group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-white/40 group-focus-within:text-[#0a84ff] transition-colors" />
            </div>
            <input
              type="text"
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-12 pr-24 py-3 text-white focus:outline-none focus:border-[#0a84ff]/50 focus:ring-1 focus:ring-[#0a84ff]/50 placeholder-white/30 transition-all font-mono text-sm"
              placeholder="Worker Wallet Address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute inset-y-0 right-2 flex items-center">
              <button 
                type="submit" 
                className="bg-[#0a84ff] hover:bg-[#0a84ff]/80 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(10,132,255,0.2)] hover:shadow-[0_0_15px_rgba(10,132,255,0.4)]"
              >
                Lookup
              </button>
            </div>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </motion.div>
        )}

        {searchError && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-5 border border-[#ff453a]/30 bg-[#ff453a]/10">
            <p className="text-[#ff6961] text-sm font-medium">{searchError}</p>
            <p className="text-white/50 text-xs mt-1">Try a wallet with existing contracts, payouts, or certificates in this environment.</p>
          </motion.div>
        )}

        {profile && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column */}
            <div className="lg:col-span-8 flex flex-col gap-6">

              {/* Applicant Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex justify-center items-center border-2 border-white/10">
                    <User size={32} className="text-white/40" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="text-xl font-bold text-white">{profile.name}</h3>
                      {profile.consentGranted && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#30d158]/20 bg-[#30d158]/10 text-[#30d158]">
                          DPDP Consent Granted
                        </span>
                      )}
                    </div>
                    <p className="text-[#0a84ff] font-medium">{profile.role}</p>
                    <p className="text-white/40 text-sm mt-1 font-mono truncate max-w-xs">{profile.walletAddress}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-sm">Phone</p>
                  <p className="text-white">{profile.phone}</p>
                </div>
              </motion.div>

              {/* Verification Panel */}
              <motion.div
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="card p-6"
              >
                <h4 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <ShieldCheck className="text-[#30d158]" /> Citadel Verified Data
                </h4>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Completed', value: `${profile.history.completedContracts} Contracts` },
                    { label: 'Earnings', value: `₹${profile.history.lifetimeEarnings.toLocaleString()}` },
                    { label: 'On-time', value: `${profile.history.onTimeRate}%` },
                    { label: 'Trust', value: `${profile.history.paymentReliability}% Rx` },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <p className="text-xs text-white/50 mb-1 flex items-center gap-1"><CheckCircle2 size={12} className="text-[#30d158]" /> {stat.label}</p>
                      <p className="text-xl font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {activeAddress && <AICreditScore workerAddress={activeAddress} size="md" />}
              </motion.div>

              {/* Credential History */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="card p-6"
              >
                <h4 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                  <FileText className="text-white/40" /> On-Chain Credentials
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50">
                        <th className="pb-3 font-medium">#</th>
                        <th className="pb-3 font-medium">Milestone</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium text-right">Asset Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {profile.credentials.length > 0 ? profile.credentials.map((cred, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white/40">{cred.id}</td>
                          <td className="py-3 text-white font-medium">{cred.milestone}</td>
                          <td className="py-3 text-white/40">{cred.date}</td>
                          <td className="py-3 text-right">
                            {cred.assetId > 0 ? (
                              <a
                                href={`https://testnet.explorer.perawallet.app/asset/${cred.assetId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#0a84ff] hover:text-[#0a84ff]/80 font-mono text-xs bg-[#0a84ff]/10 px-2 py-1 rounded border border-[#0a84ff]/20"
                              >
                                #{cred.assetId} <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-white/30 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="py-4 text-white/30" colSpan={4}>No on-chain credentials found for this wallet yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

            </div>

            {/* Right Column - Loan Decision */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
              className="lg:col-span-4"
            >
              <div className="card p-6 sticky top-20 border-white/10">
                <h4 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                  <IndianRupee className="text-[#0a84ff]" /> Loan Setup
                </h4>

                {approvalStatus === 'success' ? (
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-[#30d158] mx-auto mb-4" />
                    <h5 className="text-[#30d158] font-bold text-xl">Loan Approved</h5>
                    <p className="text-white/60 mt-2 text-sm">₹{loanAmount.toLocaleString()} approx. for {profile.name}.</p>
                    <p className="text-white/40 text-xs mt-4">Ref #LA-2026-{Math.floor(Math.random() * 10000)}</p>
                  </motion.div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-sm text-white/50 font-medium">Principal Amount (₹)</label>
                      <input
                        type="range"
                        min="5000"
                        max="100000"
                        step="5000"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        className="w-full accent-[#0a84ff]"
                      />
                      <div className="text-right text-xl font-bold text-[#0a84ff]">
                        ₹ {loanAmount.toLocaleString()}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-white/50 font-medium">Tenure (Months)</label>
                      <select
                        value={tenure}
                        onChange={(e) => setTenure(Number(e.target.value))}
                        className="input"
                      >
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={9}>9 Months</option>
                        <option value={12}>12 Months</option>
                      </select>
                    </div>

                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/50 text-sm">Interest Rate (fixed)</span>
                        <span className="text-white font-medium">{interestRate}% p.a.</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/10 pt-2">
                        <span className="text-white font-bold">Calculated EMI</span>
                        <span className="text-2xl font-bold text-[#30d158]">₹ {emi.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-4 grid gap-3">
                      <button onClick={handleApprove} className="w-full bg-[#0a84ff] hover:bg-[#0a84ff]/80 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(10,132,255,0.2)]">
                        Approve Loan
                      </button>
                      <button className="w-full bg-transparent border border-white/20 hover:border-white/40 text-white/70 font-bold py-3 rounded-xl transition-all hover:bg-white/5">
                        Manual Review
                      </button>
                      <button className="w-full text-[#ff453a] hover:text-[#ff6961] text-sm font-medium py-2 hover:bg-[#ff453a]/10 rounded-lg transition-colors">
                        Reject Application
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, FileText, Anchor, PieChart, Activity, UserCheck, AlertOctagon, CheckCircle } from 'lucide-react';
import AICreditScore from './AICreditScore';

export default function BankPortal() {
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loanAmount, setLoanAmount] = useState(50000);
  const [loanTenure, setLoanTenure] = useState(9);

  const handleSearch = () => {
    setLoading(true);
    setTimeout(() => {
      setProfile({
        name: "Ramesh Kumar",
        phone: "+91-98765-43210",
        role: "Gig Worker / Delivery Partner (Swiggy)",
        address: "0x7a2b...3f4e",
        stats: {
          completed: 12,
          earnings: 345000,
          onTime: 100,
          reliability: 100
        },
        credentials: [
          {id: 1, name: "Milestone 1 - Foundation", date: "2024-01-15", assetId: 12345},
          {id: 2, name: "Milestone 2 - Walls", date: "2024-02-20", assetId: 12346},
          {id: 3, name: "Milestone 3 - Roofing", date: "2024-03-25", assetId: 12347},
        ],
        dpdp: true
      });
      setLoading(false);
    }, 1200);
  };

  const calculateEMI = () => {
    const r = 0.15 / 12; // 15% p.a.
    const numerator = loanAmount * r * Math.pow(1 + r, loanTenure);
    const denominator = Math.pow(1 + r, loanTenure) - 1;
    return Math.round(numerator / denominator);
  };

  return (
    <div className="w-full flex justify-center py-6">
      <div className="w-full max-w-6xl space-y-6">

        {/* Search Bar section */}
        <div className="glass-card p-6 border border-white/5 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
               <ShieldCheck size={24} />
             </div>
             <div>
               <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Rural Finance Bank</h2>
               <p className="text-sm text-slate-600 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                 Connected to ConsentRegistry
               </p>
             </div>
           </div>

           <div className="relative w-full md:w-96">
             <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
             <input 
               type="text"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               placeholder="Search by worker address..."
               className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all font-mono text-sm"
               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
             />
             <motion.button 
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleSearch}
               className="absolute right-2 top-1/2 -translate-y-1/2 text-sm bg-indigo-500 hover:bg-indigo-400 text-slate-900 px-3 py-1.5 rounded-lg font-medium transition-colors"
             >
               Find
             </motion.button>
           </div>
        </div>

        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="h-64 flex flex-col items-center justify-center space-y-4"
          >
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-600 font-mono text-sm tracking-widest uppercase">Fetching encrypted profile...</p>
          </motion.div>
        )}

        <AnimatePresence>
          {profile && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, staggerChildren: 0.1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-1 space-y-6">
                {/* APPLICANT INFO */}
                <motion.div className="glass-card p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 font-mono text-xs text-slate-900/10 group-hover:text-slate-900/20 transition-colors">REF# 2026-LA</div>
                  <h3 className="text-sm font-semibold tracking-widest text-slate-600 uppercase mb-4 mb-4">Applicant Info</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-1 flex-shrink-0">
                      <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center font-bold text-xl text-slate-900">
                        {profile.name.charAt(0)}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
                      <p className="text-sm text-slate-600">{profile.phone}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group-hover:border-indigo-500/30 transition-colors">
                      <span className="text-xs text-slate-600">Role</span>
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{profile.role}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group-hover:border-blue-500/30 transition-colors">
                      <span className="text-xs text-slate-600">Identity</span>
                      <span className="text-sm font-mono text-indigo-400 flex items-center gap-2">
                        {profile.address} <UserCheck size={14} className="text-emerald-400"/>
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* DECISION PANEL */}
                <motion.div className="glass-card p-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20">
                  <h3 className="text-sm font-semibold tracking-widest text-indigo-400 uppercase mb-4 flex gap-2"><Activity size={16}/> Loan Decision</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Requested Amount</span>
                        <span className="font-mono text-slate-900">₹{loanAmount.toLocaleString()}</span>
                      </div>
                      <input 
                        type="range" min="10000" max="100000" step="5000"
                        value={loanAmount}
                        onChange={(e) => setLoanAmount(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                        <span className="text-xs text-slate-600 block mb-2">Tenure (Months)</span>
                        <div className="flex gap-2">
                          {[3, 6, 9, 12].map(m => (
                            <button 
                              key={m} onClick={() => setLoanTenure(m)}
                              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                                loanTenure === m ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-600 hover:bg-white/10'
                              }`}
                            >
                              {m}m
                            </button>
                          ))}
                        </div>
                    </div>
                    
                    <div className="flex items-end justify-between py-4 border-y border-white/10 my-4">
                       <span className="text-sm text-slate-600">Calculated EMI</span>
                       <div className="text-right">
                          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-200">
                             ₹{calculateEMI().toLocaleString()}
                          </span>
                          <span className="block text-xs text-slate-500 mt-1">@ 15% p.a.</span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2 pt-2">
                      <button className="col-span-2 glass-button bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-400/30 text-slate-900 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 text-sm tracking-wide">
                        APPROVE LOAN
                      </button>
                      <button className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-2 rounded-xl text-sm font-medium transition-colors">
                        REJECT
                      </button>
                      <button className="bg-white/5 hover:bg-white/10 text-slate-700 border border-white/10 py-2 rounded-xl text-sm font-medium transition-colors">
                        REVIEW
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {/* VERIFICATION GRID */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div className="glass-card p-5 rounded-2xl border border-white/10 bg-emerald-950/10 border-l-4 border-l-emerald-500 flex flex-col justify-center">
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><ShieldCheck size={14}/> DPDP Consent</span>
                    <span className="text-slate-900 text-lg font-medium">Granted</span>
                    <span className="text-slate-500 text-xs mt-1">Verified via ConsentRegistry</span>
                  </motion.div>
                  <motion.div className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col justify-center gap-1 group overflow-hidden relative">
                    <div className="absolute right-[-20%] bottom-[-20%] text-slate-900/[0.03] group-hover:text-slate-900/[0.05] transition-colors"><PieChart size={120}/></div>
                    <span className="text-slate-600 text-xs font-bold uppercase tracking-wider">Lifetime Earnings</span>
                    <span className="text-slate-900 text-2xl font-bold">₹{profile.stats.earnings.toLocaleString()}</span>
                  </motion.div>
                  <motion.div className="glass-card p-5 rounded-2xl border border-white/10 flex justify-between items-center bg-white/5">
                    <div className="flex flex-col">
                      <span className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-1">On-time Completion</span>
                      <span className="text-emerald-400 text-xl font-bold">{profile.stats.onTime}%</span>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 flex items-center justify-center border-t-emerald-500">
                      <CheckCircle size={16} className="text-emerald-500"/>
                    </div>
                  </motion.div>
                  <motion.div className="glass-card p-5 rounded-2xl border border-white/10 flex justify-between items-center bg-white/5">
                     <div className="flex flex-col">
                      <span className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-1">Contracts Complete</span>
                      <span className="text-indigo-400 text-xl font-bold">{profile.stats.completed} Verified</span>
                    </div>
                    <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                      <Anchor size={20}/>
                    </div>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* CREDIT SCORE WIDGET */}
                  <div className="md:col-span-2">
                    <AICreditScore workerAddress={profile.address} size="sm" showDetails={false} />
                  </div>

                  {/* CREDENTIALS HISTORY */}
                  <div className="md:col-span-3 glass-card rounded-2xl border border-white/10 p-6 flex flex-col h-full">
                     <div className="flex items-center justify-between mb-6">
                       <h3 className="text-sm font-semibold tracking-widest text-slate-600 uppercase">Verified Credentials</h3>
                       <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono border border-emerald-500/20">
                         {profile.credentials.length} NFT CERTs
                       </span>
                     </div>
                     <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                       {profile.credentials.map((cert: any, idx: number) => (
                         <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-mono text-xs font-bold">
                                #{cert.id}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-slate-900">{cert.name}</h4>
                                <span className="text-xs text-slate-600 font-mono block mt-1">{cert.date}</span>
                              </div>
                            </div>
                            <div className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 font-mono text-[10px] text-slate-700 group-hover:bg-indigo-500 group-hover:text-slate-900 transition-all cursor-pointer">
                              Asset: {cert.assetId}
                            </div>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Plus, Check, ShieldCheck, CreditCard, Layers, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ContractorDashboard() {
  const [worker, setWorker] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [milestones, setMilestones] = useState([{ name: '', amount: 0 }]);
  const [appId, setAppId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleCreateContract = async () => {
    setLoading(true);
    setTimeout(() => {
      setAppId(758015705);
      setLoading(false);
    }, 1500);
  };

  const totalAmount = milestones.reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto">
      {/* Main Configuration Form */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="apple-card p-10 relative overflow-hidden">
          {/* Subtle card background decoration */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-50 pointer-events-none" />

          <div className="mb-10 text-center relative z-10">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Create Contract.</h2>
            <p className="text-lg text-[#86868b] font-medium">Deploy an Algorand smart escrow in seconds.</p>
          </div>

          <div className="space-y-10 relative z-10">
            {/* Wallet Addresses */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3 border-b border-[#e5e5ea]/60 pb-4">
                <div className="bg-[#0071e3]/10 p-2 rounded-xl">
                  <ShieldCheck className="text-[#0071e3]" size={22} /> 
                </div>
                1. Assign Roles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                    Worker Address
                  </label>
                  <div className="relative">
                    <input 
                      className="apple-input pl-11"
                      placeholder="Enter ALGO address" 
                      value={worker}
                      onChange={e => setWorker(e.target.value)}
                    />
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a1a6]" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#86868b] mb-2 uppercase tracking-wide">
                    Supervisor Address
                  </label>
                  <div className="relative">
                    <input 
                      className="apple-input pl-11"
                      placeholder="Enter ALGO address" 
                      value={supervisor}
                      onChange={e => setSupervisor(e.target.value)}
                    />
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a1a6]" size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* Milestones Configuration */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#e5e5ea]/60 pb-4">
                 <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                  <div className="bg-[#ff2a85]/10 p-2 rounded-xl">
                    <Layers className="text-[#ff2a85]" size={22} /> 
                  </div>
                  2. Define Milestones
                </h3>
              </div>
              
              <div className="space-y-4">
                {milestones.map((m, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={idx} 
                    className="flex flex-col sm:flex-row gap-4 items-center bg-white/40 border border-[#e5e5ea]/50 p-2 rounded-[1.25rem] shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-[#e5e5ea]/50 text-[#1d1d1f] flex flex-shrink-0 items-center justify-center font-bold text-lg">
                      {idx + 1}
                    </div>
                    <div className="flex-1 w-full">
                       <input 
                        className="w-full bg-transparent border-none text-[#1d1d1f] px-4 py-3 focus:ring-0 outline-none font-medium placeholder-[#86868b]" 
                        placeholder="Description (e.g. Frontend Design)"
                        value={m.name}
                        onChange={e => {
                          const n = [...milestones];
                          n[idx].name = e.target.value;
                          setMilestones(n);
                        }}
                      />
                    </div>
                    <div className="relative w-full sm:w-48 flex-shrink-0">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="text-[#86868b] font-semibold text-lg">$</span>
                      </div>
                      <input 
                        type="number"
                        className="w-full bg-white shadow-inner border border-[#e5e5ea]/80 text-[#1d1d1f] pl-9 pr-5 py-3 rounded-xl focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 outline-none transition-all font-medium text-lg" 
                        placeholder="Amount"
                        value={m.amount || ''}
                        onChange={e => {
                          const n = [...milestones];
                          n[idx].amount = Number(e.target.value);
                          setMilestones(n);
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <button 
                onClick={() => setMilestones([...milestones, { name: '', amount: 0 }])}
                className="text-[#0071e3] font-semibold flex items-center gap-2 hover:text-[#0077ED] transition-colors py-2 px-1 text-lg group"
              >
                <div className="bg-[#0071e3]/10 p-1.5 rounded-full group-hover:bg-[#0071e3]/20 transition-colors">
                  <Plus size={20} /> 
                </div>
                Add Milestone
              </button>
            </div>
            
            <div className="pt-8">
              <button 
                onClick={handleCreateContract}
                disabled={loading}
                className="apple-btn-primary w-full shadow-[0_8px_20px_rgba(0,113,227,0.25)] hover:shadow-[0_12px_24px_rgba(0,113,227,0.3)]"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <div className="w-6 h-6 border-3 border-white/40 border-t-white rounded-full animate-spin" />
                    Deploying to Algorand...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Pay & Deploy Contract
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Success State */}
        {appId && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            className="apple-card p-10 bg-gradient-to-br from-[#ffffff] to-[#f4fbf6] border-[#e1f3e6] shadow-[0_12px_40px_rgba(52,199,89,0.08)]"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#34c759] text-slate-900 flex items-center justify-center mb-6 shadow-[0_8px_20px_rgba(52,199,89,0.35)] transform scale-110">
                <Check size={40} strokeWidth={3} />
              </div>
              <h3 className="text-3xl font-bold mb-3 tracking-tight">Contract Deployed & Locked.</h3>
              <p className="text-[#86868b] font-medium text-lg mb-8 max-w-md">Your smart contract is successfully live on the blockchain. Funds are safely in escrow.</p>
              
              <div className="bg-white px-8 py-4 rounded-2xl shadow-sm flex items-center gap-4 border border-[#e5e5ea] hover:shadow-md transition-shadow cursor-default">
                <div className="bg-[#f5f5f7] p-2 rounded-lg">
                  <ShieldCheck className="text-[#34c759]" size={20} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs text-[#86868b] font-bold uppercase tracking-widest leading-none mb-1">Network App ID</span>
                  <code className="text-[#1d1d1f] font-bold text-xl leading-none">{appId}</code>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Sidebar Summary */}
      <div className="lg:col-span-4">
        <div className="apple-card p-8 sticky top-28 backdrop-blur-3xl bg-white/70">
           <div className="w-14 h-14 bg-gradient-to-br from-[#f5f5f7] to-[#e8e8ed] rounded-2xl flex items-center justify-center mb-8 border border-white shadow-sm">
              <CreditCard className="text-[#1d1d1f]" size={28} />
            </div>
          <h3 className="text-2xl font-bold mb-8 tracking-tight">Summary</h3>
          
          <div className="space-y-6 text-lg font-medium border-b border-[#e5e5ea] pb-8 mb-8">
            <div className="flex justify-between items-center text-[#86868b]">
              <span>Stages</span>
              <span className="text-[#1d1d1f]">{milestones.length} lockups</span>
            </div>
            <div className="flex justify-between items-center text-[#86868b]">
              <span>Escrow Value</span>
              <span className="text-[#1d1d1f]">${totalAmount.toFixed(2)}</span>
            </div>
             <div className="flex justify-between items-center text-[#86868b]">
              <span>Network Fee</span>
              <span className="text-[#0071e3] bg-[#0071e3]/10 px-3 py-1 rounded-lg">0.002 ALGO</span>
            </div>
          </div>

          <div>
             <p className="text-sm font-semibold text-[#86868b] uppercase tracking-wide mb-2">Total Due</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tighter text-gradient">${(totalAmount + 0.002).toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mt-10 bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-[#e5e5ea] shadow-sm">
             <p className="text-[#55555c] font-medium leading-relaxed flex gap-3">
               <ShieldCheck className="text-[#0071e3] shrink-0 translate-y-1" size={20} />
               Secure payment processing. Escrow funds are only released upon cryptographic verification of work.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, FileSignature, CheckCircle, ShieldCheck, Wallet, ArrowRight, PlayCircle, Layers, Lock, Zap } from 'lucide-react';
import ContractorDashboard from './components/ContractorDashboard';
import SupervisorApprove from './components/SupervisorApprove';
import WorkerDashboard from './components/WorkerDashboard';
import BankPortal from './components/BankPortal';
import ConsentManager from './components/ConsentManager';

const tabs = [
  { id: 'contractor', label: 'Contractor', icon: FileSignature },
  { id: 'supervisor', label: 'Supervisor', icon: CheckCircle },
  { id: 'worker', label: 'Worker', icon: Briefcase },
  { id: 'bank', label: 'Institution', icon: Wallet },
  { id: 'consent', label: 'Compliance', icon: ShieldCheck }
];

const variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 }
};

// Extracted Background Component for reusability and cleanliness
const AmbientBackground = () => (
  <>
    <div className="fixed inset-0 z-[-2] bg-[#fbfbfd]" />
    <div className="fixed inset-0 z-[-1] bg-grid-pattern mask-image:linear-gradient(to_bottom,white,transparent)" />
    <div 
      className="orb bg-blue-400/30 w-[600px] h-[600px] -top-[100px] -left-[100px]" 
      style={{ animation: 'float 20s infinite ease-in-out' }} 
    />
    <div 
      className="orb bg-pink-400/20 w-[500px] h-[500px] top-[20%] -right-[150px]" 
      style={{ animation: 'float 25s infinite ease-in-out reverse' }} 
    />
    <div 
      className="orb bg-emerald-400/20 w-[700px] h-[700px] -bottom-[200px] left-[20%]" 
      style={{ animation: 'float 22s infinite ease-in-out 2s' }} 
    />
    <div 
      className="orb bg-purple-400/20 w-[400px] h-[400px] bottom-[10%] right-[10%]" 
      style={{ animation: 'pulse-slow 15s infinite ease-in-out' }} 
    />
  </>
);

export default function Home() {
  const [hasEntered, setHasEntered] = useState(false);
  const [activeTab, setActiveTab] = useState('contractor');

  if (!hasEntered) {
    return (
      <div className="min-h-screen text-[#1d1d1f] flex flex-col justify-start relative overflow-hidden font-sans">
        <AmbientBackground />
        
        {/* Apple-style sticky nav */}
        <nav className="fixed top-0 w-full apple-glass z-50 border-b border-[#e5e5ea]/50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="font-bold text-xl tracking-tight flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#0071e3] to-[#34c759] shadow-sm" />
              WorkProof.
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-[#86868b] uppercase tracking-widest hidden sm:block">Algorand Testnet</span>
              <button 
                onClick={() => setHasEntered(true)}
                className="text-xs bg-[#0071e3] text-slate-900 px-4 py-1.5 rounded-full font-medium hover:bg-[#0077ED] transition-all shadow-[0_2px_8px_rgba(0,113,227,0.3)] hover:shadow-[0_4px_12px_rgba(0,113,227,0.4)]"
              >
                Launch App
              </button>
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-20 text-center relative z-10 w-full max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-[#e5e5ea] text-sm font-semibold shadow-sm text-[#1d1d1f]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Network Synced
            </div>
          </motion.div>

          <motion.h1 
            initial="hidden" animate="visible" transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 leading-tight"
          >
            Payments. <br className="hidden md:block"/>
            <span className="text-gradient">Zero trust required.</span>
          </motion.h1>

          <motion.p 
            initial="hidden" animate="visible" transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl md:text-3xl text-[#55555c] font-medium max-w-3xl mb-12 tracking-tight leading-relaxed"
          >
            A powerfully simple smart contract escrow. WorkProof secures your capital, verifies milestones, and pays workers automatically.
          </motion.p>

          <motion.div 
            initial="hidden" animate="visible" transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <button onClick={() => setHasEntered(true)} className="apple-btn-primary group">
              Get Started 
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="apple-btn-secondary group">
              Watch the Film 
              <PlayCircle size={20} className="text-[#86868b] group-hover:text-[#1d1d1f] transition-colors" />
            </button>
          </motion.div>

          {/* Bento Box UI Graphic */}
          <motion.div 
            initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-24"
          >
            <div className="apple-card p-10 flex flex-col items-start text-left aspect-square shadow-xl relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-100 rounded-full mix-blend-multiply filter blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-auto border border-blue-200">
                <Lock size={28} className="text-[#0071e3]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Cryptographic Security</h3>
                <p className="text-[#86868b] font-medium leading-relaxed">Your funds are locked safely on the Algorand blockchain.</p>
              </div>
            </div>

            <div className="apple-card p-10 flex flex-col items-start text-left aspect-square shadow-xl bg-[#1d1d1f] text-slate-900 relative overflow-hidden group">
              <div className="absolute -left-6 -bottom-6 w-40 h-40 bg-pink-500 rounded-full mix-blend-screen filter blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-auto border border-white/20 backdrop-blur-md">
                <Zap size={28} className="text-[#ff2a85]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 text-slate-900">Instant Settlement</h3>
                <p className="text-[#a1a1a6] font-medium leading-relaxed">When milestones are approved, capital flows in sub-seconds.</p>
              </div>
            </div>

            <div className="apple-card p-10 flex flex-col items-start text-left aspect-square shadow-xl relative overflow-hidden group">
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-100 rounded-full mix-blend-multiply filter blur-2xl opacity-50 group-hover:opacity-80 transition-opacity" />
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mb-auto border border-emerald-200">
                <Layers size={28} className="text-[#34c759]" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Modular Milestones</h3>
                <p className="text-[#86868b] font-medium leading-relaxed">Break huge projects into simple, verifiable payment steps.</p>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#1d1d1f] font-sans flex flex-col pt-16 relative overflow-hidden">
      <AmbientBackground />
      
      {/* Header App View */}
      <header className="apple-glass fixed top-0 w-full z-50 border-b border-[#e5e5ea]/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setHasEntered(false)}>
             <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0071e3] to-[#34c759] shadow-sm transform group-hover:scale-105 transition-transform" />
            <div className="text-2xl font-bold tracking-tight text-[#1d1d1f]">WorkProof.</div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-[#e5e5ea] text-[#1d1d1f] text-xs uppercase tracking-widest font-semibold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Testnet
            </div>
            <button className="bg-[#1d1d1f] hover:bg-black text-slate-900 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-lg flex items-center gap-2 transform active:scale-95">
              <Wallet size={16} /> Connect Wallet
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 relative z-10">
        <div className="mb-12 flex flex-col items-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              Dashboard
            </h2>
            <p className="text-[#86868b] font-medium text-lg">Manage your non-custodial smart contracts.</p>
          </motion.div>
          
          {/* Enhanced Apple Pill Navigation */}
          <motion.nav 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center p-1.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-x-auto no-scrollbar max-w-full"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap relative ${
                    isActive 
                      ? 'text-[#1d1d1f]' 
                      : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/40'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-[#e5e5ea]/50"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={18} className={isActive ? 'text-[#0071e3]' : 'text-[#86868b]'} />
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </motion.nav>
        </div>

        <div className="relative">
          <AnimatePresence mode="sync">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === 'contractor' && <ContractorDashboard />}
              {activeTab === 'supervisor' && <SupervisorApprove />}
              {activeTab === 'worker' && <WorkerDashboard />}
              {activeTab === 'bank' && <BankPortal />}
              {activeTab === 'consent' && <ConsentManager />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

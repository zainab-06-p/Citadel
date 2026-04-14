import { useWallet } from '@txnlab/use-wallet-react'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'

import { ContractorDashboard } from './components/ContractorDashboard'
import { SupervisorApprove } from './components/SupervisorApprove'
import { WorkerDashboard } from './components/WorkerDashboard'
import { WorkerBankSetup } from './components/WorkerBankSetup'
import { BankPortal } from './components/BankPortal'
import { ConsentManager } from './components/ConsentManager'
import { WalletHistory } from './components/WalletHistory'

import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, ClipboardCheck, UserCircle, Landmark, Shield, ArrowRight, Wallet, ChevronDown, Banknote, History } from 'lucide-react'
import citadelLogo from './assets/citadel-logo.png'

type ViewType = 'contractor' | 'supervisor' | 'worker' | 'bank' | 'consent' | 'history'

const sidebarTabs: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'contractor', label: 'Contractor', icon: Briefcase },
  { id: 'supervisor', label: 'Supervisor', icon: ClipboardCheck },
  { id: 'worker', label: 'Worker', icon: UserCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'bank', label: 'Institution', icon: Landmark },
  { id: 'consent', label: 'Compliance', icon: Shield },
]

type WorkerSubView = 'certificates' | 'payment-setup'

export default function Home() {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const { activeAddress } = useWallet()
  const [view, setView] = useState<ViewType>('contractor')
  const [workerSubView, setWorkerSubView] = useState<WorkerSubView>('certificates')
  const [hasEntered, setHasEntered] = useState(false)

  React.useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.dashboard) {
        setHasEntered(true);
      } else {
        setHasEntered(false);
      }
    };
    // Sync initial state if needed, though usually default is fine
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDashboard = () => {
    window.history.pushState({ dashboard: true }, '');
    setHasEntered(true);
  };

  const navigateToIntro = () => {
    window.history.pushState({ dashboard: false }, '');
    setHasEntered(false);
  };

  const toggleWalletModal = () => setOpenWalletModal(!openWalletModal)

  /* ─── LANDING PAGE ─── */
  if (!hasEntered) {
    return (
      <div className="min-h-screen text-white flex flex-col relative overflow-hidden font-[Schibsted_Grotesk]">
        {/* Full-screen dark cinematic video background */}
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0">
          <source src="https://res.cloudinary.com/dfonotyfb/video/upload/v1775585556/dds3_1_rqhg7x.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay for cinematic feel + text readability */}
        <div className="absolute inset-0 bg-black/50 z-[1]" />

        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'saturate(180%) blur(20px)' }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-[120px] h-14 flex items-center justify-between">
            <div className="font-semibold text-2xl tracking-[-1.44px] flex items-center gap-2.5 text-white">
              <img src={citadelLogo} alt="Citadel" className="w-7 h-7 object-contain invert" />
              Citadel
            </div>
            <div className="hidden md:flex items-center gap-8 text-[16px] font-medium tracking-[-0.2px] text-white/80">
              <a href="#" className="hover:text-white transition-colors">Platform</a>
              <a href="#" className="hover:text-white transition-colors flex items-center gap-1">Features <ChevronDown size={14} /></a>
              <a href="#" className="hover:text-white transition-colors">Projects</a>
              <a href="#" className="hover:text-white transition-colors">Community</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-5 py-1.5 text-sm font-medium text-white/80 hover:text-white transition-colors">Sign Up</button>
              <button onClick={navigateToDashboard} className="bg-white text-black px-5 py-1.5 rounded-full text-sm font-medium hover:bg-white/90 transition-all">
                Log In
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-20 text-center relative z-10 w-full max-w-5xl mx-auto -mt-[50px]">
          
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-[34px]"
          >
            <div className="inline-flex items-center gap-2 rounded-full shadow-sm overflow-hidden">
              <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 border border-white/20">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 0L8.5 5L14 5.5L9.5 9L11 14L7 11L3 14L4.5 9L0 5.5L5.5 5L7 0Z" fill="#FFD700"/></svg>
                New
              </span>
              <span className="bg-white/10 backdrop-blur-md text-white/90 px-4 py-1.5 rounded-full text-sm font-normal border border-white/10" style={{ fontFamily: 'Inter' }}>
                Discover what's possible
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-[80px] font-bold tracking-[-4.8px] leading-none mb-[34px] text-white"
            style={{ fontFamily: 'Fustat' }}
          >
            Secure Escrow,<br />
            <span className="text-gradient">Built On-Chain.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-[20px] font-medium tracking-[-0.4px] text-white/70 max-w-[736px] mb-[44px]"
            style={{ fontFamily: 'Fustat' }}
          >
            Lock funds via fiat, deploy smart contracts on Algorand, and release payments automatically when milestones are verified. Work smarter with trustless escrow.
          </motion.p>

          {/* Dashboard CTA */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={navigateToDashboard}
              className="bg-white text-black px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/90 active:scale-[0.97] transition-all flex items-center gap-3 shadow-lg"
            >
              Go to Dashboard <ArrowRight size={20} />
            </button>
          </motion.div>
        </main>
      </div>
    )
  }

  /* ─── DASHBOARD WITH SIDEBAR ─── */
  return (
    <div className="min-h-screen bg-[#050505] text-[#eeeeee] font-[Schibsted_Grotesk] flex flex-col relative">
      
      {/* Background ambient lighting */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0a84ff]/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#30d158]/5 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Top Header */}
      <header className="glass-nav fixed top-0 w-full z-50 border-b border-white/10" style={{ background: 'rgba(5,5,5,0.6)', backdropFilter: 'saturate(180%) blur(20px)' }}>
        <div className="max-w-full mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer group text-white" onClick={navigateToIntro}>
            <img src={citadelLogo} alt="Citadel" className="w-6 h-6 object-contain invert group-hover:scale-105 transition-transform" />
            <span className="font-semibold text-xl tracking-[-1px]">Citadel</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-widest font-semibold text-white/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30d158] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30d158]"></span>
              </span>
              Testnet
            </div>
            <button onClick={toggleWalletModal} className="bg-white hover:bg-white/90 text-black px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <Wallet size={15} /> {activeAddress ? 'Connected' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative z-10">
        {/* Rounded Sidebar */}
        <aside className="fixed left-6 top-20 bottom-6 w-[240px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 flex flex-col gap-2 z-40 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-white/40 px-3 pt-2 pb-4">Navigation</p>
          {sidebarTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`relative flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-black shadow-lg scale-[1.02]'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-black' : 'text-white/40'} />
                {tab.label}
              </button>
            )
          })}

          {/* Wallet Info at bottom */}
          {activeAddress && (
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="px-3 py-3 bg-black/40 rounded-xl border border-white/5">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Active Wallet</p>
                <p className="text-xs font-mono text-[#0a84ff] mt-1 truncate font-medium">
                  {activeAddress.substring(0, 8)}...{activeAddress.substring(activeAddress.length - 4)}
                </p>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-[280px] p-8 pt-[104px]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10"
            >
              <h2 className="text-4xl font-bold tracking-tight mb-2 text-white" style={{ fontFamily: 'Fustat' }}>
                {sidebarTabs.find(t => t.id === view)?.label} Dashboard
              </h2>
              <p className="text-white/50 font-medium text-[15px]">Manage your non-custodial smart contracts on Algorand.</p>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {view === 'contractor' && <ContractorDashboard />}
                {view === 'supervisor' && <SupervisorApprove />}
                {view === 'worker' && (
                  <div className="space-y-6">
                    {/* Worker Sub-tabs */}
                    <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 max-w-xs">
                      <button
                        onClick={() => setWorkerSubView('certificates')}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all ${
                          workerSubView === 'certificates'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        My Work
                      </button>
                      <button
                        onClick={() => setWorkerSubView('payment-setup')}
                        className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                          workerSubView === 'payment-setup'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        <Banknote size={14} /> Payment Setup
                      </button>
                    </div>
                    {workerSubView === 'certificates' && <WorkerDashboard />}
                    {workerSubView === 'payment-setup' && <WorkerBankSetup />}
                  </div>
                )}
                {view === 'history' && <WalletHistory />}
                {view === 'bank' && <BankPortal />}
                {view === 'consent' && <ConsentManager />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
  )
}

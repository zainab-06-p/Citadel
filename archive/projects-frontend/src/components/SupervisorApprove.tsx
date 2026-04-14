import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Search, ExternalLink, Activity, AlertCircle, Play } from 'lucide-react';
// Use this when uncommenting the smart contract call below
// import { useWallet } from '@txnlab/use-wallet-react';
// import { WorkProofV2Client } from '../contracts/WorkProofClient';

export default function SupervisorApprove() {
  const [appId, setAppId] = useState('');
  const [milestoneIdx, setMilestoneIdx] = useState('0');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [txid, setTxid] = useState('');

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appId || !milestoneIdx) return;
    
    setStatus('loading');
    
    try {
      /* 
       * REQUIRED: Person 1 must generate `WorkProofClient.ts`
       * Uncomment below once `WorkProofV2Client` is available in `src/contracts/`.
       */
      
      // const { activeAddress, transactionSigner } = useWallet();
      // const metadataUrl = `${import.meta.env.VITE_BACKEND_URL}/api/certificates/${appId}/${milestoneIdx}`;
      // const metadataHash = ''; // Optional for hackathon

      // const client = new WorkProofV2Client({
      //   appId: BigInt(appId),
      //   sender: { addr: activeAddress, signer: transactionSigner },
      //   algod: algodClient, // Assume algodClient is provided by network config
      // });

      // const result = await client.approveMilestone({
      //   milestoneIndex: BigInt(milestoneIdx),
      //   metadataUrl,
      //   metadataHash,
      // });

      // setTxid(result.transaction.txID());
      
      // Mock simulation for now
      setTimeout(() => {
        setStatus('success');
        setTxid('TRX' + Math.random().toString(36).substring(2, 10).toUpperCase());
      }, 2500);

    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
      <div className="w-full flex justify-center py-12">
      <div className="w-full max-w-lg space-y-6">
         <motion.div 
           initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
           className="glass-card p-8 rounded-3xl border border-white/10 text-center relative overflow-hidden"
         >
           <div className="absolute top-0 right-0 p-8 text-slate-900/5"><Activity size={100} /></div>

           <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center border border-white/20 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
             <CheckCircle className="text-slate-900" size={32} />
           </div>

           <h2 className="text-2xl font-bold text-slate-900 mb-2">Milestone Approval</h2>
           <p className="text-sm text-slate-600 mb-8 max-w-sm mx-auto">Authorize completion of a smart contract milestone to release worker funds and mint the credential NFT.</p>

           <form onSubmit={handleApprove} className="space-y-4 relative z-10 text-left">
             <div>
               <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">Smart Contract ID</label>
               <div className="relative">
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input 
                   required
                   value={appId}
                   onChange={e => setAppId(e.target.value)}
                   className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 placeholder-slate-600 text-slate-900 font-mono text-sm focus:border-indigo-500 transition-colors"
                   placeholder="e.g. 758015705"
                 />
               </div>
             </div>

             <div>
               <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block flex justify-between">
                 <span>Milestone Index</span>
                 <span className="text-indigo-400 font-mono tracking-normal">{milestoneIdx}</span>
               </label>
               <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                 {[0, 1, 2, 3, 4].map((num) => (
                   <button 
                     key={num}
                     type="button"
                     onClick={() => setMilestoneIdx(num.toString())}
                     className={`flex-1 py-2 font-mono text-sm rounded-lg transition-all ${milestoneIdx === num.toString() ? 'bg-indigo-500 text-slate-900 shadow-lg' : 'text-slate-600 hover:text-slate-900 hover:bg-white/5'}`}
                   >
                     {num}
                   </button>
                 ))}
                 <input 
                   value={milestoneIdx}
                   onChange={e => setMilestoneIdx(e.target.value)}
                   className="w-16 bg-transparent text-center border-l pl-1 border-white/10 font-mono text-sm text-slate-900 outline-none placeholder-slate-600"
                   placeholder="..."
                 />
               </div>
             </div>

             <div className="pt-6">
                <button 
                   disabled={status === 'loading'}
                   className={`w-full glass-button group relative flex justify-center py-4 rounded-xl font-bold border transition-all text-sm tracking-wide uppercase ${
                     status === 'loading' ? 'bg-indigo-900 border-indigo-500/50 text-indigo-300' : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/30 text-slate-900 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                   }`}
                >
                   {status === 'loading' ? (
                     <div className="flex items-center gap-3">
                       <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                       Approving on-chain...
                     </div>
                   ) : (
                     <div className="flex items-center justify-center gap-2 group-hover:gap-3 transition-all relative z-10 text-slate-900">
                        <Play size={18} />
                        Approve Milestone
                     </div>
                   )}
                </button>
             </div>
           </form>
         </motion.div>

         <AnimatePresence>
           {status === 'success' && (
             <motion.div 
               initial={{ opacity: 0, y: 10, height: 0 }}
               animate={{ opacity: 1, y: 0, height: 'auto' }}
               exit={{ opacity: 0, y: -10, height: 0 }}
               className="glass-card border border-emerald-500/30 bg-emerald-950/20 p-6 rounded-2xl flex flex-col items-center text-center relative overflow-hidden"
             >
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Milestone Approved Successfully</h3>
                <p className="text-sm text-slate-600 mb-6">Funds have been released to the worker and credential minted.</p>
                
                <div className="w-full bg-black/20 rounded-xl p-4 border border-white/5 font-mono text-xs flex justify-between items-center group cursor-pointer hover:border-emerald-500/30 transition-all">
                  <span className="text-slate-500">TXID</span>
                  <span className="text-emerald-400 flex items-center gap-2">
                    {txid} <ExternalLink size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                
                <button onClick={() => setStatus('idle')} className="mt-6 text-sm text-emerald-400 hover:text-emerald-300">
                  Approve another milestone
                </button>
             </motion.div>
           )}
           {status === 'error' && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
               className="glass-card border border-red-500/30 bg-red-950/20 p-5 rounded-2xl flex items-start gap-4"
             >
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <h3 className="text-sm font-semibold text-red-400">Transaction Failed</h3>
                  <p className="text-xs text-red-300 mt-1">Ensure the WorkProofClient is properly generated and index matches.</p>
                  <button onClick={() => setStatus('idle')} className="mt-3 text-xs text-red-400 underline underline-offset-4">Try Again</button>
                </div>
             </motion.div>
           )}
         </AnimatePresence>
      </div>
      </div>
  );
}

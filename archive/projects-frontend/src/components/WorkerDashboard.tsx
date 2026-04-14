import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DownloadCloud, ExternalLink, Award, Sparkles } from 'lucide-react';
import AICreditScore from './AICreditScore';

interface Certificate {
  contractId: number;
  milestoneIndex: number;
  issuedAt: string;
  txid: string;
  assetId: number;
}

export default function WorkerDashboard() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const activeAddress = "0x7a2b...3f4e"; // In a real app, this comes from useWallet()

  useEffect(() => {
    async function fetchCertificates() {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/workers/${activeAddress}/certificates`);
        if (response.ok) {
          const data = await response.json();
          setCerts(data);
        } else {
          console.error("Failed to fetch certificates");
        }
      } catch (error) {
        console.error("Error fetching certificates:", error);
      } finally {
        setLoading(false);
      }
    }

    if (activeAddress) {
      fetchCertificates();
    }
  }, [activeAddress]);

  const handleDownload = (contractId: number, milestoneIndex: number) => {
    window.open(`${import.meta.env.VITE_BACKEND_URL}/api/certificates/${contractId}/${milestoneIndex}`, '_blank');
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Active Certificates Left Column */}
      <div className="lg:col-span-2 space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 glass-card rounded-2xl border-white/5 border"
        >
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="text-indigo-400" />
              Verified Portfolio
            </h2>
            <p className="text-slate-600 mt-1">Download and verify your successfully completed milestones on-chain.</p>
          </div>
          <div className="bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 text-indigo-300 font-mono text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)] mt-4 md:mt-0">
             {activeAddress}
          </div>
        </motion.div>

        {loading ? (
          <div className="space-y-4">
             <SkeletonRow /> <SkeletonRow />
          </div>
        ) : certs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/5 text-slate-600"
          >
             <Award size={48} className="mx-auto mb-4 text-slate-600" />
             <p>No milestones completed yet.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
             <AnimatePresence>
              {certs.map((cert, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className="glass-card p-6 rounded-2xl border border-white/5 hover:bg-white/5 hover:border-indigo-500/30 transition-all duration-300 group flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                       <Award size={24} className="text-indigo-400" />
                     </div>
                     <div>
                       <h3 className="font-semibold text-lg text-slate-900">Milestone {cert.milestoneIndex + 1}</h3>
                       <p className="text-sm border flex items-center gap-2 border-white/10 rounded-lg px-2 py-[2px] w-fit text-slate-600 mt-1 bg-white/5 font-mono">
                         Asset: #{cert.assetId} 
                         <a href={`https://testnet.explorer.perawallet.app/asset/${cert.assetId}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-slate-900 transition-colors">
                           <ExternalLink size={12} />
                         </a>
                       </p>
                     </div>
                   </div>

                   <div className="flex gap-3 w-full md:w-auto">
                     <button 
                       onClick={() => handleDownload(cert.contractId, cert.milestoneIndex)}
                       className="flex-1 md:flex-none glass-button flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-slate-900 font-medium text-sm transition-all border border-indigo-400/20 shadow-lg shadow-indigo-600/20"
                     >
                        <DownloadCloud size={16} />
                        Download PDF
                     </button>
                   </div>
                </motion.div>
              ))}
             </AnimatePresence>
          </div>
        )}
      </div>

      {/* Credit Score Right Column */}
      <div className="flex justify-center items-start lg:mt-0 h-full mt-4">
        <AICreditScore workerAddress={activeAddress} />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="glass-card p-6 rounded-2xl border border-white/5 flex gap-4 animate-pulse">
      <div className="w-12 h-12 bg-white/10 rounded-xl" />
      <div className="flex-1 space-y-3 py-1">
        <div className="h-4 bg-white/10 rounded w-1/3" />
        <div className="h-3 bg-white/10 rounded w-1/4" />
      </div>
    </div>
  );
}

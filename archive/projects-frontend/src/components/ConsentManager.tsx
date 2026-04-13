import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Check, X, ShieldCheck, History, Clock } from 'lucide-react';

export default function ConsentManager() {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState('90');
  const [loading, setLoading] = useState(false);

  const [consents, setConsents] = useState([
    { id: 1, inst: 'ABC Rural Finance', instAddr: '0x123...abc', purpose: 'Loan Assessment', expires: '2026-07-06', status: 'active' },
    { id: 2, inst: 'Govt Micro-SME Dept', instAddr: '0x456...def', purpose: 'Grant Verification', expires: '2026-10-01', status: 'active' },
  ]);

  const [logs] = useState([
    { date: '2026-04-07 10:23 AM', action: 'GRANT', to: 'ABC Rural Finance', txid: 'A1B2C...' },
    { date: '2026-04-01 14:15 PM', action: 'REVOKE', to: 'QuickLoan Corp', txid: 'D3E4F...' },
  ]);

  const handleGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !name) return;
    setLoading(true);
    setTimeout(() => {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(duration));
      
      setConsents([{
        id: Date.now(),
        inst: name,
        instAddr: address.substring(0,6) + '...' + address.substring(address.length-4),
        purpose: purpose || 'General Access',
        expires: d.toISOString().split('T')[0],
        status: 'active'
      }, ...consents]);
      
      setAddress('');
      setName('');
      setPurpose('');
      setLoading(false);
    }, 1000);
  };

  const handleRevoke = (id: number) => {
    setConsents(consents.map(c => c.id === id ? { ...c, status: 'revoked' } : c));
  };

  return (
    <div className="w-full flex justify-center py-6">
      <div className="w-full max-w-5xl space-y-6">

        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">DPDP Data Consent Manager</h2>
              <p className="text-sm text-slate-600 max-w-lg">
                Your verifiable work data belongs to you. Control which institutions can securely read your credentials and credit score on-chain.
              </p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-center shadow-lg w-full md:w-auto text-sm">
            <div className="text-slate-600 uppercase tracking-widest text-[10px] font-bold mb-1">Active Consents</div>
            <div className="text-2xl font-bold text-indigo-400 font-mono">{consents.filter(c => c.status === 'active').length}</div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Grant Form */}
          <div className="lg:col-span-5">
            <motion.form 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              onSubmit={handleGrant} className="glass-card p-6 rounded-2xl border border-white/5 h-full space-y-5 flex flex-col justify-between"
            >
               <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
                    <ShieldAlert size={18} className="text-indigo-400" /> Grant New Consent
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Institution Name</label>
                      <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-600 focus:border-indigo-500 transition-colors text-sm" placeholder="e.g. State Bank" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Institution Wallet Address</label>
                      <input required value={address} onChange={e => setAddress(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-600 focus:border-indigo-500 transition-colors text-sm font-mono placeholder:font-sans" placeholder="0x..." />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">Purpose of Access</label>
                      <input value={purpose} onChange={e => setPurpose(e.target.value)} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-600 focus:border-indigo-500 transition-colors text-sm" placeholder="Loan verification..." />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block flex justify-between">
                        Duration <span className="text-indigo-400">{duration} Days</span>
                      </label>
                      <input type="range" min="7" max="180" step="1" value={duration} onChange={e => setDuration(e.target.value)} className="w-full accent-indigo-500" />
                    </div>
                  </div>
               </div>

               <button type="submit" disabled={loading} className="glass-button w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-slate-900 font-medium py-3 rounded-xl border border-indigo-400/20 shadow-lg flex items-center justify-center gap-2 transition-all">
                 {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"/> : <><Check size={18} /> Authorize Access</>}
               </button>
            </motion.form>
          </div>

          {/* Active Lists */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
               className="glass-card p-6 rounded-2xl border border-white/5"
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Active Authorizations</h3>
              <div className="space-y-3">
                {consents.length === 0 ? (
                   <p className="text-slate-500 text-sm italic">No active consents found.</p>
                ) : consents.map((c) => (
                  <div key={c.id} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${c.status === 'active' ? 'bg-white/5 border-white/10 hover:border-indigo-500/30' : 'bg-transparent border-white/5 opacity-50 grayscale'}`}>
                     <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${c.status === 'active' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-500'}`}>
                           {c.inst.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-slate-900">{c.inst}</h4>
                            {c.status === 'revoked' && <span className="text-[10px] uppercase font-bold text-red-500 border border-red-500/20 px-1.5 rounded bg-red-500/10">REVOKED</span>}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 font-mono">{c.instAddr} • {c.purpose}</p>
                          <div className="text-[10px] text-indigo-300 mt-1 flex items-center gap-1"><Clock size={10}/> Expires {c.expires}</div>
                        </div>
                     </div>
                     
                     {c.status === 'active' && (
                       <button onClick={() => handleRevoke(c.id)} className="p-2 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500 hover:text-slate-900 transition-all" title="Revoke Access">
                          <X size={16} />
                       </button>
                     )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AUDIT LOG */}
            <motion.div 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
               className="glass-card p-6 rounded-2xl border border-white/5 bg-slate-950/40"
            >
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={16} /> Audit Trail</h3>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-[1px] before:w-[2px] before:bg-white/5">
                {logs.map((log, idx) => (
                  <div key={idx} className="relative flex gap-4 text-sm items-start">
                     <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-slate-950 ${log.action === 'GRANT' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                     <div className="bg-white/5 border border-white/5 p-3 rounded-xl w-full flex flex-col md:flex-row md:items-center justify-between gap-2 overflow-hidden group hover:bg-white/10 transition-colors">
                       <div>
                         <span className="text-xs text-slate-500 block mb-1">{log.date}</span>
                         <span className="text-slate-700">
                           <strong className={`${log.action === 'GRANT' ? 'text-emerald-400' : 'text-red-400'}`}>{log.action}</strong>
                           {' '}access to <span className="text-slate-900">{log.to}</span>
                         </span>
                       </div>
                       <div className="font-mono text-xs text-slate-500 group-hover:text-indigo-400 transition-colors px-2 py-1 bg-black/20 rounded cursor-copy">
                         Txid: {log.txid}
                       </div>
                     </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

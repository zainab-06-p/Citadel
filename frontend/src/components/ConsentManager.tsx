import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, History, Trash2, Plus, Clock, ExternalLink } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

interface Consent {
  id: string;
  institutionAddress: string;
  institutionName: string;
  scope: string;
  expiryDate: string;
}

interface AuditLog {
  id: string;
  date: string;
  action: 'Grant' | 'Revoke';
  institution: string;
  txid: string;
}

export function ConsentManager() {
  const { activeAddress } = useWallet();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);

  const [instAddress, setInstAddress] = useState('');
  const [instName, setInstName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState('30');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    const fetchConsentData = async () => {
      if (!activeAddress) return;
      setLoading(true);
      try {
        setConsents([
          { id: '1', institutionAddress: 'HDFC...', institutionName: 'HDFC Bank', scope: 'Loan Assessment', expiryDate: '2026-05-01' }
        ]);
        setLogs([
          { id: 'l1', date: '2026-04-01', action: 'Grant', institution: 'HDFC Bank', txid: 'ABC123XYZ' }
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConsentData();
  }, [activeAddress]);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instAddress || !instName || !purpose) return;
    setGranting(true);
    
    setTimeout(() => {
      const newConsent: Consent = {
        id: Date.now().toString(),
        institutionAddress: instAddress,
        institutionName: instName,
        scope: purpose,
        expiryDate: new Date(Date.now() + Number(duration) * 86400000).toISOString().split('T')[0]
      };
      
      const newLog: AuditLog = {
        id: 'l' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        action: 'Grant',
        institution: instName,
        txid: 'MOCK_TX_' + Date.now()
      };
      
      setConsents([...consents, newConsent]);
      setLogs([newLog, ...logs]);
      setGranting(false);
      setInstAddress(''); setInstName(''); setPurpose('');
    }, 1000);
  };

  const handleRevoke = (id: string, name: string) => {
    setConsents(consents.filter(c => c.id !== id));
    
    const newLog: AuditLog = {
      id: 'l' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      action: 'Revoke',
      institution: name,
      txid: 'MOCK_TX_' + Date.now()
    };
    setLogs([newLog, ...logs]);
  };

  if (!activeAddress) {
    return (
      <div className="text-center p-12 card border-dashed">
        <Shield className="w-12 h-12 text-white/40 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
        <p className="text-white/60">Connect to manage your data privacy settings.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#30d158]/10 rounded-xl border border-[#30d158]/20">
            <Shield className="text-[#30d158] w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">DPDP Consent Manager</h2>
            <p className="text-white/50 text-sm">Control who can access your Citadel credentials</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Grant Consent Form */}
        <div className="md:col-span-5 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Key size={18} className="text-[#0a84ff]" /> Grant Access
            </h3>
            
            <form onSubmit={handleGrant} className="space-y-4 text-sm">
              <div>
                <label className="text-white/50 mb-1 block">Institution Address</label>
                <input
                  type="text" required placeholder="ALG..."
                  className="input"
                  value={instAddress} onChange={e => setInstAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="text-white/50 mb-1 block">Institution Name</label>
                <input
                  type="text" required placeholder="e.g. HDFC Bank"
                  className="input"
                  value={instName} onChange={e => setInstName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-white/50 mb-1 block">Purpose (Scope)</label>
                <input
                  type="text" required placeholder="e.g. Loan Assessment"
                  className="input"
                  value={purpose} onChange={e => setPurpose(e.target.value)}
                />
              </div>
              <div>
                <label className="text-white/50 mb-1 block">Duration</label>
                <select
                  className="input"
                  value={duration} onChange={e => setDuration(e.target.value)}
                >
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">180 Days</option>
                </select>
              </div>
              <button
                type="submit" disabled={granting}
                className="w-full mt-2 bg-[#0a84ff] hover:bg-[#0a84ff]/80 text-white font-medium py-2.5 rounded-xl flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
              >
                {granting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div> : <Plus size={16} />}
                {granting ? 'Signing Tx...' : 'Grant Consent'}
              </button>
            </form>
          </div>
        </div>

        {/* Active Consents */}
        <div className="md:col-span-7 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield size={18} className="text-[#30d158]" /> Active Consents
            </h3>
            
            <div className="space-y-3">
              {consents.length === 0 ? (
                <p className="text-white/40 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">No active consents found.</p>
              ) : (
                <AnimatePresence>
                  {consents.map(c => (
                    <motion.div
                      key={c.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 20 }}
                      className="bg-white/5 border border-white/10 p-4 rounded-xl flex justify-between items-center group hover:border-white/30 transition-colors"
                    >
                      <div>
                        <h4 className="font-bold text-white">{c.institutionName}</h4>
                        <div className="flex gap-4 mt-1 text-xs text-white/50">
                          <span className="flex items-center gap-1"><Shield size={12}/> {c.scope}</span>
                          <span className="flex items-center gap-1"><Clock size={12}/> Expires: {c.expiryDate}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevoke(c.id, c.institutionName)}
                        className="btn-danger"
                      >
                        <Trash2 size={14} /> Revoke
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
          
          {/* Audit Log Toggle */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full p-4 flex justify-between items-center text-white/80 hover:bg-white/5 transition-colors"
            >
              <span className="flex items-center gap-2 font-bold"><History size={18} /> Audit Log (On-Chain)</span>
              <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/60 border border-white/5">{logs.length} entries</span>
            </button>
            <AnimatePresence>
              {showLogs && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 border-t border-white/10 pt-4">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-white/50 border-b border-white/10">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Action</th>
                          <th className="pb-2">Institution</th>
                          <th className="pb-2 text-right">Txid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {logs.map(log => (
                          <tr key={log.id} className="text-white/80 hover:bg-white/5">
                            <td className="py-2">{log.date}</td>
                            <td className="py-2">
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.action === 'Grant' ? 'bg-[#30d158]/10 text-[#30d158] border border-[#30d158]/20' : 'bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/20'}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="py-2">{log.institution}</td>
                            <td className="py-2 text-right">
                              <a href={`https://testnet.explorer.perawallet.app/tx/${log.txid}`} target="_blank" rel="noreferrer" className="text-[#0a84ff] hover:underline inline-flex items-center gap-1">
                                Tx <ExternalLink size={10} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

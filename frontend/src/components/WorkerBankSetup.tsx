import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Banknote, CheckCircle, IndianRupee, AlertCircle, Edit3 } from 'lucide-react';
import { useWallet } from '@txnlab/use-wallet-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

interface BankDetails {
  registered: boolean;
  paymentMode: string;
  upiId?: string;
  bankAccountNumber?: string;
  accountHolderName?: string;
  updatedAt?: string;
}

export function WorkerBankSetup() {
  const { activeAddress } = useWallet();

  const [mode, setMode] = useState<'UPI' | 'IMPS'>('UPI');
  const [upiId, setUpiId] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holderName, setHolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<BankDetails | null>(null);
  const [fetchingExisting, setFetchingExisting] = useState(true);
  const [editing, setEditing] = useState(false);

  // Load existing details
  useEffect(() => {
    const loadDetails = async () => {
      if (!activeAddress) return;
      setFetchingExisting(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/workers/${activeAddress}/bank-details`);
        const data = await res.json();
        if (data.success && data.data.registered) {
          setExisting(data.data);
          setMode(data.data.paymentMode || 'UPI');
        }
      } catch (e) {
        console.warn('Could not load bank details:', e);
      } finally {
        setFetchingExisting(false);
      }
    };
    loadDetails();
  }, [activeAddress]);

  const handleSave = async () => {
    if (!activeAddress) return;
    setError('');
    setLoading(true);

    // Basic validation
    if (mode === 'UPI' && !upiId.trim()) {
      setError('Please enter your UPI ID (e.g. name@paytm)');
      setLoading(false);
      return;
    }
    if (mode === 'IMPS' && (!accountNumber.trim() || !ifsc.trim())) {
      setError('Please enter both account number and IFSC code');
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, string> = {
        paymentMode: mode,
        accountHolderName: holderName.trim()
      };
      if (mode === 'UPI') {
        payload.upiId = upiId.trim();
      } else {
        payload.bankAccountNumber = accountNumber.trim();
        payload.bankIfsc = ifsc.trim().toUpperCase();
      }

      const res = await fetch(`${BACKEND_URL}/api/workers/${activeAddress}/bank-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save');

      setExisting({
        registered: true,
        paymentMode: mode,
        upiId: mode === 'UPI' ? upiId : undefined,
        bankAccountNumber: mode === 'IMPS' ? `****${accountNumber.slice(-4)}` : undefined,
        accountHolderName: holderName || undefined,
        updatedAt: new Date().toISOString()
      });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to save payment details');
    } finally {
      setLoading(false);
    }
  };

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center p-12 card text-center border-dashed">
        <Banknote className="text-white/40 w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
        <p className="text-white/60">Connect your wallet to register your UPI for INR payouts.</p>
      </div>
    );
  }

  // Show existing registered details (not editing)
  if (existing?.registered && !editing) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#30d158]/10 rounded-xl border border-[#30d158]/20">
                <CheckCircle className="text-[#30d158] w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Payment Details Registered</h2>
                <p className="text-white/50 text-sm">INR payouts will be sent here when milestones are approved</p>
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 text-sm text-[#0a84ff] hover:text-[#0a84ff]/80 transition-colors"
            >
              <Edit3 size={14} /> Edit
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Payment Mode</span>
              <span className="text-white font-semibold">{existing.paymentMode}</span>
            </div>
            {existing.upiId && (
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm">UPI ID</span>
                <span className="text-[#30d158] font-mono font-semibold">{existing.upiId}</span>
              </div>
            )}
            {existing.bankAccountNumber && (
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm">Account Number</span>
                <span className="text-white font-mono">{existing.bankAccountNumber}</span>
              </div>
            )}
            {existing.accountHolderName && (
              <div className="flex justify-between items-center">
                <span className="text-white/50 text-sm">Account Holder</span>
                <span className="text-white">{existing.accountHolderName}</span>
              </div>
            )}
          </div>

          <div className="bg-[#0a84ff]/10 border border-[#0a84ff]/20 rounded-xl p-3 flex items-start gap-2 text-sm text-[#0a84ff]/90">
            <IndianRupee size={14} className="shrink-0 mt-0.5" />
            <span>When a supervisor approves your milestone, the INR equivalent of your ALGO payment will be automatically sent to this {existing.paymentMode} ID.</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#ff9f0a]/10 rounded-xl border border-[#ff9f0a]/20">
            <Banknote className="text-[#ff9f0a] w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Register Payment Details</h2>
            <p className="text-white/50 text-sm">Required to receive INR payouts when milestones are approved</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          {(['UPI', 'IMPS'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {m === 'UPI' ? '📱 UPI (Recommended)' : '🏦 Bank Account'}
            </button>
          ))}
        </div>

        {/* UPI Form */}
        {mode === 'UPI' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/70 block mb-2">UPI ID *</label>
              <input
                type="text"
                className="input"
                placeholder="yourname@paytm or yourname@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <p className="text-xs text-white/40 mt-1">Accepts: @paytm, @phonepe, @gpay, @ybl, @oksbi, etc.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-white/70 block mb-2">Account Holder Name (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="Your full name"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Bank Form */}
        {mode === 'IMPS' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/70 block mb-2">Account Holder Name *</label>
              <input type="text" className="input" placeholder="Name as on bank account" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-white/70 block mb-2">Account Number *</label>
              <input type="text" className="input" placeholder="Bank account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-white/70 block mb-2">IFSC Code *</label>
              <input type="text" className="input" placeholder="e.g. SBIN0001234" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}

        {/* Success */}
        {saved && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 text-[#30d158] bg-[#30d158]/10 border border-[#30d158]/20 rounded-lg px-4 py-3 text-sm"
          >
            <CheckCircle size={16} />
            Payment details saved! You'll receive INR payouts when milestones are approved.
          </motion.div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full btn-primary py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white" />
              Saving...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <IndianRupee size={18} />
              {existing?.registered && editing ? 'Update Payment Details' : 'Save Payment Details'}
            </div>
          )}
        </button>

        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="w-full text-white/40 hover:text-white/60 text-sm transition-colors py-2"
          >
            Cancel
          </button>
        )}
      </motion.div>
    </div>
  );
}

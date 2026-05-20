import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, Award, Clock, Zap, RefreshCw, FileCheck, ExternalLink, CheckCircle } from 'lucide-react'
import algosdk from 'algosdk'

import { BACKEND_URL as BACKEND } from '../utils/getBackendUrl'
const ALGOD_URL = import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud'

const algodClient = new algosdk.Algodv2('', ALGOD_URL, '')

interface CreditProfile {
  totalVerifiedIncomeMicroAlgo: number
  milestoneCount: number
  consistencyScore: number
  creditLimitMicroAlgo: number
  creditLimitInr: number
  activeLoanId: number
  firstWorkRound: number
  lastWorkRound: number
}

function ScoreRing({ score }: { score: number }) {
  const radius       = 54
  const circumference = 2 * Math.PI * radius
  const offset       = circumference - (score / 100) * circumference
  const color        = score >= 75 ? '#30d158' : score >= 50 ? '#ffd60a' : '#ff453a'
  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
        <circle cx="72" cy="72" r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-3xl font-bold text-white">{score}</p>
        <p className="text-[10px] text-white/40 uppercase tracking-widest">Score</p>
      </div>
    </div>
  )
}

export function CreditProfileTab() {
  const { activeAddress, signTransactions } = useWallet()
  const [profile,    setProfile]    = useState<CreditProfile | null>(null)
  const [registered, setRegistered] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [txid,       setTxid]       = useState('')

  // Register form
  const [assetId, setAssetId] = useState('')
  const [income,  setIncome]  = useState('')
  const [signing, setSigning] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!activeAddress) return
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${BACKEND}/api/credit-oracle/profile/${activeAddress}`)
      const data = await res.json()
      if (data.success) { setRegistered(data.registered); setProfile(data.profile) }
    } catch { setError('Failed to fetch profile') }
    finally  { setLoading(false) }
  }, [activeAddress])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function handleRegister() {
    if (!activeAddress || !assetId || !income || !signTransactions) return
    setSigning(true); setError(''); setTxid('')
    try {
      // 1. Backend builds unsigned txn
      const res  = await fetch(`${BACKEND}/api/credit-oracle/register-credential`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerAddress:         activeAddress,
          credentialAssetId:     parseInt(assetId),
          incomeAmountMicroAlgo: Math.round(parseFloat(income) * 100_000),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Build failed')

      // 2. Decode unsigned txn bytes
      const txnBytes = new Uint8Array(Buffer.from(data.unsignedTxn, 'base64'))

      // 3. Sign with wallet
      const signed = await signTransactions([txnBytes])
      const validSigned = signed.filter((s): s is Uint8Array => s !== null)

      // 4. Compute txId locally BEFORE submitting
      const confirmedTxId = algosdk.decodeSignedTransaction(validSigned[0]).txn.txID()

      // 5. Submit to Algorand
      await algodClient.sendRawTransaction(validSigned).do()

      // 6. Wait for confirmation
      await algosdk.waitForConfirmation(algodClient, confirmedTxId, 6)

      setTxid(confirmedTxId)
      await fetchProfile()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg.includes('user rejected') ? 'Transaction rejected in wallet' : msg)
    } finally {
      setSigning(false)
    }
  }

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <TrendingUp size={28} className="text-white/30" />
        </div>
        <p className="text-white/40 text-sm">Connect your wallet to view your credit profile</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">On-Chain Credit Profile</h3>
          <p className="text-sm text-white/40 mt-1">App ID: <span className="font-mono text-[#0a84ff]">{import.meta.env.VITE_CREDIT_ORACLE_APP_ID}</span></p>
        </div>
        <button onClick={fetchProfile} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-sm transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

      {txid && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={14} /> Credential registered on-chain!</div>
          <a href={`https://lora.algokit.io/testnet/transaction/${txid}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
            View <ExternalLink size={11} />
          </a>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : registered && profile ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
            <ScoreRing score={profile.consistencyScore} />
            <p className="text-sm font-medium text-white/60">Consistency Score</p>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: 'Credit Limit', value: `₹${profile.creditLimitInr.toLocaleString()}`, icon: Award,     color: '#30d158' },
              { label: 'Milestones',  value: profile.milestoneCount.toString(),              icon: FileCheck,  color: '#0a84ff' },
              { label: 'Total Income',value: `₹${Math.floor(profile.totalVerifiedIncomeMicroAlgo / 100_000).toLocaleString()}`, icon: TrendingUp, color: '#ffd60a' },
              { label: 'Active Loan', value: profile.activeLoanId === 0 ? 'None' : `#${profile.activeLoanId}`, icon: Zap, color: '#bf5af2' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color }} /><p className="text-xs text-white/40 uppercase tracking-wider">{label}</p></div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
          <div>
            <h4 className="text-base font-semibold text-white mb-1">Register WorkProof Credential</h4>
            <p className="text-sm text-white/40">Enter your milestone ASA ID and income amount. Pera Wallet will open to sign the transaction on Algorand.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Credential ASA ID</label>
              <input type="number" value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="e.g. 758015705"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30" />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Income Amount (₹)</label>
              <input type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 5000"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30" />
            </div>
          </div>
          <button onClick={handleRegister} disabled={signing || !assetId || !income}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {signing ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Waiting for Wallet...</> : 'Register Credential — Sign in Pera'}
          </button>
          <p className="text-xs text-white/30 text-center">Pera Wallet will open automatically. Fee: 0.002 ALGO</p>
        </div>
      )}
    </div>
  )
}

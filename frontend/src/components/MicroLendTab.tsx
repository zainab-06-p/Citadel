import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useEffect, useCallback } from 'react'
import { Coins, ArrowDownCircle, ArrowUpCircle, RefreshCw, Landmark, ExternalLink, CheckCircle } from 'lucide-react'
import algosdk from 'algosdk'

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const ALGOD_URL = import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud'
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '')

const STATUS_COLORS: Record<number, string> = { 0: 'text-white/30', 1: 'text-[#ffd60a]', 2: 'text-[#30d158]', 3: 'text-[#ff453a]' }
const STATUS_LABELS: Record<number, string> = { 0: 'No Loan', 1: 'Active', 2: 'Repaid', 3: 'Defaulted' }

interface LoanState {
  depositMicroAlgo: number; depositInr: number
  loanAmountMicroAlgo: number; loanAmountInr: number
  repaidMicroAlgo: number; loanStatus: number
  disbursedRound: number; interestRateBps: number
}

async function signAndSubmit(
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>,
  txnsB64: string[]
): Promise<string> {
  const txnBytes   = txnsB64.map(b => new Uint8Array(Buffer.from(b, 'base64')))
  const signed     = await signTransactions(txnBytes)
  const validSigned = signed.filter((s): s is Uint8Array => s !== null)

  // Compute txId LOCALLY from the first signed txn — avoids API response key ambiguity
  const txId = algosdk.decodeSignedTransaction(validSigned[0]).txn.txID()

  await algodClient.sendRawTransaction(validSigned).do()
  await algosdk.waitForConfirmation(algodClient, txId, 6)
  return txId
}

export function MicroLendTab() {
  const { activeAddress, signTransactions } = useWallet()
  const [state,     setState]     = useState<LoanState | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [signing,   setSigning]   = useState(false)
  const [error,     setError]     = useState('')
  const [txid,      setTxid]      = useState('')
  const [loanAmt,   setLoanAmt]   = useState('')
  const [repayAmt,  setRepayAmt]  = useState('')
  const [depositAmt,setDepositAmt]= useState('')
  const [activeTab, setActiveTab] = useState<'borrow' | 'repay' | 'deposit'>('borrow')

  const fetchState = useCallback(async () => {
    if (!activeAddress) return
    setLoading(true)
    try {
      const res  = await fetch(`${BACKEND}/api/micro-lend/state/${activeAddress}`)
      const data = await res.json()
      if (data.success) setState(data.state)
    } catch { setError('Failed to fetch state') }
    finally  { setLoading(false) }
  }, [activeAddress])

  useEffect(() => { fetchState() }, [fetchState])

  async function handleBorrow() {
    if (!activeAddress || !loanAmt || !signTransactions) return
    setSigning(true); setError(''); setTxid('')
    try {
      const res  = await fetch(`${BACKEND}/api/micro-lend/request-loan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerAddress:  activeAddress,
          amount:           Math.round(parseFloat(loanAmt) * 1_000_000),
          consistencyScore: 50,
          creditLimit:      Math.round(parseFloat(loanAmt) * 1_000_000),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const id = await signAndSubmit(signTransactions, [data.unsignedTxn])
      setTxid(id); await fetchState()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg.includes('rejected') ? 'Rejected in wallet' : msg)
    } finally { setSigning(false) }
  }

  async function handleRepay() {
    if (!activeAddress || !repayAmt || !signTransactions) return
    setSigning(true); setError(''); setTxid('')
    try {
      const res  = await fetch(`${BACKEND}/api/micro-lend/repay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerAddress: activeAddress, repaymentMicroAlgo: Math.round(parseFloat(repayAmt) * 1_000_000) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      // Grouped txn: payTxn + appTxn — sign both together
      const id = await signAndSubmit(signTransactions, [data.payTxn, data.appTxn])
      setTxid(id); await fetchState()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg.includes('rejected') ? 'Rejected in wallet' : msg)
    } finally { setSigning(false) }
  }

  async function handleDeposit() {
    if (!activeAddress || !depositAmt || !signTransactions) return
    setSigning(true); setError(''); setTxid('')
    try {
      const res  = await fetch(`${BACKEND}/api/micro-lend/deposit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lenderAddress: activeAddress, amountMicroAlgo: Math.round(parseFloat(depositAmt) * 1_000_000) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const id = await signAndSubmit(signTransactions, [data.payTxn, data.appTxn])
      setTxid(id); await fetchState()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg.includes('rejected') ? 'Rejected in wallet' : msg)
    } finally { setSigning(false) }
  }

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Landmark size={32} className="text-white/20 mb-4" />
        <p className="text-white/40 text-sm">Connect your wallet to access the lending pool</p>
      </div>
    )
  }

  const inputCls = "w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30"
  const btnCls   = "w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">MicroLend Pool</h3>
          <p className="text-xs text-white/40 mt-1">App ID: <span className="font-mono text-[#0a84ff]">{import.meta.env.VITE_MICROLEND_APP_ID}</span> · Real ALGO moves on Testnet</p>
        </div>
        <button onClick={fetchState} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/60 text-xs transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
      {txid && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={14} /> Transaction confirmed on-chain!</div>
          <a href={`https://lora.algokit.io/testnet/transaction/${txid}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white"><ExternalLink size={11} /></a>
        </div>
      )}

      {/* State cards */}
      {state && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Your Deposit</p>
            <p className="text-xl font-bold text-white">₹{state.depositInr.toLocaleString()}</p>
            <p className="text-xs text-white/30 mt-0.5">{(state.depositMicroAlgo / 1_000_000).toFixed(4)} ALGO</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Loan Amount</p>
            <p className="text-xl font-bold text-white">₹{state.loanAmountInr.toLocaleString()}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Status</p>
            <p className={`text-xl font-bold ${STATUS_COLORS[state.loanStatus] ?? 'text-white/30'}`}>
              {STATUS_LABELS[state.loanStatus] ?? 'Unknown'}
            </p>
          </div>
        </div>
      )}

      {/* Action tabs */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/10">
          {(['borrow', 'repay', 'deposit'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 text-sm font-medium transition-all ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {tab === 'borrow'  && <ArrowDownCircle size={14} className="inline mr-1.5" />}
              {tab === 'repay'   && <ArrowUpCircle   size={14} className="inline mr-1.5" />}
              {tab === 'deposit' && <Coins            size={14} className="inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="p-6 space-y-4">
          {activeTab === 'borrow' && (
            <>
              <p className="text-sm text-white/50">Borrow ALGO from the pool. Pera Wallet will open to sign on Algorand Testnet.</p>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Amount (ALGO)</label>
                <input type="number" value={loanAmt} onChange={e => setLoanAmt(e.target.value)} placeholder="e.g. 0.1" className={inputCls} />
                {loanAmt && <p className="text-xs text-white/30 mt-1.5">≈ ₹{(parseFloat(loanAmt || '0') * 10).toFixed(0)}</p>}
              </div>
              <button onClick={handleBorrow} disabled={signing || !loanAmt} className={btnCls}>
                {signing ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Waiting for Wallet...</> : 'Request Loan — Sign in Pera'}
              </button>
            </>
          )}
          {activeTab === 'repay' && (
            <>
              <p className="text-sm text-white/50">Repay your loan. A grouped transaction (payment + app call) will be signed together in Pera.</p>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Amount (ALGO)</label>
                <input type="number" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} placeholder="e.g. 0.1" className={inputCls} />
              </div>
              <button onClick={handleRepay} disabled={signing || !repayAmt || state?.loanStatus !== 1} className={btnCls}>
                {signing ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Signing...</> : 'Repay Loan — Sign in Pera'}
              </button>
              {state?.loanStatus !== 1 && <p className="text-xs text-white/30 text-center">No active loan to repay</p>}
            </>
          )}
          {activeTab === 'deposit' && (
            <>
              <p className="text-sm text-white/50">Deposit ALGO into the pool. Real ALGO moves from your wallet to the MicroLend contract on Testnet.</p>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Amount (ALGO)</label>
                <input type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} placeholder="e.g. 0.5" className={inputCls} />
                {depositAmt && <p className="text-xs text-white/30 mt-1.5">≈ ₹{(parseFloat(depositAmt || '0') * 10).toFixed(0)}</p>}
              </div>
              <button onClick={handleDeposit} disabled={signing || !depositAmt} className={btnCls}>
                {signing ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Waiting for Wallet...</> : 'Deposit Liquidity — Sign in Pera'}
              </button>
              <p className="text-xs text-white/30 text-center">ALGO goes to contract: {import.meta.env.VITE_MICROLEND_APP_ID}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

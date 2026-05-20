import { useWallet } from '@txnlab/use-wallet-react'
import { useState, useCallback } from 'react'
import { FileText, Lock, Search, ExternalLink, CheckCircle } from 'lucide-react'
import algosdk from 'algosdk'

const BACKEND   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const ALGOD_URL = import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud'
const algodClient = new algosdk.Algodv2('', ALGOD_URL, '')

async function signAndSubmit(
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>,
  txnsB64: string[]
): Promise<string> {
  const txnBytes    = txnsB64.map(b => new Uint8Array(Buffer.from(b, 'base64')))
  const signed      = await signTransactions(txnBytes)
  const validSigned = signed.filter((s): s is Uint8Array => s !== null)

  // Compute txId LOCALLY — avoids txId=undefined from API response
  const txId = algosdk.decodeSignedTransaction(validSigned[0]).txn.txID()

  await algodClient.sendRawTransaction(validSigned).do()
  await algosdk.waitForConfirmation(algodClient, txId, 6)
  return txId
}

interface InvoiceState {
  invoiceAmountInr: string
  dueDate: number
  pledgedToApp: number
  settled: boolean
}

export function InvoiceGuardTab() {
  const { activeAddress, signTransactions } = useWallet()
  const [signing,   setSigning]   = useState(false)
  const [error,     setError]     = useState('')
  const [txid,      setTxid]      = useState('')
  const [mintedId,  setMintedId]  = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'tokenize' | 'pledge' | 'lookup'>('tokenize')

  // Tokenize form
  const [invoiceName,   setInvoiceName]   = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [dueDate,       setDueDate]       = useState('')

  // Pledge form
  const [pledgeAssetId, setPledgeAssetId] = useState('')

  // Lookup
  const [lookupId,      setLookupId]      = useState('')
  const [invoiceState,  setInvoiceState]  = useState<InvoiceState | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  const clearStatus = () => { setError(''); setTxid('') }

  async function handleTokenize() {
    if (!activeAddress || !invoiceName || !invoiceAmount || !signTransactions) return
    setSigning(true); clearStatus()
    try {
      const dueDateUnix = dueDate
        ? Math.floor(new Date(dueDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 86400
      const amountPaise = Math.round(parseFloat(invoiceAmount) * 100)

      // --- Step 1: Tokenize (creates ASA, no box writes) ---
      const res1  = await fetch(`${BACKEND}/api/invoice-guard/tokenize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorAddress: activeAddress, invoiceName,
          invoiceAmountPaise: amountPaise, dueDateUnix, metadataUrl: '' }),
      })
      const data1 = await res1.json()
      if (!data1.success) throw new Error(data1.error)

      const txnBytes1   = new Uint8Array(Buffer.from(data1.unsignedTxn, 'base64'))
      const signed1     = await signTransactions([txnBytes1])
      const valid1      = signed1.filter((s): s is Uint8Array => s !== null)
      const txId1       = algosdk.decodeSignedTransaction(valid1[0]).txn.txID()
      await algodClient.sendRawTransaction(valid1).do()
      // waitForConfirmation returns the full confirmed txn — includes inner-txns with asset-index
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const confirmed: any = await algosdk.waitForConfirmation(algodClient, txId1, 6)

      // algosdk v2 returns BigInt for all uint64 fields — must use Number() to convert
      const innerTxns: any[] = confirmed['inner-txns'] ?? confirmed['innerTxns'] ?? []
      const rawId =
        innerTxns[0]?.['asset-index'] ??
        innerTxns[0]?.['assetIndex']  ??
        confirmed['asset-index']      ??
        null

      const asaId: number = rawId !== null ? Number(rawId) : 0

      // BigInt-safe log (JSON.stringify crashes on BigInt)
      console.log('[InvoiceGuard] inner-txns count:', innerTxns.length)
      console.log('[InvoiceGuard] rawId:', rawId, '→ asaId:', asaId)

      if (!asaId) throw new Error('ASA ID not found — check browser console for inner-txns data')
      setMintedId(asaId)
      setPledgeAssetId(String(asaId))

      // --- Step 2: Register (writes boxes with known ASA ID) ---
      const res2  = await fetch(`${BACKEND}/api/invoice-guard/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorAddress: activeAddress, invoiceAssetId: asaId,
          invoiceAmountPaise: amountPaise, dueDateUnix }),
      })
      const data2 = await res2.json()
      if (!data2.success) throw new Error(data2.error)

      const txnBytes2 = new Uint8Array(Buffer.from(data2.unsignedTxn, 'base64'))
      const signed2   = await signTransactions([txnBytes2])
      const valid2    = signed2.filter((s): s is Uint8Array => s !== null)
      const txId2     = algosdk.decodeSignedTransaction(valid2[0]).txn.txID()
      await algodClient.sendRawTransaction(valid2).do()
      await algosdk.waitForConfirmation(algodClient, txId2, 6)

      setTxid(txId2)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg.includes('rejected') ? 'Rejected in wallet' : msg)
    } finally { setSigning(false) }
  }

  async function handlePledge() {
    if (!activeAddress || !pledgeAssetId || !signTransactions) return
    setSigning(true); clearStatus()
    try {
      const res  = await fetch(`${BACKEND}/api/invoice-guard/pledge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorAddress: activeAddress, invoiceAssetId: parseInt(pledgeAssetId) }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const id = await signAndSubmit(signTransactions, [data.unsignedTxn])
      setTxid(id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      setError(msg.includes('rejected') ? 'Rejected in wallet' : msg)
    } finally { setSigning(false) }
  }

  const handleLookup = useCallback(async () => {
    if (!lookupId) return
    setLookupLoading(true); setInvoiceState(null); setError('')
    try {
      const res  = await fetch(`${BACKEND}/api/invoice-guard/invoice/${lookupId}`)
      const data = await res.json()
      if (data.success) setInvoiceState(data.invoice)
      else setError('Invoice not found on-chain')
    } catch { setError('Lookup failed') }
    finally  { setLookupLoading(false) }
  }, [lookupId])

  if (!activeAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText size={32} className="text-white/20 mb-4" />
        <p className="text-white/40 text-sm">Connect your wallet to tokenize invoices</p>
      </div>
    )
  }

  const inputCls = "w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30"
  const btnCls   = "w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-white">InvoiceGuard — RWA Tokenization</h3>
        <p className="text-xs text-white/40 mt-1">App ID: <span className="font-mono text-[#0a84ff]">{import.meta.env.VITE_INVOICE_GUARD_APP_ID}</span> · GST invoice → frozen ASA on Algorand</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

      {txid && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={14} /> Transaction confirmed!</div>
            <a href={`https://lora.algokit.io/testnet/transaction/${txid}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white">View <ExternalLink size={11} /></a>
          </div>
          {mintedId && (
            <div className="bg-white/5 rounded-lg px-3 py-2 text-sm">
              <span className="text-white/40">Invoice ASA ID: </span>
              <span className="font-mono text-[#0a84ff] font-bold">{mintedId}</span>
              <span className="text-white/30 ml-2 text-xs">— save this to pledge as collateral</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/10">
          {(['tokenize', 'pledge', 'lookup'] as const).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); clearStatus() }}
              className={`flex-1 py-3.5 text-sm font-medium transition-all ${activeTab === tab ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {tab === 'tokenize' && <FileText size={13} className="inline mr-1.5" />}
              {tab === 'pledge'   && <Lock     size={13} className="inline mr-1.5" />}
              {tab === 'lookup'   && <Search   size={13} className="inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">

          {activeTab === 'tokenize' && (
            <>
              <p className="text-sm text-white/50">
                Mint a frozen NFT (ASA) on Algorand representing your GST invoice.
                Pera Wallet will pop open — the contract creates the ASA with an inner transaction.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Invoice Number</label>
                  <input type="text" value={invoiceName} onChange={e => setInvoiceName(e.target.value)}
                    placeholder="INV-2024-001" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Invoice Amount (₹)</label>
                  <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value)}
                    placeholder="e.g. 50000" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Due Date (optional)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <button onClick={handleTokenize} disabled={signing || !invoiceName || !invoiceAmount} className={btnCls}>
                {signing
                  ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Waiting for Wallet (2 signatures)...</>
                  : 'Tokenize Invoice as NFT — Sign Twice in Wallet'}
              </button>
              <p className="text-xs text-white/30 text-center">Fee: ~0.003 ALGO (includes inner ASA creation). You receive a frozen NFT in your wallet.</p>
            </>
          )}

          {activeTab === 'pledge' && (
            <>
              <p className="text-sm text-white/50">
                Lock a tokenized invoice as collateral. This increases your borrowing power in MicroLendPool.
                Sign in Pera to pledge on Algorand.
              </p>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Invoice ASA ID</label>
                <input type="number" value={pledgeAssetId} onChange={e => setPledgeAssetId(e.target.value)}
                  placeholder="ASA ID from tokenized invoice" className={inputCls} />
                {mintedId && pledgeAssetId === String(mintedId) && (
                  <p className="text-xs text-green-400/60 mt-1.5">Auto-filled from your just-minted invoice</p>
                )}
              </div>
              <button onClick={handlePledge} disabled={signing || !pledgeAssetId} className={btnCls}>
                {signing
                  ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Signing...</>
                  : 'Pledge as Collateral — Sign in Pera'}
              </button>
            </>
          )}

          {activeTab === 'lookup' && (
            <>
              <p className="text-sm text-white/50">Look up the on-chain state of any tokenized invoice by its ASA ID.</p>
              <div className="flex gap-3">
                <input type="number" value={lookupId} onChange={e => setLookupId(e.target.value)}
                  placeholder="Invoice ASA ID" className={inputCls} />
                <button onClick={handleLookup} disabled={lookupLoading || !lookupId}
                  className="px-5 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-40 shrink-0">
                  {lookupLoading ? '...' : 'Lookup'}
                </button>
              </div>
              {invoiceState && (
                <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-white/40">Invoice Amount</span><span className="text-white font-semibold">₹{invoiceState.invoiceAmountInr}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Status</span>
                    <span className={invoiceState.settled ? 'text-[#30d158] font-medium' : invoiceState.pledgedToApp ? 'text-[#ffd60a] font-medium' : 'text-white/50'}>
                      {invoiceState.settled ? 'Settled' : invoiceState.pledgedToApp ? `Pledged to App ${invoiceState.pledgedToApp}` : 'Free (not pledged)'}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-white/40">Due Date</span>
                    <span className="text-white/70">{invoiceState.dueDate ? new Date(invoiceState.dueDate * 1000).toLocaleDateString('en-IN') : 'Not set'}</span>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

/**
 * invoiceGuardService.js
 * =======================
 * Reads InvoiceGuard BoxMap state and builds txns with proper box references.
 * App ID 761438115 — deployed on testnet.
 *
 * BoxMap prefixes (UInt64 assetId → UInt64):
 *   IA = invoice_amount    ID = due_date
 *   IP = pledged_to_app    IS = settled
 *
 * Box key = prefix_bytes (2 bytes) + asset_id_bytes (8 bytes big-endian) = 10 bytes
 */
const algosdk = require('algosdk');

const ALGOD_SERVER = process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN  = process.env.ALGORAND_TOKEN  || '';
const ALGOD_PORT   = process.env.ALGORAND_PORT   || 443;

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

const INVOICE_GUARD_APP_ID = parseInt(process.env.INVOICE_GUARD_APP_ID || '0', 10);

/** Build 10-byte box key: prefix (2 bytes) + assetId (8 bytes big-endian) */
function invoiceBoxKey(prefix, assetId) {
  const prefixBuf  = Buffer.from(prefix, 'utf8');          // 2 bytes e.g. "IA"
  const assetIdBuf = Buffer.alloc(8);
  assetIdBuf.writeBigUInt64BE(BigInt(assetId));
  return Buffer.concat([prefixBuf, assetIdBuf]);
}

/** All 4 BoxMap prefixes for an invoice ASA */
const INVOICE_PREFIXES = ['IA', 'ID', 'IP', 'IS'];

function invoiceBoxes(assetId) {
  return INVOICE_PREFIXES.map(p => ({
    appIndex: 0,
    name: new Uint8Array(invoiceBoxKey(p, assetId)),  // explicit Uint8Array
  }));
}

async function readInvoiceBox(prefix, assetId) {
  try {
    const key  = invoiceBoxKey(prefix, assetId);
    const resp = await algodClient.getApplicationBoxByName(INVOICE_GUARD_APP_ID, key).do();
    return Number(Buffer.from(resp.value, 'base64').readBigUInt64BE(0));
  } catch (err) {
    if (err?.status === 404 || (err?.message && err.message.includes('404'))) return null;
    return null;
  }
}

async function getInvoiceState(assetId) {
  if (!INVOICE_GUARD_APP_ID) return null;
  const [amount, due, pledged, settled] = await Promise.all([
    readInvoiceBox('IA', assetId),
    readInvoiceBox('ID', assetId),
    readInvoiceBox('IP', assetId),
    readInvoiceBox('IS', assetId),
  ]);
  if (amount === null) return null;
  return {
    invoiceAmountPaise: amount,
    invoiceAmountInr:   (amount / 100).toFixed(2),
    dueDate:            due ?? 0,
    pledgedToApp:       pledged ?? 0,
    settled:            (settled ?? 0) === 1,
  };
}

/** ABI-encode string: 2-byte big-endian length + utf8 bytes, returned as Uint8Array */
function encodeABIString(str) {
  const buf = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(buf.length);
  return new Uint8Array(Buffer.concat([len, buf]));  // ★ explicit Uint8Array
}

/**
 * tokenize_invoice(string,uint64,uint64,string)uint64
 * Box references needed for all 4 invoice box entries.
 * Uses a placeholder ASA ID (0) for boxes since real ID is created inside the txn.
 * We include a large-enough budget via fee.
 */
async function buildTokenizeInvoiceTxn({
  contractorAddress,
  invoiceName,
  invoiceAmountPaise,
  dueDateUnix,
  metadataUrl,
}) {
  if (!INVOICE_GUARD_APP_ID) throw new Error('INVOICE_GUARD_APP_ID not configured');

  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('tokenize_invoice(string,uint64,uint64,string)uint64');

  // For tokenize, the ASA ID isn't known yet (created inside the contract).
  // We pass generic box references using a placeholder; the contract only writes AFTER creation.
  // Use 4 placeholder boxes with name lengths that budget the box memory.
  // tokenize_invoice has NO box writes — ASA ID unknown until inner txn executes
  // No boxes array needed
  const txn = algosdk.makeApplicationCallTxnFromObject({
    from:         contractorAddress,
    appIndex:     INVOICE_GUARD_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      new Uint8Array(methodSig.getSelector()),
      encodeABIString(invoiceName),
      new Uint8Array(algosdk.encodeUint64(invoiceAmountPaise)),
      new Uint8Array(algosdk.encodeUint64(dueDateUnix)),
      encodeABIString(metadataUrl || ''),
    ],
    suggestedParams: { ...params, fee: 5000, flatFee: true },
  });

  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

/**
 * register_invoice(uint64,uint64,uint64)void
 * Step 2: write box data after tokenize — ASA ID now known.
 */
async function buildRegisterInvoiceTxn({ contractorAddress, invoiceAssetId, invoiceAmountPaise, dueDateUnix }) {
  if (!INVOICE_GUARD_APP_ID) throw new Error('INVOICE_GUARD_APP_ID not configured');

  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('register_invoice(uint64,uint64,uint64)void');

  const txn = algosdk.makeApplicationCallTxnFromObject({
    from:         contractorAddress,
    appIndex:     INVOICE_GUARD_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      new Uint8Array(methodSig.getSelector()),
      new Uint8Array(algosdk.encodeUint64(invoiceAssetId)),
      new Uint8Array(algosdk.encodeUint64(invoiceAmountPaise)),
      new Uint8Array(algosdk.encodeUint64(dueDateUnix)),
    ],
    foreignAssets: [invoiceAssetId],          // needed for AssetHoldingGet check
    // ★ Box references — ASA ID is now KNOWN so keys are correct
    boxes: invoiceBoxes(invoiceAssetId),
    suggestedParams: { ...params, fee: 2000, flatFee: true },
  });

  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

/**
 * pledge_as_collateral(uint64,uint64)void
 */
async function buildPledgeTxn({ contractorAddress, invoiceAssetId, workproofAppId }) {
  if (!INVOICE_GUARD_APP_ID) throw new Error('INVOICE_GUARD_APP_ID not configured');

  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('pledge_as_collateral(uint64,uint64)void');

  const txn = algosdk.makeApplicationCallTxnFromObject({
    from:         contractorAddress,
    appIndex:     INVOICE_GUARD_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      new Uint8Array(methodSig.getSelector()),
      new Uint8Array(algosdk.encodeUint64(invoiceAssetId)),
      new Uint8Array(algosdk.encodeUint64(workproofAppId || parseInt(process.env.WORKPROOF_APP_ID || '0', 10))),
    ],
    // ★ Box references for the specific invoice ASA
    boxes: invoiceBoxes(invoiceAssetId),
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  });

  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

module.exports = {
  getInvoiceState,
  buildTokenizeInvoiceTxn,
  buildRegisterInvoiceTxn,
  buildPledgeTxn,
  INVOICE_GUARD_APP_ID: () => INVOICE_GUARD_APP_ID,
};

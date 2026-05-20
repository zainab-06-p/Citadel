/**
 * microLendService.js
 * ====================
 * Reads MicroLendPool BoxMap state and builds txns with proper box references.
 * App ID 761438105 — deployed on testnet.
 *
 * BoxMap prefixes (Account → UInt64):
 *   D = deposit     A = loan_amount   R = loan_repaid
 *   S = loan_status B = disbursed_round  I = interest_rate_bps
 */
const algosdk = require('algosdk');

const ALGOD_SERVER = process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN  = process.env.ALGORAND_TOKEN  || '';
const ALGOD_PORT   = process.env.ALGORAND_PORT   || 443;

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

const MICROLEND_APP_ID = parseInt(process.env.MICROLEND_APP_ID || '0', 10);

/** Build 33-byte box key: prefix + account_public_key */
function boxKey(prefix, address) {
  const decoded = algosdk.decodeAddress(address);
  return Buffer.concat([Buffer.from(prefix, 'utf8'), Buffer.from(decoded.publicKey)]);
}

/** All 6 BoxMap prefixes for a MicroLend account */
const MICROLEND_PREFIXES = ['D', 'A', 'R', 'S', 'B', 'I'];

function accountBoxes(address) {
  return MICROLEND_PREFIXES.map(p => ({
    appIndex: 0,
    name: new Uint8Array(boxKey(p, address)),  // explicit Uint8Array
  }));
}

async function readBoxUInt64(prefix, address) {
  try {
    const key  = boxKey(prefix, address);
    const resp = await algodClient.getApplicationBoxByName(MICROLEND_APP_ID, key).do();
    return Number(Buffer.from(resp.value, 'base64').readBigUInt64BE(0));
  } catch (err) {
    if (err?.status === 404 || (err?.message && err.message.includes('404'))) return null;
    return null;
  }
}

async function getAccountState(address) {
  if (!MICROLEND_APP_ID) return null;
  const [dep, la, lr, ls, ldr, lir] = await Promise.all([
    readBoxUInt64('D', address),
    readBoxUInt64('A', address),
    readBoxUInt64('R', address),
    readBoxUInt64('S', address),
    readBoxUInt64('B', address),
    readBoxUInt64('I', address),
  ]);
  return {
    depositMicroAlgo:    dep ?? 0,
    depositInr:          Math.floor((dep ?? 0) / 100_000),
    loanAmountMicroAlgo: la  ?? 0,
    loanAmountInr:       Math.floor((la  ?? 0) / 100_000),
    repaidMicroAlgo:     lr  ?? 0,
    loanStatus:          ls  ?? 0,
    disbursedRound:      ldr ?? 0,
    interestRateBps:     lir ?? 0,
  };
}

/**
 * deposit_liquidity(pay)void
 * Grouped: [PayTxn → appAddress] + [AppCall with box refs]
 */
async function buildDepositTxn({ lenderAddress, amountMicroAlgo }) {
  if (!MICROLEND_APP_ID) throw new Error('MICROLEND_APP_ID not configured');

  const appAddr   = process.env.MICROLEND_APP_ADDRESS;
  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('deposit_liquidity(pay)void');

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from:            lenderAddress,
    to:              appAddr,
    amount:          amountMicroAlgo,
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  });

  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    from:         lenderAddress,
    appIndex:     MICROLEND_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs:      [new Uint8Array(methodSig.getSelector())],
    // ★ Box references for lender's 6 entries
    boxes: accountBoxes(lenderAddress),
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  });

  algosdk.assignGroupID([payTxn, appTxn]);

  return {
    payTxn: Buffer.from(algosdk.encodeUnsignedTransaction(payTxn)).toString('base64'),
    appTxn: Buffer.from(algosdk.encodeUnsignedTransaction(appTxn)).toString('base64'),
  };
}

/**
 * request_loan(uint64,uint64,uint64,uint64)uint64
 */
async function buildRequestLoanTxn({ borrowerAddress, amount, consistencyScore, creditLimit }) {
  if (!MICROLEND_APP_ID) throw new Error('MICROLEND_APP_ID not configured');

  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('request_loan(uint64,uint64,uint64,uint64)uint64');
  const oracleId  = parseInt(process.env.CREDIT_ORACLE_APP_ID || '0', 10);

  const txn = algosdk.makeApplicationCallTxnFromObject({
    from:         borrowerAddress,
    appIndex:     MICROLEND_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      new Uint8Array(methodSig.getSelector()),
      new Uint8Array(algosdk.encodeUint64(amount)),
      new Uint8Array(algosdk.encodeUint64(consistencyScore)),
      new Uint8Array(algosdk.encodeUint64(creditLimit)),
      new Uint8Array(algosdk.encodeUint64(oracleId)),
    ],
    foreignApps: oracleId ? [oracleId] : [],
    // ★ Box references for borrower's 6 entries
    boxes: accountBoxes(borrowerAddress),
    suggestedParams: { ...params, fee: 3000, flatFee: true }, // extra fee for inner payment txn
  });

  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

/**
 * repay_loan(pay)bool
 * Grouped: [PayTxn → appAddress] + [AppCall with box refs]
 */
async function buildRepayLoanTxn({ borrowerAddress, repaymentMicroAlgo }) {
  if (!MICROLEND_APP_ID) throw new Error('MICROLEND_APP_ID not configured');

  const appAddr   = process.env.MICROLEND_APP_ADDRESS;
  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('repay_loan(pay)bool');

  const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from:            borrowerAddress,
    to:              appAddr,
    amount:          repaymentMicroAlgo,
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  });

  const appTxn = algosdk.makeApplicationCallTxnFromObject({
    from:         borrowerAddress,
    appIndex:     MICROLEND_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs:      [new Uint8Array(methodSig.getSelector())],
    // ★ Box references for borrower's 6 entries
    boxes: accountBoxes(borrowerAddress),
    suggestedParams: { ...params, fee: 1000, flatFee: true },
  });

  algosdk.assignGroupID([payTxn, appTxn]);

  return {
    payTxn: Buffer.from(algosdk.encodeUnsignedTransaction(payTxn)).toString('base64'),
    appTxn: Buffer.from(algosdk.encodeUnsignedTransaction(appTxn)).toString('base64'),
  };
}

module.exports = {
  getAccountState,
  buildRequestLoanTxn,
  buildRepayLoanTxn,
  buildDepositTxn,
  MICROLEND_APP_ID: () => MICROLEND_APP_ID,
};

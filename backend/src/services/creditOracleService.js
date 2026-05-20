/**
 * creditOracleService.js
 * ========================
 * Reads WorkProofCreditOracle BoxMap state from Algorand testnet.
 * App ID 761895422 — redeployed without ASA holding check.
 * BoxMap key = prefix (1 char) + account public key (32 bytes) = 33 bytes
 * BoxMap value = 8-byte big-endian UInt64
 */
const algosdk = require('algosdk');

const ALGOD_SERVER = process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud';
const ALGOD_TOKEN  = process.env.ALGORAND_TOKEN  || '';
const ALGOD_PORT   = process.env.ALGORAND_PORT   || 443;

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

const ORACLE_APP_ID = parseInt(process.env.CREDIT_ORACLE_APP_ID || '0', 10);

/** Build 33-byte box key: prefix_bytes + account_public_key */
function boxKey(prefix, address) {
  const decoded   = algosdk.decodeAddress(address);
  return Buffer.concat([Buffer.from(prefix, 'utf8'), Buffer.from(decoded.publicKey)]);
}

/** All 7 BoxMap prefixes used by register_credential */
const ORACLE_PREFIXES = ['i', 'c', 'f', 'w', 's', 'l', 'd'];

/** Build boxes array for a transaction touching all 7 worker boxes */
function workerBoxes(address) {
  return ORACLE_PREFIXES.map(p => ({
    appIndex: 0,
    name: new Uint8Array(boxKey(p, address)),  // ★ explicit Uint8Array — algosdk 2.7 strict check
  }));
}

async function readBoxUInt64(appId, prefix, address) {
  try {
    const key  = boxKey(prefix, address);
    const resp = await algodClient.getApplicationBoxByName(appId, key).do();
    const raw  = Buffer.from(resp.value, 'base64');
    return Number(raw.readBigUInt64BE(0));
  } catch (err) {
    if (err?.status === 404 || (err?.message && err.message.includes('404'))) return null;
    console.error(`readBoxUInt64(${prefix}) error:`, err.message);
    return null;
  }
}

async function getWorkerProfile(workerAddress) {
  if (!ORACLE_APP_ID) return null;
  try {
    const [inc, cnt, fwr, lwr, scr, lim, lid] = await Promise.all([
      readBoxUInt64(ORACLE_APP_ID, 'i', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 'c', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 'f', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 'w', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 's', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 'l', workerAddress),
      readBoxUInt64(ORACLE_APP_ID, 'd', workerAddress),
    ]);

    if (lim === null) return null;

    return {
      totalVerifiedIncomeMicroAlgo: inc ?? 0,
      milestoneCount:               cnt ?? 0,
      firstWorkRound:               fwr ?? 0,
      lastWorkRound:                lwr ?? 0,
      consistencyScore:             scr ?? 0,
      creditLimitMicroAlgo:         lim ?? 0,
      creditLimitInr:               Math.floor((lim ?? 0) / 100_000),
      activeLoanId:                 lid ?? 0,
    };
  } catch (err) {
    console.error('getWorkerProfile error:', err.message);
    return null;
  }
}

async function getCreditLimit(workerAddress) {
  const profile = await getWorkerProfile(workerAddress);
  return profile ? profile.creditLimitMicroAlgo : 0;
}

/**
 * Build unsigned register_credential txn — includes all 7 box references.
 * ABI: register_credential(uint64,uint64)uint64
 */
async function buildRegisterCredentialTxn({ workerAddress, credentialAssetId, incomeAmountMicroAlgo }) {
  if (!ORACLE_APP_ID) throw new Error('CREDIT_ORACLE_APP_ID not configured');

  const params    = await algodClient.getTransactionParams().do();
  const methodSig = algosdk.ABIMethod.fromSignature('register_credential(uint64,uint64)uint64');

  const txn = algosdk.makeApplicationCallTxnFromObject({
    from:         workerAddress,
    appIndex:     ORACLE_APP_ID,
    onCompletion: algosdk.OnApplicationComplete.NoOpOC,
    appArgs: [
      new Uint8Array(methodSig.getSelector()),
      new Uint8Array(algosdk.encodeUint64(credentialAssetId)),
      new Uint8Array(algosdk.encodeUint64(incomeAmountMicroAlgo)),
    ],
    // ★ All 7 BoxMap entries the contract reads/writes for this worker
    boxes: workerBoxes(workerAddress, 0),
    suggestedParams: { ...params, fee: 2000, flatFee: true },
  });

  return Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64');
}

module.exports = {
  getWorkerProfile,
  getCreditLimit,
  buildRegisterCredentialTxn,
  ORACLE_APP_ID: () => ORACLE_APP_ID,
  boxKey,
  workerBoxes,
};

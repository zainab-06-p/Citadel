const { algodClient, indexerClient, algosdk } = require('../config/algorand');
const fs = require('fs');
const path = require('path');

const WORKPROOF_APPROVAL_CANDIDATE_PATHS = [
  path.join(__dirname, '../../contracts/artifacts/workproof/WorkProof.approval.teal'),
  path.join(__dirname, '../../../projects/contracts/smart_contracts/artifacts/workproof/WorkProof.approval.teal')
];

const WORKPROOF_CLEAR_CANDIDATE_PATHS = [
  path.join(__dirname, '../../contracts/artifacts/workproof/WorkProof.clear.teal'),
  path.join(__dirname, '../../../projects/contracts/smart_contracts/artifacts/workproof/WorkProof.clear.teal')
];

let compiledWorkProofCache = null;

function resolveExistingPath(candidatePaths, label) {
  const foundPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

  if (!foundPath) {
    throw new Error(`${label} not found. Checked: ${candidatePaths.join(', ')}`);
  }

  return foundPath;
}

function readWorkProofPrograms() {
  const approvalPath = resolveExistingPath(WORKPROOF_APPROVAL_CANDIDATE_PATHS, 'WorkProof approval program');
  const clearPath = resolveExistingPath(WORKPROOF_CLEAR_CANDIDATE_PATHS, 'WorkProof clear program');

  return {
    approvalTeal: fs.readFileSync(approvalPath, 'utf8'),
    clearTeal: fs.readFileSync(clearPath, 'utf8')
  };
}

function getWorkProofProgramVersion() {
  const approvalPath = resolveExistingPath(WORKPROOF_APPROVAL_CANDIDATE_PATHS, 'WorkProof approval program');
  const clearPath = resolveExistingPath(WORKPROOF_CLEAR_CANDIDATE_PATHS, 'WorkProof clear program');
  const approvalStat = fs.statSync(approvalPath);
  const clearStat = fs.statSync(clearPath);
  return `${approvalStat.mtimeMs}:${clearStat.mtimeMs}`;
}

async function compileTeal(tealSource) {
  const result = await algodClient.compile(tealSource).do();
  return {
    base64: result.result,
    bytes: Buffer.from(result.result, 'base64')
  };
}

async function getCompiledWorkProofPrograms(forceRefresh = false) {
  const currentVersion = getWorkProofProgramVersion();

  if (compiledWorkProofCache && !forceRefresh && compiledWorkProofCache.version === currentVersion) {
    return compiledWorkProofCache;
  }

  const { approvalTeal, clearTeal } = readWorkProofPrograms();
  const [approvalCompiled, clearCompiled] = await Promise.all([
    compileTeal(approvalTeal),
    compileTeal(clearTeal)
  ]);

  compiledWorkProofCache = {
    version: currentVersion,
    approvalBase64: approvalCompiled.base64,
    clearBase64: clearCompiled.base64,
    schema: {
      globalInts: 5,
      globalBytes: 4,
      localInts: 0,
      localBytes: 0
    }
  };

  return compiledWorkProofCache;
}

async function getTransactionById(txid) {
  return indexerClient.lookupTransactionByID(txid).do();
}

async function verifyAppCallTx({ txid, appId, sender }) {
  const tx = await getTransactionById(txid);
  const appCall = tx?.transaction?.['application-transaction'];
  const appIdOnChain = appCall?.['application-id'];
  const senderOnChain = tx?.transaction?.sender;

  if (!appCall || appIdOnChain !== Number(appId)) {
    return { ok: false, reason: 'Transaction is not an app call for this app ID' };
  }

  if (sender && senderOnChain !== sender) {
    return { ok: false, reason: 'Transaction sender mismatch' };
  }

  return { ok: true, tx };
}

/**
 * Deploy WorkProof smart contract
 * Uses the existing deployed contract on TestNet
 * 
 * @param {Object} params
 * @param {string} params.contractorAddress
 * @param {string} params.supervisorAddress
 * @param {string} params.workerAddress
 * @param {Array} params.milestones
 * @param {number} params.totalEscrow
 * @returns {Promise<Object>}
 */
async function deployContract({
  contractorAddress,
  supervisorAddress,
  workerAddress,
  milestones,
  totalEscrow
}) {
  // Use existing deployed contract on TestNet
  const appId = parseInt(process.env.WORKPROOF_APP_ID || 758015705);
  
  console.log('[Algorand] Using deployed contract:', {
    appId,
    contractorAddress,
    supervisorAddress,
    workerAddress,
    milestoneCount: milestones.length,
    totalEscrow
  });
  
  try {
    // Verify contract exists on chain
    const contractState = await getContractState(appId);
    console.log('[Algorand] Contract verified on TestNet:', {
      appId,
      creator: contractState.creator,
      status: 'active'
    });
    
    // Generate a unique transaction ID for this contract instance
    // In a real scenario, this would be the app call txn ID
    const txid = `CONTRACT_LINK_${appId}_${Date.now()}`;
    
    return {
      appId: appId,
      txid: txid,
      status: 'linked',
      addresses: {
        contractor: contractorAddress,
        supervisor: supervisorAddress,
        worker: workerAddress
      },
      milestones: milestones.map((m, i) => ({
        index: i,
        amount: m.amount,
        description: m.description
      })),
      network: 'testnet',
      deployedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('[Algorand] Failed to verify contract:', error.message);
    throw new Error(`Contract verification failed: ${error.message}`);
  }
}

/**
 * Get contract state from Algorand
 * @param {number} appId
 * @returns {Promise<Object>}
 */
async function getContractState(appId) {
  try {
    // Get application info
    const appInfo = await algodClient.getApplicationByID(appId).do();
    
    // Parse global state
    const globalState = {};
    if (appInfo.params['global-state']) {
      for (const item of appInfo.params['global-state']) {
        const key = Buffer.from(item.key, 'base64').toString();
        const value = item.value;
        globalState[key] = value;
      }
    }
    
    return {
      appId,
      creator: appInfo.params.creator,
      globalState,
      status: 'active'
    };
  } catch (error) {
    console.error('Error fetching contract state:', error);
    throw error;
  }
}

/**
 * Query Indexer for transactions related to an app
 * @param {number} appId
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function getAppTransactions(appId, options = {}) {
  try {
    const { minRound, maxRound, txType } = options;
    
    let query = indexerClient.searchForTransactions().applicationID(appId);
    
    if (minRound) query = query.minRound(minRound);
    if (maxRound) query = query.maxRound(maxRound);
    if (txType) query = query.txType(txType);
    
    const response = await query.do();
    return response.transactions || [];
  } catch (error) {
    console.error('Error fetching app transactions:', error);
    throw error;
  }
}

/**
 * Get current blockchain round
 * @returns {Promise<number>}
 */
async function getCurrentRound() {
  try {
    const status = await algodClient.status().do();
    return status['last-round'];
  } catch (error) {
    console.error('Error getting current round:', error);
    throw error;
  }
}

module.exports = {
  deployContract,
  getContractState,
  getAppTransactions,
  getCurrentRound,
  getCompiledWorkProofPrograms,
  getTransactionById,
  verifyAppCallTx
};

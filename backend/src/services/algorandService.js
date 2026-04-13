const { algodClient, indexerClient, algosdk } = require('../config/algorand');

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
  getCurrentRound
};

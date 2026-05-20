const { algodClient, indexerClient, algosdk } = require('../config/algorand');

function decodeBase64ToString(value) {
  if (!value) return '';
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

async function lookupTransactionWithRetry(txid, maxAttempts = 10) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await indexerClient.lookupTransactionByID(txid).do();
      if (response?.transaction) {
        return response.transaction;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction ${txid} not indexed yet${lastError ? `: ${lastError.message}` : ''}`);
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

/**
 * Verify a payment transaction on Algorand TestNet
 */
async function verifyPaymentTransaction({
  txid,
  expectedSender,
  expectedReceiver,
  expectedAmountMicroAlgos
}) {
  if (!txid) {
    throw new Error('Missing transaction id');
  }

  const tx = await lookupTransactionWithRetry(txid);
  const paymentTxn = tx['payment-transaction'];

  if (!paymentTxn) {
    throw new Error('Transaction is not a payment transaction');
  }

  if (expectedSender && tx.sender !== expectedSender) {
    throw new Error('Payment sender does not match expected supervisor address');
  }

  if (expectedReceiver && paymentTxn.receiver !== expectedReceiver) {
    throw new Error('Payment receiver does not match generated escrow address');
  }

  if (typeof expectedAmountMicroAlgos === 'number' && paymentTxn.amount < expectedAmountMicroAlgos) {
    throw new Error('Payment amount is less than the contract escrow amount');
  }

  return {
    txid: tx.id,
    sender: tx.sender,
    receiver: paymentTxn.receiver,
    amountMicroAlgos: paymentTxn.amount,
    confirmedRound: tx['confirmed-round']
  };
}

/**
 * Verify a supervisor approval marker transaction on-chain.
 */
async function verifyApprovalMarkerTransaction({
  txid,
  supervisorAddress,
  appId,
  milestoneIndex
}) {
  if (!txid) {
    throw new Error('Missing approval transaction id');
  }

  const tx = await lookupTransactionWithRetry(txid);
  const expectedNote = `APPROVE:${appId}:${milestoneIndex}`;
  const note = decodeBase64ToString(tx.note);
  const paymentTxn = tx['payment-transaction'];

  if (!paymentTxn) {
    throw new Error('Approval transaction must be a payment transaction');
  }

  if (tx.sender !== supervisorAddress) {
    throw new Error('Approval transaction sender does not match supervisor wallet');
  }

  if (note !== expectedNote) {
    throw new Error('Approval transaction note does not match contract/milestone');
  }

  return {
    txid: tx.id,
    confirmedRound: tx['confirmed-round'],
    sender: tx.sender,
    note
  };
}

module.exports = {
  deployContract,
  getContractState,
  getAppTransactions,
  getCurrentRound,
  verifyPaymentTransaction,
  verifyApprovalMarkerTransaction
};

const db = require('../config/database');
const { indexerClient } = require('../config/algorand');
const { Milestone } = require('../models/Milestone');
const { Certificate } = require('../models/Certificate');
const pdfService = require('./pdfService');

let isRunning = false;

/**
 * Start the blockchain watcher
 * Polls every POLL_INTERVAL milliseconds
 */
async function startWatcher() {
  if (isRunning) {
    console.log('Watcher already running');
    return;
  }
  
  isRunning = true;
  const POLL_INTERVAL = 10000; // 10 seconds
  
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           Blockchain Watcher Started                  ║');
  console.log(`║  Polling interval: ${POLL_INTERVAL}ms                     ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  
  // Initial poll
  await pollForApprovals();
  
  // Schedule recurring polls
  setInterval(async () => {
    if (!isRunning) return;
    
    try {
      await pollForApprovals();
    } catch (error) {
      console.error('Watcher poll error:', error);
    }
  }, POLL_INTERVAL);
}

/**
 * Stop the watcher
 */
function stopWatcher() {
  isRunning = false;
  console.log('Watcher stopped');
}

/**
 * Single poll iteration
 */
async function pollForApprovals() {
  try {
    // Get last checked round
    const cursor = await getWatchCursor();
    const lastRound = cursor.last_round;
    
    // Get current round
    const status = await indexerClient.makeHealthCheck();
    const currentRound = status.round;
    
    if (currentRound <= lastRound) {
      return; // No new rounds
    }
    
    console.log(`[Watcher] Checking rounds ${lastRound} to ${currentRound}`);
    
    // Find active contracts with unpaid milestones
    const contracts = await db.all(`
      SELECT DISTINCT c.id, c.app_id
      FROM contracts c
      JOIN milestones m ON c.id = m.contract_id
      WHERE c.status = 'active' AND m.paid = 0
    `);
    
    for (const contract of contracts) {
      await checkContractForApprovals(contract, lastRound, currentRound);
    }
    
    // Update cursor
    await updateWatchCursor(currentRound);
    
  } catch (error) {
    console.error('[Watcher] Error in poll:', error);
  }
}

/**
 * Check a specific contract for new milestone approvals
 */
async function checkContractForApprovals(contract, fromRound, toRound) {
  try {
    // Query Indexer for application calls
    const response = await indexerClient
      .searchForTransactions()
      .applicationID(contract.app_id)
      .minRound(fromRound)
      .maxRound(toRound)
      .txType('appl')
      .do();
    
    const transactions = response.transactions || [];
    
    for (const tx of transactions) {
      await processTransaction(tx, contract);
    }
    
  } catch (error) {
    console.error(`[Watcher] Error checking contract ${contract.app_id}:`, error);
  }
}

/**
 * Process a single transaction
 */
async function processTransaction(tx, contract) {
  try {
    // Check if this is an approve_milestone call
    const appArgs = tx['application-transaction']?.['application-args'] || [];
    
    if (!isApproveMilestoneCall(appArgs)) {
      return;
    }
    
    const txid = tx.id;
    const round = tx['confirmed-round'];
    const timestamp = new Date(tx['round-time'] * 1000).toISOString();
    
    console.log(`[Watcher] Detected approval: ${txid} in round ${round}`);
    
    // Extract milestone index
    const milestoneIndex = extractMilestoneIndex(appArgs);
    if (milestoneIndex === null) {
      console.log('[Watcher] Could not extract milestone index');
      return;
    }
    
    // Check if already processed (idempotency)
    const existing = await db.get(
      'SELECT id, paid FROM milestones WHERE contract_id = ? AND txid = ?',
      [contract.id, txid]
    );
    
    if (existing && existing.paid) {
      console.log(`[Watcher] Transaction ${txid} already processed`);
      return;
    }
    
    // Get milestone record
    const milestone = await db.get(
      'SELECT * FROM milestones WHERE contract_id = ? AND milestone_index = ?',
      [contract.id, milestoneIndex]
    );
    
    if (!milestone) {
      console.log(`[Watcher] Milestone ${milestoneIndex} not found for contract ${contract.id}`);
      return;
    }
    
    if (milestone.paid) {
      console.log(`[Watcher] Milestone ${milestoneIndex} already paid`);
      return;
    }
    
    // Extract asset ID from inner transactions (NFT mint)
    const assetId = extractAssetIdFromInnerTx(tx);
    
    // Update milestone
    await db.run(
      `UPDATE milestones 
       SET paid = 1, txid = ?, asset_id = ?, paid_at = ?
       WHERE id = ?`,
      [txid, assetId, timestamp, milestone.id]
    );
    
    console.log(`[Watcher] Milestone ${milestoneIndex} marked as paid`);
    
    // Record UPI simulation
    await recordUPIPayout(contract, milestone, txid);
    
    // Generate PDF certificate
    try {
      const fullContract = await db.get(
        'SELECT * FROM contracts WHERE id = ?',
        [contract.id]
      );
      
      const certificate = await pdfService.generateCertificate({
        contract: fullContract,
        milestone,
        txid,
        assetId,
        paidAt: timestamp
      });
      
      // Store certificate record
      await db.run(
        `INSERT INTO certificates (contract_id, milestone_id, pdf_path, txid, asset_id, generated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [contract.id, milestone.id, certificate.path, txid, assetId, new Date().toISOString()]
      );
      
      // Mark milestone certificate as generated
      await db.run(
        'UPDATE milestones SET certificate_generated = 1 WHERE id = ?',
        [milestone.id]
      );
      
      console.log(`[Watcher] Certificate generated: ${certificate.path}`);
      
    } catch (error) {
      console.error('[Watcher] PDF generation failed:', error);
      // Don't fail the whole process - certificate can be regenerated later
    }
    
  } catch (error) {
    console.error('[Watcher] Error processing transaction:', error);
  }
}

/**
 * Record simulated UPI payout
 */
async function recordUPIPayout(contract, milestone, txid) {
  const upiData = {
    simulated: true,
    upiReference: `UPI${Date.now()}`,
    algoTxid: txid,
    amount: milestone.amount,
    simulatedAt: new Date().toISOString(),
    status: 'completed'
  };
  
  await db.run(
    'UPDATE milestones SET metadata = ? WHERE id = ?',
    [JSON.stringify({ upiPayout: upiData }), milestone.id]
  );
  
  console.log(`[Watcher] UPI payout simulated: ${upiData.upiReference}`);
}

/**
 * Check if transaction is approve_milestone call
 */
function isApproveMilestoneCall(appArgs) {
  if (!appArgs || appArgs.length === 0) return false;
  
  // This is simplified - actual detection depends on your contract's ABI
  // You need to match the method selector
  const methodSelector = appArgs[0];
  
  // Check for approve_milestone method signature
  // Actual implementation should decode the selector properly
  return true; // Simplified - replace with actual logic
}

/**
 * Extract milestone index from application args
 */
function extractMilestoneIndex(appArgs) {
  if (appArgs.length < 2) return null;
  
  try {
    // Decode from base64
    const indexData = appArgs[1];
    const decoded = Buffer.from(indexData, 'base64');
    return decoded.readUIntBE(0, decoded.length);
  } catch {
    return null;
  }
}

/**
 * Extract asset ID from inner transactions
 */
function extractAssetIdFromInnerTx(tx) {
  const innerTxs = tx['inner-txns'] || [];
  
  for (const inner of innerTxs) {
    if (inner['asset-config-transaction']) {
      return inner['asset-config-transaction']['asset-id'];
    }
    if (inner['asset-transfer-transaction']) {
      return inner['asset-transfer-transaction']['asset-id'];
    }
  }
  
  return null;
}

/**
 * Get current watch cursor
 */
async function getWatchCursor() {
  const row = await db.get('SELECT * FROM watch_cursor WHERE id = 1');
  
  if (!row) {
    // Initialize with current round minus 100
    const status = await indexerClient.makeHealthCheck();
    const initialRound = Math.max(0, status.round - 100);
    
    await db.run(
      'INSERT INTO watch_cursor (id, last_round) VALUES (1, ?)',
      [initialRound]
    );
    
    return { last_round: initialRound };
  }
  
  return row;
}

/**
 * Update watch cursor
 */
async function updateWatchCursor(round) {
  await db.run(
    'UPDATE watch_cursor SET last_round = ?, updated_at = ? WHERE id = 1',
    [round, new Date().toISOString()]
  );
}

module.exports = {
  startWatcher,
  stopWatcher,
  pollForApprovals
};

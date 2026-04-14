const express = require('express');
const router = express.Router();
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const { WorkerBankDetail } = require('../models/WorkerBankDetail');
const algorandService = require('../services/algorandService');
const { simulatePayout } = require('../services/razorpayService');
const { isValidAlgorandAddress } = require('../utils/validators');

/**
 * GET /api/contracts/:appId
 * Get contract details with milestones
 */
router.get('/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const appIdNum = parseInt(appId, 10);
    
    if (isNaN(appIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid app ID format'
      });
    }
    
    // Get contract from database
    const contract = await Contract.getWithMilestones(appIdNum);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Optionally get on-chain state (may be slow)
    let onChainState = null;
    try {
      onChainState = await algorandService.getContractState(appIdNum);
    } catch (error) {
      console.log('Could not fetch on-chain state:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        appId: contract.appId || contract.app_id,
        contractor: contract.contractorAddress || contract.contractor_address,
        supervisor: contract.supervisorAddress || contract.supervisor_address,
        worker: contract.workerAddress || contract.worker_address,
        milestoneCount: contract.milestoneCount || contract.milestone_count,
        totalEscrow: contract.totalEscrow || contract.total_escrow,
        status: contract.status,
        deployedAt: contract.deployedAt || contract.deployed_at,
        milestones: (contract.milestones || []).map(m => ({
          index: m.milestoneIndex ?? m.milestone_index,
          amount: m.amount,
          description: m.description,
          paid: !!m.paid,
          txid: m.txid,
          assetId: m.assetId ?? m.asset_id,
          paidAt: m.paidAt ?? m.paid_at,
          certificateAvailable: !!(m.certificateGenerated ?? m.certificate_generated)
        })),
        onChain: onChainState
      }
    });
    
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/contracts/:appId/transactions
 * Get contract transaction history
 */
router.get('/:appId/transactions', async (req, res) => {
  try {
    const { appId } = req.params;
    const { minRound, maxRound, limit = 10 } = req.query;
    
    const appIdNum = parseInt(appId, 10);
    
    if (isNaN(appIdNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid app ID'
      });
    }
    
    const transactions = await algorandService.getAppTransactions(appIdNum, {
      minRound: minRound ? parseInt(minRound) : undefined,
      maxRound: maxRound ? parseInt(maxRound) : undefined,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: {
        appId: appIdNum,
        count: transactions.length,
        transactions
      }
    });
    
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/contracts/:appId/approve-milestone
 * Supervisor approves a milestone to release payment
 */
router.post('/:appId/approve-milestone', async (req, res) => {
  try {
    const { appId } = req.params;
    const { supervisorAddress, milestoneIndex, onChainTxId, approvalProofTxId } = req.body;
    
    const appIdNum = parseInt(appId, 10);
    
    const milestoneIndexNum = Number(milestoneIndex);

    if (isNaN(appIdNum) || !supervisorAddress || milestoneIndex === undefined || Number.isNaN(milestoneIndexNum)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appId, supervisorAddress, milestoneIndex'
      });
    }

    const normalizedSupervisor = String(supervisorAddress).trim().toUpperCase();
    
    // Get contract from database
    const contract = await Contract.findByAppId(appIdNum);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Get milestone
    const milestone = await Milestone.findByContractAndIndex(contract.id, milestoneIndexNum);
    
    if (!milestone) {
      return res.status(404).json({
        success: false,
        error: 'Milestone not found'
      });
    }
    
    if (milestone.paid) {
      return res.status(400).json({
        success: false,
        error: 'Milestone already approved and paid'
      });
    }
    
    // If a real on-chain txid is provided, verify ownership and app ID.
    let txid = onChainTxId || approvalProofTxId || `APPROVED_${appIdNum}_${milestoneIndexNum}_${Date.now()}`;
    let assetId = Math.floor(Math.random() * 1000000) + 100000;

    if (milestoneIndexNum === 0) {
      if (!onChainTxId) {
        return res.status(400).json({ success: false, error: 'Missing onChainTxId for milestone 0 approval' });
      }

      const verification = await algorandService.verifyAppCallTx({
        txid: onChainTxId,
        appId: appIdNum,
        sender: normalizedSupervisor
      });

      if (!verification.ok) {
        return res.status(400).json({ success: false, error: verification.reason || 'Invalid on-chain approval transaction' });
      }

      const innerTxns = verification.tx?.transaction?.['inner-txns'] || [];
      const createdAssetInner = innerTxns.find(t => t['asset-config-transaction']);
      if (createdAssetInner?.['asset-config-transaction']?.['asset-id']) {
        assetId = createdAssetInner['asset-config-transaction']['asset-id'];
      }
    } else {
      if (!approvalProofTxId) {
        return res.status(400).json({ success: false, error: 'Missing approvalProofTxId for milestone approval' });
      }

      const proofLookup = await algorandService.getTransactionById(approvalProofTxId);
      const proofTx = proofLookup?.transaction;
      const proofPayment = proofTx?.['payment-transaction'];

      if (!proofTx || !proofPayment) {
        return res.status(400).json({ success: false, error: 'Approval proof transaction is invalid or not a payment transaction' });
      }

      if (String(proofTx.sender).toUpperCase() !== normalizedSupervisor || String(proofPayment.receiver).toUpperCase() !== normalizedSupervisor) {
        return res.status(400).json({ success: false, error: 'Approval proof sender/receiver mismatch' });
      }

      const noteDecoded = proofTx.note ? Buffer.from(proofTx.note, 'base64').toString('utf8') : '';
      const expectedNote = `workproof-approve:${appIdNum}:${milestoneIndexNum}`;
      if (noteDecoded !== expectedNote) {
        return res.status(400).json({ success: false, error: 'Approval proof note mismatch' });
      }

      txid = approvalProofTxId;
      assetId = 0;
    }
    
    await Milestone.markPaid(milestone.id, {
      txid: txid,
      assetId: assetId,
      paidAt: new Date().toISOString()
    });
    
    await Milestone.markCertificateGenerated(milestone.id);

    // Simulate INR payout only after milestone release is approved.
    const workerBank = await WorkerBankDetail.findByWorker(contract.worker_address);
    const payout = await simulatePayout({
      amountINR: milestone.amount_inr || (milestone.amount * (contract.algo_to_inr_rate || 0)),
      workerAddress: contract.worker_address,
      upiId: workerBank?.upi_id || null,
      accountHolderName: workerBank?.account_holder_name || null,
      milestoneDescription: milestone.description,
      appId: appIdNum,
      milestoneIndex: milestoneIndexNum,
      algoAmount: milestone.amount,
      algoToInrRate: contract.algo_to_inr_rate || 0
    });

    await Milestone.markPayoutTriggered(milestone.id, {
      razorpayPayoutId: payout.payoutId,
      payoutSimulated: true
    });
    
    console.log(`✅ Milestone ${milestoneIndexNum} approved for contract ${appIdNum}`);
    console.log(`💰 Payment of ${milestone.amount} released to worker`);
    
    res.json({
      success: true,
      message: 'Milestone approved successfully',
      data: {
        appId: appIdNum,
        milestoneIndex: milestoneIndexNum,
        txid: txid,
        certificateAssetId: assetId,
        payout: {
          payoutId: payout.payoutId,
          utrNumber: payout.utrNumber,
          simulated: true,
          amountINR: payout.amountINR
        },
        status: 'approved'
      }
    });
    
  } catch (error) {
    console.error('Approve milestone error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/contracts/history/:address
 * Wallet-scoped contract history for contractor/supervisor/worker roles
 */
router.get('/history/:address', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid Algorand address format' });
    }

    const [asContractor, asSupervisor, asWorker] = await Promise.all([
      Contract.findByContractor(address),
      Contract.findBySupervisor(address),
      Contract.findByWorker(address)
    ]);

    const contractMap = new Map();
    const addWithRole = (rows, role) => {
      for (const row of rows) {
        const key = String(row.app_id);
        if (!contractMap.has(key)) {
          contractMap.set(key, { ...row, roles: new Set() });
        }
        contractMap.get(key).roles.add(role);
      }
    };

    addWithRole(asContractor, 'contractor');
    addWithRole(asSupervisor, 'supervisor');
    addWithRole(asWorker, 'worker');

    const items = [];
    for (const row of contractMap.values()) {
      const milestones = await Milestone.findByContract(row.id);
      const paidCount = milestones.filter((m) => !!m.paid).length;
      items.push({
        appId: row.app_id,
        contractId: row.id,
        roles: Array.from(row.roles),
        status: row.status,
        deployedAt: row.deployed_at || row.created_at,
        contractorAddress: row.contractor_address,
        supervisorAddress: row.supervisor_address,
        workerAddress: row.worker_address,
        totalEscrow: row.total_escrow,
        totalEscrowInr: row.total_escrow_inr || 0,
        milestoneCount: milestones.length,
        paidMilestones: paidCount,
      });
    }

    items.sort((a, b) => new Date(b.deployedAt) - new Date(a.deployedAt));

    return res.json({
      success: true,
      data: {
        walletAddress: address,
        totalContracts: items.length,
        contracts: items,
      }
    });
  } catch (error) {
    console.error('Get wallet contract history error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

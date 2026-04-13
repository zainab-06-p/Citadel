const express = require('express');
const router = express.Router();
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const algorandService = require('../services/algorandService');

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
    const { supervisorAddress, milestoneIndex } = req.body;
    
    const appIdNum = parseInt(appId, 10);
    
    if (isNaN(appIdNum) || !supervisorAddress || milestoneIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appId, supervisorAddress, milestoneIndex'
      });
    }
    
    // Get contract from database
    const contract = await Contract.findByAppId(appIdNum);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Get milestone
    const milestone = await Milestone.findByContractAndIndex(contract.id, milestoneIndex);
    
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
    
    // Mark milestone as paid
    const txid = `APPROVED_${appIdNum}_${milestoneIndex}_${Date.now()}`;
    const assetId = Math.floor(Math.random() * 1000000) + 100000;
    
    await Milestone.markPaid(milestone.id, {
      txid: txid,
      assetId: assetId,
      paidAt: new Date().toISOString()
    });
    
    await Milestone.markCertificateGenerated(milestone.id);
    
    console.log(`✅ Milestone ${milestoneIndex} approved for contract ${appIdNum}`);
    console.log(`💰 Payment of ${milestone.amount} released to worker`);
    
    res.json({
      success: true,
      message: 'Milestone approved successfully',
      data: {
        appId: appIdNum,
        milestoneIndex: milestoneIndex,
        txid: txid,
        certificateAssetId: assetId,
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

module.exports = router;

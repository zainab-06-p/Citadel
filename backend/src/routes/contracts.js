const express = require('express');
const router = express.Router();
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const { WorkerBankDetail } = require('../models/WorkerBankDetail');
const algorandService = require('../services/algorandService');
const razorpayService = require('../services/razorpayService');
const db = require('../config/database');

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
      onChainState = await algorandService.getContractState(contract.on_chain_app_id || appIdNum);
    } catch (error) {
      console.log('Could not fetch on-chain state:', error.message);
    }
    
    res.json({
      success: true,
      data: {
        appId: contract.appId || contract.app_id,
        onChainAppId: contract.onChainAppId || contract.on_chain_app_id || appIdNum,
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
    const { supervisorAddress, milestoneIndex, approvalTxid } = req.body;
    
    const appIdNum = parseInt(appId, 10);
    
    if (isNaN(appIdNum) || !supervisorAddress || milestoneIndex === undefined || !approvalTxid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: appId, supervisorAddress, milestoneIndex, approvalTxid'
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

    if (contract.supervisor_address !== supervisorAddress) {
      return res.status(403).json({
        success: false,
        error: 'Only the assigned supervisor wallet can approve milestones for this contract'
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
    
    const approvalVerification = await algorandService.verifyApprovalMarkerTransaction({
      txid: approvalTxid,
      supervisorAddress,
      appId: appIdNum,
      milestoneIndex
    });
    
    await Milestone.markPaid(milestone.id, {
      txid: approvalVerification.txid,
      assetId: null,
      paidAt: new Date().toISOString()
    });

    // Trigger INR payout record for this paid milestone
    const bankDetails = await WorkerBankDetail.findByWorker(contract.worker_address);
    const algoToInrRate = Number(contract.algo_to_inr_rate || 0);
    const amountINR = Number(milestone.amount_inr || (Number(milestone.amount || 0) * algoToInrRate));
    let payoutResult = null;

    if (bankDetails?.upi_id || bankDetails?.fund_account_id) {
      payoutResult = await razorpayService.processPayout({
        amountINR,
        workerAddress: contract.worker_address,
        workerBankDetails: bankDetails,
        milestoneDescription: milestone.description,
        appId: appIdNum,
        milestoneIndex,
        algoAmount: Number(milestone.amount || 0),
        algoToInrRate
      });

      await Milestone.markPayoutTriggered(milestone.id, {
        razorpayPayoutId: payoutResult.payoutId || payoutResult.razorpayOrderId,
        payoutSimulated: !!payoutResult.simulated
      });
    } else {
      await db.run(
        `UPDATE milestones
         SET payout_status = 'pending', payout_simulated = 0
         WHERE id = ?`,
        [milestone.id]
      );
    }

    await Milestone.markCertificateGenerated(milestone.id);
    
    console.log(`✅ Milestone ${milestoneIndex} approved for contract ${appIdNum}`);
    console.log(`💰 Payment of ${milestone.amount} ALGO settled for worker ${contract.worker_address}`);
    
    res.json({
      success: true,
      message: 'Milestone approved successfully',
      data: {
        appId: appIdNum,
        milestoneIndex: milestoneIndex,
        txid: approvalVerification.txid,
        payout: payoutResult,
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

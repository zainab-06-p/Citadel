const express = require('express');
const router = express.Router();
const path = require('path');
const { Certificate } = require('../models/Certificate');
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const { WorkerBankDetail } = require('../models/WorkerBankDetail');
const { isValidAlgorandAddress } = require('../utils/validators');
const FinancialCreditService = require('../services/aiCreditService');

const CERTIFICATES_DIR = path.join(__dirname, '../../certificates');

/**
 * GET /api/workers/:address/certificates
 * Get all certificates for a worker
 */
router.get('/:address/certificates', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }
    
    const certificates = await Certificate.findByWorker(address);
    
    res.json({
      success: true,
      data: {
        workerAddress: address,
        totalCertificates: certificates.length,
        certificates: certificates.map(c => ({
          certificateId: path.basename(c.pdf_path, '.pdf'),
          appId: c.app_id,
          milestoneIndex: c.milestone_index,
          milestoneDescription: c.description,
          amount: c.amount,
          txid: c.txid,
          assetId: c.asset_id,
          pdfUrl: `/api/certificates/${c.app_id}/${c.milestone_index}`,
          generatedAt: c.generated_at
        }))
      }
    });
    
  } catch (error) {
    console.error('Get certificates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workers/:address/contracts
 * Get all contracts where address is a worker
 */
router.get('/:address/contracts', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }
    
    const contracts = await Contract.findByWorker(address);
    
    res.json({
      success: true,
      data: {
        workerAddress: address,
        totalContracts: contracts.length,
        contracts: contracts.map(c => ({
          appId: c.app_id,
          milestoneCount: c.milestone_count,
          totalEscrow: c.total_escrow,
          status: c.status,
          deployedAt: c.deployed_at
        }))
      }
    });
    
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/certificates/:appId/:milestoneIndex
 * Download PDF certificate
 */
router.get('/certificates/:appId/:milestoneIndex', async (req, res) => {
  try {
    const { appId, milestoneIndex } = req.params;
    
    const appIdNum = parseInt(appId, 10);
    const milestoneIdxNum = parseInt(milestoneIndex, 10);
    
    if (isNaN(appIdNum) || isNaN(milestoneIdxNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid app ID or milestone index'
      });
    }
    
    // Find contract
    const contract = await Contract.findByAppId(appIdNum);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Find certificate
    const certificate = await Certificate.findByMilestone(
      // We need milestone ID, but we have milestone index
      // Get milestone first
      await (async () => {
        const { Milestone } = require('../models/Milestone');
        const milestone = await Milestone.findByContractAndIndex(contract.id, milestoneIdxNum);
        return milestone?.id;
      })()
    );
    
    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not yet generated. Milestone may not be approved yet.'
      });
    }
    
    // Serve PDF
    res.sendFile(certificate.pdf_path, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${path.basename(certificate.pdf_path)}"`
      }
    });
    
  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workers/:address/credit-score
 * Get AI-powered credit score for a worker
 */
router.get('/:address/credit-score', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }
    
    // Calculate or retrieve cached credit score
    const creditScore = await FinancialCreditService.calculateCreditScore(address);
    
    res.json({
      success: true,
      data: creditScore
    });
    
  } catch (error) {
    console.error('Get credit score error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workers/:address/credit-score/refresh
 * Force refresh credit score calculation
 */
router.post('/:address/credit-score/refresh', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }
    
    // Force recalculation
    const creditScore = await FinancialCreditService.refreshScore(address);
    
    res.json({
      success: true,
      message: 'Credit score refreshed successfully',
      data: creditScore
    });
    
  } catch (error) {
    console.error('Refresh credit score error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workers/top-performers
 * Get top performers by credit score
 */
router.get('/top-performers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topPerformers = await FinancialCreditService.getTopPerformers(limit);
    
    res.json({
      success: true,
      data: {
        count: topPerformers.length,
        performers: topPerformers
      }
    });
    
  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workers/:address/bank-details
 * Worker registers their UPI ID or bank details for INR payouts
 */
router.post('/:address/bank-details', async (req, res) => {
  try {
    const { address } = req.params;
    const { upiId, bankAccountNumber, bankIfsc, accountHolderName, paymentMode = 'UPI' } = req.body;

    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }

    // For UPI mode, upiId is required
    if (paymentMode === 'UPI' && !upiId) {
      return res.status(400).json({
        success: false,
        error: 'UPI ID is required for UPI payment mode (e.g. yourname@paytm)'
      });
    }

    // For IMPS/NEFT, bank details are required
    if ((paymentMode === 'IMPS' || paymentMode === 'NEFT') && (!bankAccountNumber || !bankIfsc)) {
      return res.status(400).json({
        success: false,
        error: 'Bank account number and IFSC are required for IMPS/NEFT mode'
      });
    }

    const details = await WorkerBankDetail.upsert({
      workerAddress: address,
      upiId: upiId || null,
      bankAccountNumber: bankAccountNumber || null,
      bankIfsc: bankIfsc || null,
      accountHolderName: accountHolderName || null,
      paymentMode
    });

    console.log(`🏦 Worker bank details saved: ${address} → ${upiId || bankAccountNumber}`);

    res.json({
      success: true,
      message: 'Payment details registered successfully',
      data: {
        workerAddress: address,
        paymentMode,
        upiId: upiId || null,
        bankAccountNumber: bankAccountNumber ? `****${bankAccountNumber.slice(-4)}` : null,
        accountHolderName: accountHolderName || null,
        registeredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Save bank details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workers/:address/bank-details
 * Get worker's registered payment details
 */
router.get('/:address/bank-details', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address format'
      });
    }

    const details = await WorkerBankDetail.findByWorker(address);

    if (!details) {
      return res.json({
        success: true,
        data: { registered: false, message: 'No payment details registered yet' }
      });
    }

    res.json({
      success: true,
      data: {
        registered: true,
        workerAddress: address,
        paymentMode: details.payment_mode,
        upiId: details.upi_id || null,
        bankAccountNumber: details.bank_account_number 
          ? `****${details.bank_account_number.slice(-4)}` 
          : null,
        accountHolderName: details.account_holder_name || null,
        createdAt: details.created_at,
        updatedAt: details.updated_at
      }
    });

  } catch (error) {
    console.error('Get bank details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workers/:address/payment-history
 * Get all paid milestone payouts for a worker — with full receipt data
 */
router.get('/:address/payment-history', async (req, res) => {
  try {
    const { address } = req.params;

    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }

    // Find all contracts for this worker
    const contracts = await Contract.findByWorker(address);
    
    const payments = [];
    let totalINR = 0;
    let totalPaidOut = 0;

    for (const contract of contracts) {
      // Get all milestones for this contract
      const milestones = await Milestone.findByContract(contract.id);
      
      for (const ms of milestones) {
        if (ms.paid) {
          const amountINR = ms.amount_inr || 0;
          totalINR += amountINR;

          const isPaidOut = ms.payout_status === 'triggered';
          if (isPaidOut) totalPaidOut += amountINR;

          payments.push({
            // Identifiers
            contractId: contract.id,
            appId: contract.app_id,
            milestoneIndex: ms.milestone_index,
            milestoneId: ms.id,
            // Work details
            description: ms.description || `Milestone ${ms.milestone_index + 1}`,
            // Amounts
            amountAlgo: ms.amount,
            amountINR: amountINR,
            algoToInrRate: contract.algo_to_inr_rate || 0,
            // Payment status
            paid: true,
            payoutStatus: ms.payout_status || 'pending',
            // Razorpay payout ref (from DB)
            razorpayPayoutId: ms.razorpay_payout_id || null,
            payoutSimulated: !!ms.payout_simulated,
            // Timestamps
            paidAt: ms.paid_at,
            // Certificate
            txid: ms.txid,
            assetId: ms.asset_id,
            certificateGenerated: !!ms.certificate_generated,
            // Contract metadata
            contractorAddress: contract.contractor_address,
            supervisorAddress: contract.supervisor_address,
          });
        }
      }
    }

    // Sort by paidAt descending (most recent first)
    payments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    res.json({
      success: true,
      data: {
        workerAddress: address,
        totalPayments: payments.length,
        totalINR,
        totalPaidOut,
        pendingINR: totalINR - totalPaidOut,
        payments
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workers/:address/upi-preview
 * Quick lookup — returns registered UPI for a worker address.
 * Used by ContractorDashboard to show live UPI info when entering worker address.
 */
router.get('/:address/upi-preview', async (req, res) => {
  try {
    const { address } = req.params;
    if (!isValidAlgorandAddress(address)) {
      return res.status(400).json({ success: false, error: 'Invalid address' });
    }
    const details = await WorkerBankDetail.findByWorker(address);
    if (!details) {
      return res.json({
        success: true,
        data: { registered: false, upiId: null, accountHolderName: null, paymentMode: null }
      });
    }
    return res.json({
      success: true,
      data: {
        registered: true,
        upiId: details.upi_id || null,
        accountHolderName: details.account_holder_name || null,
        paymentMode: details.payment_mode || 'UPI',
        bankAccountNumber: details.bank_account_number ? `****${details.bank_account_number.slice(-4)}` : null,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

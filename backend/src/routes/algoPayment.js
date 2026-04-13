const express = require('express');
const router = express.Router();
const { Payment } = require('../models/Payment');
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const algorandService = require('../services/algorandService');
const exchangeRateService = require('../services/exchangeRateService');
const { isValidAlgorandAddress, isValidMilestones } = require('../utils/validators');

/**
 * POST /api/algo-payment/verify-and-deploy
 * Verify ALGO payment and deploy smart contract
 */
router.post('/verify-and-deploy', async (req, res) => {
  try {
    const {
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      amountAlgo,
      transactionId // Algorand transaction ID
    } = req.body;

    // Validation
    if (!contractorAddress || !supervisorAddress || !workerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required addresses'
      });
    }

    if (!isValidAlgorandAddress(contractorAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contractor address format'
      });
    }

    if (!isValidAlgorandAddress(supervisorAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid supervisor address format'
      });
    }

    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address format'
      });
    }

    if (!isValidMilestones(milestones)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid milestones'
      });
    }

    if (!amountAlgo || amountAlgo <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ALGO amount'
      });
    }

    console.log(`💳 Verifying ALGO payment: ${amountAlgo} ALGO from ${contractorAddress}`);

    // Get current ALGO/INR exchange rate
    const algoToINRRate = await exchangeRateService.getAlgoToINRRate();
    const amountINR = Math.round(amountAlgo * algoToINRRate);

    console.log(`💱 Converted: ${amountAlgo} ALGO = ₹${amountINR}`);

    // TODO: In production, verify the transaction actually exists on Algorand
    // For now, we'll trust the frontend sent a valid txid
    // In real world: await algorandService.verifyTransaction(transactionId);

    // Deploy smart contract
    console.log('📋 Deploying smart contract...');
    const deployResult = await algorandService.deployContract({
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      escrowAmount: amountAlgo
    });

    if (!deployResult || !deployResult.appId) {
      throw new Error('Smart contract deployment failed');
    }

    // Store payment record
    const payment = await Payment.create({
      razorpayOrderId: transactionId, // Use Algo txid here
      amountINR: amountINR,
      status: 'captured',
      metadata: {
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestones,
        amountAlgo,
        transactionId,
        algoToINRRate
      }
    });

    // Link payment to contract
    await Payment.linkToContract(payment.id, deployResult.contractId || deployResult.appId);

    console.log(`✅ Contract deployed: App ID ${deployResult.appId}`);
    console.log(`✅ Payment recorded: ${transactionId}`);

    res.json({
      success: true,
      data: {
        appId: deployResult.appId,
        contractId: deployResult.contractId,
        amountAlgo: amountAlgo,
        amountINR: amountINR,
        algoToINRRate: algoToINRRate,
        transactionId: transactionId,
        status: 'deployed'
      }
    });

  } catch (error) {
    console.error('ALGO payment verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process ALGO payment'
    });
  }
});

/**
 * GET /api/algo-payment/rate
 * Get current ALGO to INR exchange rate
 */
router.get('/rate', async (req, res) => {
  try {
    const rate = await exchangeRateService.getAlgoToINRRate();
    
    res.json({
      success: true,
      data: {
        algoToINR: rate,
        updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Rate fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange rate'
    });
  }
});

/**
 * POST /api/algo-payment/estimate
 * Estimate ALGO amount needed for INR value
 */
router.post('/estimate', async (req, res) => {
  try {
    const { amountINR } = req.body;

    if (!amountINR || amountINR <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid INR amount'
      });
    }

    const amountAlgo = await exchangeRateService.convertINRToAlgo(amountINR);
    const rate = await exchangeRateService.getAlgoToINRRate();

    res.json({
      success: true,
      data: {
        amountINR: amountINR,
        amountAlgo: parseFloat(amountAlgo.toFixed(6)),
        rate: rate,
        breakdown: {
          '1 ALGO': `₹${rate}`,
          'Required ALGO': amountAlgo.toFixed(6),
          'Total INR Value': amountINR
        }
      }
    });
  } catch (error) {
    console.error('Estimate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate estimate'
    });
  }
});

module.exports = router;

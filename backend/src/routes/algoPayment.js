const express = require('express');
const router = express.Router();
const { Payment } = require('../models/Payment');
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const algorandService = require('../services/algorandService');
const { algosdk } = require('../config/algorand');
const exchangeRateService = require('../services/exchangeRateService');
const { isValidAlgorandAddress, isValidMilestones } = require('../utils/validators');

/**
 * GET /api/algo-payment/workproof-programs
 * Returns compiled WorkProof app programs for wallet-signed deployment
 */
router.get('/workproof-programs', async (req, res) => {
  try {
    const programs = await algorandService.getCompiledWorkProofPrograms();

    res.json({
      success: true,
      data: {
        ...programs,
        methods: {
          createWorkContract: 'create_work_contract(account,account,account,uint64,byte[],pay)uint64',
          approveMilestone: 'approve_milestone(byte[],byte[])uint64'
        }
      }
    });
  } catch (error) {
    console.error('WorkProof program fetch error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load WorkProof programs' });
  }
});

/**
 * POST /api/algo-payment/register-deployment
 * Persist a wallet-signed on-chain deployment and escrow lock in local DB
 */
router.post('/register-deployment', async (req, res) => {
  try {
    const {
      appId,
      appCreateTxId,
      escrowTxId,
      setupCallTxId,
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      amountAlgo,
      transactionId
    } = req.body;

    const appIdNum = Number(appId);
    if (!appIdNum || Number.isNaN(appIdNum)) {
      return res.status(400).json({ success: false, error: 'Invalid app ID' });
    }

    if (!appCreateTxId || !escrowTxId || !setupCallTxId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required transaction ids: appCreateTxId, escrowTxId, setupCallTxId'
      });
    }

    if (!isValidAlgorandAddress(contractorAddress) || !isValidAlgorandAddress(supervisorAddress) || !isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid Algorand address in request' });
    }

    if (!isValidMilestones(milestones)) {
      return res.status(400).json({ success: false, error: 'Invalid milestones payload' });
    }

    if (milestones.length < 1 || milestones.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Milestone count must be between 1 and 20.'
      });
    }

    if (!amountAlgo || amountAlgo <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid ALGO amount' });
    }

    // Idempotency guard: if this app was already persisted, return existing contract.
    const existing = await Contract.findByAppId(appIdNum);
    if (existing) {
      return res.json({
        success: true,
        data: {
          appId: existing.app_id,
          contractId: existing.id,
          status: existing.status,
          alreadyRegistered: true
        }
      });
    }

    // Validate app existence on-chain.
    await algorandService.getContractState(appIdNum);

    // Validate escrow payment details on-chain.
    const escrowTxLookup = await algorandService.getTransactionById(escrowTxId);
    const escrowTx = escrowTxLookup?.transaction;
    const escrowDetails = escrowTx?.['payment-transaction'];
    const appAddress = algosdk.getApplicationAddress(appIdNum);

    if (!escrowDetails || escrowTx.sender !== contractorAddress || escrowDetails.receiver !== appAddress) {
      return res.status(400).json({
        success: false,
        error: 'Escrow transaction is invalid or does not fund this app address'
      });
    }

    const totalEscrowMicro = Math.round(Number(amountAlgo) * 1e6);
    if (Number(escrowDetails.amount || 0) !== totalEscrowMicro) {
      return res.status(400).json({
        success: false,
        error: `Escrow amount mismatch. Expected ${totalEscrowMicro} microALGO`
      });
    }

    const algoToINRRate = await exchangeRateService.getAlgoToINRRate();
    const amountINR = Number((Number(amountAlgo) * algoToINRRate).toFixed(2));

    const payment = await Payment.create({
      razorpayOrderId: transactionId || escrowTxId,
      amountINR,
      status: 'captured',
      metadata: {
        appId: appIdNum,
        appCreateTxId,
        setupCallTxId,
        escrowTxId,
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestones,
        amountAlgo,
        algoToINRRate,
        flow: 'wallet_signed_onchain_deploy'
      }
    });

    const contract = await Contract.create({
      appId: appIdNum,
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestoneCount: milestones.length,
      totalEscrow: Number(amountAlgo),
      totalEscrowInr: amountINR,
      algoToInrRate: algoToINRRate,
      algoTxid: escrowTxId,
      status: 'active'
    });

    for (let i = 0; i < milestones.length; i++) {
      await Milestone.create({
        contractId: contract.id,
        milestoneIndex: i,
        amount: Number(milestones[i].amount),
        amountInr: Number((Number(milestones[i].amount) * algoToINRRate).toFixed(2)),
        description: milestones[i].description,
        paid: false
      });
    }

    await Payment.linkToContract(payment.id, contract.id);

    return res.json({
      success: true,
      data: {
        appId: appIdNum,
        contractId: contract.id,
        amountAlgo: Number(amountAlgo),
        amountINR,
        algoToINRRate,
        escrowTxId,
        setupCallTxId,
        status: 'deployed'
      }
    });
  } catch (error) {
    console.error('Register on-chain deployment error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to register deployment' });
  }
});

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
      totalEscrow: amountAlgo
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

    // Ensure a local DB contract exists and link payment using contracts.id (FK target)
    let contract = await Contract.findByAppId(deployResult.appId);

    if (!contract) {
      contract = await Contract.create({
        appId: deployResult.appId,
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestoneCount: milestones.length,
        totalEscrow: amountAlgo,
        status: 'active'
      });

      for (let i = 0; i < milestones.length; i++) {
        await Milestone.create({
          contractId: contract.id,
          milestoneIndex: i,
          amount: milestones[i].amount,
          amountInr: Number((milestones[i].amount * algoToINRRate).toFixed(2)),
          description: milestones[i].description,
          paid: false
        });
      }
    }

    await Payment.linkToContract(payment.id, contract.id);

    console.log(`✅ Contract deployed: App ID ${deployResult.appId}`);
    console.log(`✅ Payment recorded: ${transactionId}`);

    res.json({
      success: true,
      data: {
        appId: deployResult.appId,
        contractId: contract.id,
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

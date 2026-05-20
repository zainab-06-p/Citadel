const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Payment } = require('../models/Payment');
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const algorandService = require('../services/algorandService');
const exchangeRateService = require('../services/exchangeRateService');
const { isValidAlgorandAddress, isValidMilestones } = require('../utils/validators');
const { algosdk } = require('../config/algorand');

const ESCROW_TOKEN_SECRET = process.env.ESCROW_TOKEN_SECRET || 'workproof-dev-escrow-secret';

function createEscrowToken(escrowAddress, escrowSecretB64) {
  const payload = Buffer.from(JSON.stringify({
    escrowAddress,
    escrowSecretB64,
    issuedAt: Date.now()
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', ESCROW_TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function parseEscrowToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Missing or invalid escrow token');
  }

  const [payload, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', ESCROW_TOKEN_SECRET).update(payload).digest('hex');

  if (signature !== expectedSignature) {
    throw new Error('Escrow token signature mismatch');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function buildContractInstanceAppId(onChainAppId) {
  const prefix = String(onChainAppId || 758015705).slice(0, 3);
  const suffix = Date.now().toString().slice(-6);
  return Number(`${prefix}${suffix}`);
}

async function ensureContractRecord({
  contractAppId,
  onChainAppId,
  contractorAddress,
  supervisorAddress,
  workerAddress,
  milestones,
  escrowAddress,
  escrowSecretB64,
  algoToINRRate,
  fundingTxid,
  totalEscrowAlgo
}) {
  let appIdCandidate = contractAppId;

  while (await Contract.findByAppId(appIdCandidate)) {
    appIdCandidate += 1;
  }

  const contract = await Contract.create({
    appId: appIdCandidate,
    onChainAppId,
    contractorAddress,
    supervisorAddress,
    workerAddress,
    milestoneCount: milestones.length,
    totalEscrow: totalEscrowAlgo,
    totalEscrowInr: Math.round(totalEscrowAlgo * algoToINRRate),
    algoToInrRate: algoToINRRate,
    algoTxid: fundingTxid,
    escrowAddress,
    escrowSecret: escrowSecretB64,
    status: 'active'
  });

  for (let i = 0; i < milestones.length; i++) {
    const amountAlgo = Number(milestones[i].amount) || 0;
    await Milestone.create({
      contractId: contract.id,
      milestoneIndex: i,
      amount: amountAlgo,
      amountInr: Number((amountAlgo * algoToINRRate).toFixed(2)),
      description: milestones[i].description,
      paid: false
    });
  }

  return contract;
}

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
      escrowAddress,
      escrowToken,
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

    if (!escrowAddress || typeof escrowAddress !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing escrow address'
      });
    }

    if (!escrowToken || typeof escrowToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing escrow token'
      });
    }

    if (!amountAlgo || amountAlgo <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ALGO amount'
      });
    }

    console.log(`💳 Verifying ALGO escrow payment: ${amountAlgo} ALGO from ${supervisorAddress}`);

    // Get current ALGO/INR exchange rate
    const algoToINRRate = await exchangeRateService.getAlgoToINRRate();
    const amountINR = Math.round(amountAlgo * algoToINRRate);

    console.log(`💱 Converted: ${amountAlgo} ALGO = ₹${amountINR}`);

    const escrowData = parseEscrowToken(escrowToken);
    if (escrowData.escrowAddress !== escrowAddress) {
      return res.status(400).json({
        success: false,
        error: 'Escrow token does not match escrow address'
      });
    }

    const expectedAmountMicroAlgos = Math.round(Number(amountAlgo) * 1_000_000);
    const fundingTxn = await algorandService.verifyPaymentTransaction({
      txid: transactionId,
      expectedSender: supervisorAddress,
      expectedReceiver: escrowAddress,
      expectedAmountMicroAlgos
    });

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

    const contractAppId = buildContractInstanceAppId(deployResult.appId);
    const contract = await ensureContractRecord({
      contractAppId,
      onChainAppId: deployResult.appId,
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      escrowAddress,
      escrowSecretB64: escrowData.escrowSecretB64,
      algoToINRRate,
      fundingTxid: fundingTxn.txid,
      totalEscrowAlgo: Number(amountAlgo)
    });

    // Store payment record
    const payment = await Payment.create({
      razorpayOrderId: transactionId, // Use Algo txid here
      amountINR: amountINR,
      status: 'captured',
      contractId: contract.id,
      metadata: {
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestones,
        amountAlgo,
        appId: contract.appId,
        onChainAppId: deployResult.appId,
        transactionId: fundingTxn.txid,
        escrowAddress,
        algoToINRRate
      }
    });

    console.log(`✅ Contract deployed: App ID ${deployResult.appId}`);
    console.log(`✅ Payment recorded: ${transactionId}`);

    res.json({
      success: true,
      data: {
        appId: contract.appId,
        onChainAppId: deployResult.appId,
        contractId: contract.id,
        amountAlgo: amountAlgo,
        amountINR: amountINR,
        algoToINRRate: algoToINRRate,
        transactionId: fundingTxn.txid,
        escrowAddress,
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

/**
 * POST /api/algo-payment/create-transaction
 * Create unsigned transaction for contractor to sign
 */
router.post('/create-transaction', async (req, res) => {
  try {
    const {
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      amountAlgo
    } = req.body;

    console.log('📝 Create transaction request:', {
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      amountAlgo
    });

    // Validate addresses
    if (!contractorAddress) {
      console.error('❌ Missing contractor address');
      return res.status(400).json({
        success: false,
        error: 'Contractor address is required'
      });
    }
    
    if (!supervisorAddress) {
      console.error('❌ Missing supervisor address');
      return res.status(400).json({
        success: false,
        error: 'Supervisor address is required'
      });
    }
    
    if (!workerAddress) {
      console.error('❌ Missing worker address');
      return res.status(400).json({
        success: false,
        error: 'Worker address is required'
      });
    }

    // For now, accept any non-empty address (in production, validate strictly)
    // Addresses should be 58 chars but accept any string for testing
    if (typeof contractorAddress !== 'string' || contractorAddress.length < 2) {
      console.error('❌ Invalid contractor address format:', contractorAddress);
      return res.status(400).json({
        success: false,
        error: 'Invalid contractor address format'
      });
    }
    
    if (typeof supervisorAddress !== 'string' || supervisorAddress.length < 2) {
      console.error('❌ Invalid supervisor address format:', supervisorAddress);
      return res.status(400).json({
        success: false,
        error: 'Invalid supervisor address format'
      });
    }
    
    if (typeof workerAddress !== 'string' || workerAddress.length < 2) {
      console.error('❌ Invalid worker address format:', workerAddress);
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address format'
      });
    }

    if (!Array.isArray(milestones) || milestones.length === 0) {
      console.error('❌ No milestones provided');
      return res.status(400).json({
        success: false,
        error: 'At least one milestone is required'
      });
    }

    // Normalize milestones - convert string amounts to numbers
    const normalizedMilestones = milestones.map(m => ({
      description: String(m.description).trim(),
      amount: Number(m.amount)
    }));

    console.log('📋 Normalized milestones:', normalizedMilestones);

    // Check each milestone individually
    for (let i = 0; i < normalizedMilestones.length; i++) {
      const m = normalizedMilestones[i];
      if (!m.description || m.description === '') {
        console.error(`❌ Milestone ${i} has no description:`, m);
        return res.status(400).json({
          success: false,
          error: `Milestone ${i + 1} must have a description`
        });
      }
      if (typeof m.amount !== 'number' || m.amount <= 0) {
        console.error(`❌ Milestone ${i} has invalid amount:`, m);
        return res.status(400).json({
          success: false,
          error: `Milestone ${i + 1} must have amount > 0 ALGO`
        });
      }
    }

    if (!amountAlgo || Number(amountAlgo) <= 0) {
      console.error('❌ Invalid ALGO amount:', amountAlgo);
      return res.status(400).json({
        success: false,
        error: 'Invalid ALGO amount'
      });
    }

    console.log(`✅ Create transaction validation passed for ${amountAlgo} ALGO`);

    const escrowAccount = algosdk.generateAccount();
    const escrowAddress = escrowAccount.addr.toString();
    const escrowSecretB64 = Buffer.from(escrowAccount.sk).toString('base64');
    const escrowToken = createEscrowToken(escrowAddress, escrowSecretB64);
    const amountMicroAlgos = Math.round(Number(amountAlgo) * 1_000_000);

    res.json({
      success: true,
      data: {
        escrowAddress,
        escrowToken,
        amountAlgo: Number(amountAlgo),
        amountMicroAlgos,
        paymentFrom: supervisorAddress,
        paymentTo: escrowAddress,
        network: 'testnet',
        note: `WORKPROOF_ESCROW:${Date.now()}`
      }
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create transaction'
    });
  }
});

/**
 * POST /api/algo-payment/submit-transaction
 * Legacy endpoint kept for backward compatibility.
 */
router.post('/submit-transaction', async (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'Legacy flow disabled. Use /api/algo-payment/create-transaction and then /api/algo-payment/verify-and-deploy.'
  });
});

/**
 * GET /api/algo-payment/contract-status/:txnId
 * Poll for contract deployment status
 */
router.get('/contract-status/:txnId', async (req, res) => {
  try {
    const { txnId } = req.params;

    // In a real implementation, you'd lookup the deployment status in the database
    // For now, check if a contract exists with this payment reference
    const payment = await Payment.findByOrderId(txnId);

    if (!payment) {
      return res.json({
        success: true,
        data: {
          deployed: false,
          appId: null,
          status: 'pending'
        }
      });
    }

    // Get associated contract using FK from payment
    const contract = payment.contract_id ? await Contract.findById(payment.contract_id) : null;

    if (contract) {
      return res.json({
        success: true,
        data: {
          deployed: true,
          appId: contract.app_id,
          onChainAppId: contract.on_chain_app_id || contract.app_id,
          contractId: contract.id,
          status: 'deployed'
        }
      });
    }

    res.json({
      success: true,
      data: {
        deployed: false,
        appId: null,
        status: 'processing'
      }
    });

  } catch (error) {
    console.error('Contract status error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contract status'
    });
  }
});

module.exports = router;

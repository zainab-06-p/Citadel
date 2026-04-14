const express = require('express');
const router = express.Router();
const { Payment } = require('../models/Payment');
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const razorpayService = require('../services/razorpayService');
const algorandService = require('../services/algorandService');
const { isValidAlgorandAddress, isValidMilestones, sanitizeString } = require('../utils/validators');

/**
 * POST /api/razorpay/create-order
 * Create a new payment order
 */
router.post('/create-order', async (req, res) => {
  try {
    const {
      contractorAddress,
      supervisorAddress,
      workerAddress,
      milestones,
      amountINR,
      currency = 'INR'
    } = req.body;
    
    // Validation
    if (!contractorAddress || !supervisorAddress || !workerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required addresses (contractor, supervisor, worker)'
      });
    }
    
    // Validate addresses
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
        error: 'Invalid milestones. Each milestone must have positive amount and description.'
      });
    }
    
    if (!amountINR || amountINR <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Must be positive INR amount.'
      });
    }
    
    // Sanitize inputs
    const cleanMilestones = milestones.map(m => ({
      amount: Math.floor(m.amount),
      description: sanitizeString(m.description)
    }));
    
    // Convert INR to paise (1 INR = 100 paise)
    const amountInPaise = Math.floor(amountINR * 100);
    
    // Create Razorpay order
    const order = await razorpayService.createOrder({
      amount: amountInPaise,
      currency,
      notes: {
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestoneCount: cleanMilestones.length.toString(),
        totalEscrow: cleanMilestones.reduce((sum, m) => sum + m.amount, 0).toString()
      }
    });
    
    // Store in database (pending payment)
    await Payment.create({
      razorpayOrderId: order.orderId,
      amountINR: amountINR,
      status: 'created',
      metadata: {
        contractorAddress,
        supervisorAddress,
        workerAddress,
        milestones: cleanMilestones
      }
    });
    
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        amount: amountINR,
        currency: currency,
        key: process.env.RAZORPAY_KEY_ID,
        checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js'
      }
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * POST /api/razorpay/webhook
 * Handle Razorpay payment webhook
 * NOTE: This route is registered with raw body parser in server.js
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    
    console.log('[Webhook] Received:', event.event);
    
    // Only process captured payments
    if (event.event !== 'payment.captured') {
      return res.json({ 
        success: true, 
        message: 'Event ignored',
        event: event.event 
      });
    }
    
    const payment = event.payload?.payment?.entity;
    
    if (!payment) {
      console.error('[Webhook] Missing payment entity');
      return res.status(400).json({
        success: false,
        error: 'Missing payment entity'
      });
    }
    
    const orderId = payment.order_id;
    const paymentId = payment.id;
    
    console.log(`[Webhook] Payment captured: ${paymentId} for order: ${orderId}`);
    
    // Find pending payment
    const pendingPayment = await Payment.findByOrderId(orderId);
    
    if (!pendingPayment) {
      console.error(`[Webhook] Payment not found for order: ${orderId}`);
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // Idempotency check
    if (pendingPayment.status === 'captured') {
      console.log(`[Webhook] Payment ${orderId} already processed`);
      return res.json({
        success: true,
        data: { alreadyProcessed: true, paymentId }
      });
    }
    
    // Parse metadata
    const metadata = JSON.parse(pendingPayment.metadata);
    
    // Update payment status
    await Payment.updateStatus(pendingPayment.id, 'captured', {
      razorpayPaymentId: paymentId,
      method: payment.method
    });
    
    // Deploy Algorand contract
    console.log('[Webhook] Deploying Algorand contract...');
    
    let deployResult;
    try {
      deployResult = await algorandService.deployContract({
        contractorAddress: metadata.contractorAddress,
        supervisorAddress: metadata.supervisorAddress,
        workerAddress: metadata.workerAddress,
        milestones: metadata.milestones,
        totalEscrow: metadata.milestones.reduce((sum, m) => sum + m.amount, 0)
      });
    } catch (deployError) {
      console.error('[Webhook] Contract deployment failed:', deployError);
      // Mark payment for manual review
      await Payment.updateStatus(pendingPayment.id, 'failed');
      throw deployError;
    }
    
    // Create contract record
    const contract = await Contract.create({
      appId: deployResult.appId,
      contractorAddress: metadata.contractorAddress,
      supervisorAddress: metadata.supervisorAddress,
      workerAddress: metadata.workerAddress,
      milestoneCount: metadata.milestones.length,
      totalEscrow: metadata.milestones.reduce((sum, m) => sum + m.amount, 0),
      status: 'active'
    });
    
    // Link payment to contract
    await Payment.linkToContract(pendingPayment.id, contract.id);
    
    // Create milestone records
    for (let i = 0; i < metadata.milestones.length; i++) {
      await Milestone.create({
        contractId: contract.id,
        milestoneIndex: i,
        amount: metadata.milestones[i].amount,
        description: metadata.milestones[i].description,
        paid: false
      });
    }
    
    console.log(`[Webhook] Contract deployed: ${deployResult.appId}`);
    
    res.json({
      success: true,
      data: {
        appId: deployResult.appId,
        txid: deployResult.txid,
        status: 'deployed',
        contractId: contract.id
      }
    });
    
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
    
    // Return 200 to prevent Razorpay retries
    // Log error for manual intervention
    res.status(200).json({
      success: false,
      error: error.message,
      requiresManualIntervention: true
    });
  }
});

/**
 * GET /api/razorpay/contract-status/:paymentId
 * Get deployed contract status by payment ID
 */
router.get('/contract-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Find payment by ID
    const payment = await Payment.findByPaymentId(paymentId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    // If contract is linked, return it
    if (payment.contract_id) {
      // Get contract from database using the contract ID stored in payment
      const contract = await Contract.findById(payment.contract_id);
      
      if (contract) {
        return res.json({
          success: true,
          data: {
            appId: contract.app_id || contract.appId,
            contractId: contract.id,
            status: contract.status,
            deployed: true
          }
        });
      }
    }
    
    // Contract not yet deployed
    res.json({
      success: true,
      data: {
        status: payment.status,
        deployed: false,
        message: 'Contract is being deployed...'
      }
    });
    
  } catch (error) {
    console.error('Get contract status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

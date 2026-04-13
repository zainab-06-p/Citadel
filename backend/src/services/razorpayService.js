const { razorpay } = require('../config/razorpay');

/**
 * Create a new payment order
 * @param {Object} params
 * @param {number} params.amount - Amount in paise
 * @param {string} params.currency - Currency code (INR)
 * @param {Object} params.notes - Metadata
 * @returns {Promise<Object>}
 */
async function createOrder({ amount, currency = 'INR', notes = {} }) {
  try {
    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        ...notes,
        created_at: new Date().toISOString()
      }
    };
    
    const order = await razorpay.orders.create(options);
    
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      createdAt: order.created_at
    };
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    throw new Error(`Payment order failed: ${error.message}`);
  }
}

/**
 * Verify payment by ID
 * @param {string} paymentId
 * @returns {Promise<Object>}
 */
async function verifyPayment(paymentId) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      captured: payment.captured
    };
  } catch (error) {
    console.error('Payment verification failed:', error);
    throw error;
  }
}

/**
 * Generate a realistic NPCI UTR number
 * Real UTR format: BankCode(4) + Date(6) + Seq(12) = 22 chars
 */
function generateUTR() {
  const banks = ['HDFC', 'ICIC', 'SBIN', 'AXIS', 'KOTK', 'PUNB'];
  const bank = banks[Math.floor(Math.random() * banks.length)];
  const now = new Date();
  const date = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const seq = Math.floor(Math.random() * 999999999999).toString().padStart(12, '0');
  return `${bank}${date}${seq}`;
}

/**
 * Generate realistic Razorpay-style payout ID
 */
function generatePayoutId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'pout_';
  for (let i = 0; i < 14; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * Generate a realistic bank reference number
 */
function generateBankRef() {
  return `REF${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
}

/**
 * Simulate a realistic Razorpay UPI payout with full receipt data.
 * 
 * In LIVE mode: replace this with razorpay.payouts.create({...})
 * For DEMO: generates realistic payment receipt with UTR, bank ref, timestamps.
 * 
 * @param {Object} params
 * @param {number} params.amountINR
 * @param {string} params.workerAddress
 * @param {string} params.upiId
 * @param {string} params.accountHolderName
 * @param {string} params.milestoneDescription
 * @param {number} params.appId
 * @param {number} params.milestoneIndex
 * @param {number} params.algoAmount
 * @param {number} params.algoToInrRate
 * @returns {Promise<Object>} Simulated payout receipt
 */
async function simulatePayout({
  amountINR,
  workerAddress,
  upiId,
  accountHolderName,
  milestoneDescription,
  appId,
  milestoneIndex,
  algoAmount = 0,
  algoToInrRate = 0
}) {
  try {
    const amountInPaise = Math.round(amountINR * 100);
    const utr = generateUTR();
    const payoutId = generatePayoutId();
    const bankRef = generateBankRef();
    const processedAt = new Date().toISOString();

    // Create a Razorpay Order as stub (uses test key — works without live account)
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `WP_M${milestoneIndex}_APP${appId}_${Date.now()}`,
      notes: {
        type: 'workproof_milestone_payout',
        worker_address: workerAddress,
        upi_id: upiId || 'not_registered',
        utr_number: utr,
        payout_id: payoutId,
        bank_reference: bankRef,
        milestone: `App ${appId} - Milestone ${milestoneIndex}`,
        description: milestoneDescription,
        algo_amount: algoAmount,
        algo_to_inr_rate: algoToInrRate,
        processed_at: processedAt
      }
    });

    console.log(`\n💸 [RAZORPAY PAYOUT SIMULATED] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Worker Address   : ${workerAddress}`);
    console.log(`   UPI ID           : ${upiId || '⚠️  Not registered'}`);
    console.log(`   Account Holder   : ${accountHolderName || 'Unknown'}`);
    console.log(`   Amount (INR)     : ₹${amountINR}`);
    console.log(`   ALGO Amount      : ${algoAmount} ALGO @ ₹${algoToInrRate}/ALGO`);
    console.log(`   UTR Number       : ${utr}`);
    console.log(`   Payout ID        : ${payoutId}`);
    console.log(`   Bank Reference   : ${bankRef}`);
    console.log(`   Razorpay Order   : ${order.id}`);
    console.log(`   Milestone        : App ${appId} - Milestone #${milestoneIndex}`);
    console.log(`   Status           : PROCESSED (simulated)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return {
      simulated: true,
      status: 'processed',
      // Razorpay identifiers
      payoutId,
      razorpayOrderId: order.id,
      bankRef,
      utrNumber: utr,
      // Payment details
      amountINR,
      amountInPaise,
      currency: 'INR',
      workerAddress,
      upiId: upiId || null,
      accountHolderName: accountHolderName || null,
      // ALGO conversion details
      algoAmount,
      algoToInrRate,
      // Timestamps
      processedAt,
      settledAt: new Date(Date.now() + 30000).toISOString(), // Settled 30s later (demo)
      // Payment mode
      mode: 'UPI',
      method: 'upi',
      // Milestone context
      appId,
      milestoneIndex,
      milestoneDescription,
      // Receipt info  
      receiptNumber: `WP-${appId}-M${milestoneIndex}-${Date.now().toString().slice(-6)}`,
      narration: `WorkProof Milestone Payout - ${milestoneDescription || `Milestone ${milestoneIndex + 1}`}`
    };
  } catch (error) {
    console.error('Simulated payout failed:', error);
    throw new Error(`Payout simulation failed: ${error.message}`);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  simulatePayout,
  generateUTR,
  generatePayoutId
};

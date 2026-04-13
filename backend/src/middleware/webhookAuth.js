const { verifyWebhookSignature } = require('../utils/hmac');

/**
 * Middleware to verify Razorpay webhook signature
 * Expects raw body (not parsed JSON)
 */
function webhookAuth(req, res, next) {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  
  if (!signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing X-Razorpay-Signature header'
    });
  }
  
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not configured');
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured'
    });
  }
  
  // req.body should be raw string at this point
  const body = req.body;
  
  const isValid = verifyWebhookSignature(body, signature, secret);
  
  if (!isValid) {
    console.error('Invalid webhook signature received');
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook signature'
    });
  }
  
  // Parse JSON after verification
  try {
    req.body = JSON.parse(body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON in webhook body'
    });
  }
}

module.exports = { webhookAuth };

const crypto = require('crypto');

/**
 * Verify Razorpay webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - X-Razorpay-Signature header
 * @param {string} secret - Webhook secret from Razorpay dashboard
 * @returns {boolean}
 */
function verifyWebhookSignature(body, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (e) {
    return false;
  }
}

/**
 * Generate HMAC for testing
 * @param {string} body - Request body
 * @param {string} secret - Secret key
 * @returns {string}
 */
function generateSignature(body, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
}

module.exports = {
  verifyWebhookSignature,
  generateSignature
};

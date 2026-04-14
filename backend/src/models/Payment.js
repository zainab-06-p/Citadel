const db = require('../config/database');

const Payment = {
  /**
   * Create a new payment record
   */
  async create({ razorpayOrderId, amountINR, status = 'created', metadata, contractId = null }) {
    const result = await db.run(
      `INSERT INTO payments (razorpay_order_id, amount_inr, status, metadata, contract_id)
       VALUES (?, ?, ?, ?, ?)`,
      [razorpayOrderId, amountINR, status, JSON.stringify(metadata), contractId]
    );
    
    return {
      id: result.lastID,
      razorpayOrderId,
      amountINR,
      status
    };
  },

  /**
   * Find payment by order ID
   */
  async findByOrderId(orderId) {
    return await db.get(
      'SELECT * FROM payments WHERE razorpay_order_id = ?',
      [orderId]
    );
  },

  /**
   * Find payment by payment ID
   */
  async findByPaymentId(paymentId) {
    return await db.get(
      'SELECT * FROM payments WHERE razorpay_payment_id = ?',
      [paymentId]
    );
  },

  /**
   * Update payment status
   */
  async updateStatus(id, status, { razorpayPaymentId = null, method = null } = {}) {
    const updates = ['status = ?', 'updated_at = ?'];
    const values = [status, new Date().toISOString()];
    
    if (razorpayPaymentId) {
      updates.push('razorpay_payment_id = ?');
      values.push(razorpayPaymentId);
    }
    
    values.push(id);
    
    await db.run(
      `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    return { id, status };
  },

  /**
   * Link payment to contract
   */
  async linkToContract(id, contractId) {
    await db.run(
      'UPDATE payments SET contract_id = ? WHERE id = ?',
      [contractId, id]
    );
    
    return { id, contractId };
  }
};

module.exports = { Payment };

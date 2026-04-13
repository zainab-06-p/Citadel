const db = require('../config/database');

const Milestone = {
  /**
   * Create a new milestone
   */
  async create({ contractId, milestoneIndex, amount, amountInr = 0, description, paid = false }) {
    const result = await db.run(
      `INSERT INTO milestones (contract_id, milestone_index, amount, amount_inr, description, paid)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contractId, milestoneIndex, amount, amountInr, description, paid]
    );
    
    return {
      id: result.lastID,
      contractId,
      milestoneIndex,
      amount,
      amountInr,
      description,
      paid
    };
  },

  /**
   * Find milestones by contract ID
   */
  async findByContract(contractId) {
    return await db.all(
      'SELECT * FROM milestones WHERE contract_id = ? ORDER BY milestone_index',
      [contractId]
    );
  },

  /**
   * Find milestone by contract and index
   */
  async findByContractAndIndex(contractId, milestoneIndex) {
    return await db.get(
      'SELECT * FROM milestones WHERE contract_id = ? AND milestone_index = ?',
      [contractId, milestoneIndex]
    );
  },

  /**
   * Update milestone as paid
   */
  async markPaid(id, { txid, assetId, paidAt }) {
    await db.run(
      `UPDATE milestones 
       SET paid = 1, txid = ?, asset_id = ?, paid_at = ?
       WHERE id = ?`,
      [txid, assetId, paidAt, id]
    );
    
    return { id, paid: true, txid, assetId };
  },

  /**
   * Mark certificate as generated
   */
  async markCertificateGenerated(id) {
    await db.run(
      'UPDATE milestones SET certificate_generated = 1 WHERE id = ?',
      [id]
    );
    
    return { id, certificateGenerated: true };
  },

  /**
   * Get unpaid milestones for a contract
   */
  async getUnpaidByContract(contractId) {
    return await db.all(
      'SELECT * FROM milestones WHERE contract_id = ? AND paid = 0 ORDER BY milestone_index',
      [contractId]
    );
  },

  /**
   * Get all unpaid milestones (for watcher)
   */
  async getAllUnpaid() {
    return await db.all(`
      SELECT m.*, c.app_id, c.worker_address 
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE m.paid = 0 AND c.status = 'active'
    `);
  },

  /**
   * Record that a Razorpay payout was triggered for this milestone
   */
  async markPayoutTriggered(id, { razorpayPayoutId, payoutSimulated = true }) {
    await db.run(
      `UPDATE milestones
       SET razorpay_payout_id = ?, payout_status = 'triggered', payout_simulated = ?
       WHERE id = ?`,
      [razorpayPayoutId, payoutSimulated ? 1 : 0, id]
    );
    return { id, razorpayPayoutId, payoutStatus: 'triggered' };
  }
};

module.exports = { Milestone };

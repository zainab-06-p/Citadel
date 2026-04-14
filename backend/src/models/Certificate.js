const db = require('../config/database');

const Certificate = {
  /**
   * Create a new certificate record
   */
  async create({ contractId, milestoneId, pdfPath, ipfsHash = null, txid, assetId, razorpayPaymentId = null }) {
    const result = await db.run(
      `INSERT INTO certificates (contract_id, milestone_id, pdf_path, ipfs_hash, txid, asset_id, razorpay_payment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [contractId, milestoneId, pdfPath, ipfsHash, txid, assetId, razorpayPaymentId]
    );
    
    return {
      id: result.lastID,
      contractId,
      milestoneId,
      pdfPath,
      generatedAt: new Date().toISOString()
    };
  },

  /**
   * Find certificate by milestone ID
   */
  async findByMilestone(milestoneId) {
    return await db.get(
      'SELECT * FROM certificates WHERE milestone_id = ?',
      [milestoneId]
    );
  },

  /**
   * Find certificates by contract ID
   */
  async findByContract(contractId) {
    return await db.all(
      'SELECT * FROM certificates WHERE contract_id = ? ORDER BY generated_at DESC',
      [contractId]
    );
  },

  /**
   * Find certificates by worker address
   */
  async findByWorker(workerAddress) {
    return await db.all(`
      SELECT c.*, ct.app_id, ct.worker_address, m.milestone_index, m.amount, m.description
      FROM certificates c
      JOIN contracts ct ON c.contract_id = ct.id
      JOIN milestones m ON c.milestone_id = m.id
      WHERE ct.worker_address = ?
      ORDER BY c.generated_at DESC
    `, [workerAddress]);
  },

  /**
   * Check if certificate exists for milestone
   */
  async existsForMilestone(milestoneId) {
    const result = await db.get(
      'SELECT 1 FROM certificates WHERE milestone_id = ?',
      [milestoneId]
    );
    return !!result;
  }
};

module.exports = { Certificate };

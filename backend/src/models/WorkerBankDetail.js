const db = require('../config/database');

const WorkerBankDetail = {
  /**
   * Save or update worker bank/UPI details
   */
  async upsert({ workerAddress, upiId, bankAccountNumber, bankIfsc, accountHolderName, paymentMode = 'UPI' }) {
    const existing = await this.findByWorker(workerAddress);

    if (existing) {
      await db.run(
        `UPDATE worker_bank_details
         SET upi_id = ?, bank_account_number = ?, bank_ifsc = ?,
             account_holder_name = ?, payment_mode = ?, updated_at = ?
         WHERE worker_address = ?`,
        [upiId || null, bankAccountNumber || null, bankIfsc || null,
         accountHolderName || null, paymentMode, new Date().toISOString(), workerAddress]
      );
      return { ...existing, upiId, bankAccountNumber, bankIfsc, accountHolderName, paymentMode };
    } else {
      const result = await db.run(
        `INSERT INTO worker_bank_details
           (worker_address, upi_id, bank_account_number, bank_ifsc, account_holder_name, payment_mode)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [workerAddress, upiId || null, bankAccountNumber || null, bankIfsc || null,
         accountHolderName || null, paymentMode]
      );
      return { id: result.lastID, workerAddress, upiId, paymentMode };
    }
  },

  /**
   * Find bank details by worker address
   */
  async findByWorker(workerAddress) {
    return await db.get(
      'SELECT * FROM worker_bank_details WHERE worker_address = ?',
      [workerAddress]
    );
  },

  /**
   * Store the Razorpay fund_account_id once registered (for live mode)
   */
  async saveFundAccountId(workerAddress, fundAccountId) {
    await db.run(
      'UPDATE worker_bank_details SET fund_account_id = ? WHERE worker_address = ?',
      [fundAccountId, workerAddress]
    );
  }
};

module.exports = { WorkerBankDetail };

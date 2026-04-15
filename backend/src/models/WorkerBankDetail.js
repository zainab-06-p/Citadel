const db = require('../config/database');
const { supabase, hasSupabaseConfig } = require('../config/supabase');

function mapSupabaseRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    worker_address: record.worker_address,
    upi_id: record.upi_id,
    bank_account_number: record.bank_account_number,
    bank_ifsc: record.bank_ifsc,
    account_holder_name: record.account_holder_name,
    payment_mode: record.payment_mode,
    fund_account_id: record.fund_account_id,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

const WorkerBankDetail = {
  /**
   * Save or update worker bank/UPI details
   */
  async upsert({ workerAddress, upiId, bankAccountNumber, bankIfsc, accountHolderName, paymentMode = 'UPI' }) {
    if (hasSupabaseConfig) {
      try {
        const payload = {
          worker_address: workerAddress,
          upi_id: upiId || null,
          bank_account_number: bankAccountNumber || null,
          bank_ifsc: bankIfsc || null,
          account_holder_name: accountHolderName || null,
          payment_mode: paymentMode,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('worker_bank_details')
          .upsert(payload, { onConflict: 'worker_address' })
          .select('*')
          .single();

        if (error) {
          throw new Error(error.message);
        }

        return mapSupabaseRecord(data);
      } catch (error) {
        console.warn(`Supabase upsert failed, falling back to SQLite: ${error.message}`);
      }
    }

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
    if (hasSupabaseConfig) {
      try {
        const { data, error } = await supabase
          .from('worker_bank_details')
          .select('*')
          .eq('worker_address', workerAddress)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return mapSupabaseRecord(data);
      } catch (error) {
        console.warn(`Supabase fetch failed, falling back to SQLite: ${error.message}`);
      }
    }

    return await db.get(
      'SELECT * FROM worker_bank_details WHERE worker_address = ?',
      [workerAddress]
    );
  },

  /**
   * Store the Razorpay fund_account_id once registered (for live mode)
   */
  async saveFundAccountId(workerAddress, fundAccountId) {
    if (hasSupabaseConfig) {
      try {
        const { error } = await supabase
          .from('worker_bank_details')
          .update({ fund_account_id: fundAccountId, updated_at: new Date().toISOString() })
          .eq('worker_address', workerAddress);

        if (error) {
          throw new Error(error.message);
        }
        return;
      } catch (error) {
        console.warn(`Supabase update failed, falling back to SQLite: ${error.message}`);
      }
    }

    await db.run(
      'UPDATE worker_bank_details SET fund_account_id = ? WHERE worker_address = ?',
      [fundAccountId, workerAddress]
    );
  }
};

module.exports = { WorkerBankDetail };

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../database');
const DB_PATH = path.join(DB_DIR, 'workproof.db');

// Ensure the database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Promisify database methods
// NOTE: db.run uses `this` context to expose lastID/changes — cannot use util.promisify directly
const dbAsync = {
  run: (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  }),
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  }),
  exec: (sql) => new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  }),
  close: () => new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  })
};

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Initialize database with tables
async function initDatabase() {
  try {
    // Payments table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        razorpay_payment_id TEXT UNIQUE,
        razorpay_order_id TEXT NOT NULL,
        amount_inr INTEGER NOT NULL,
        status TEXT DEFAULT 'created' CHECK (status IN ('created', 'captured', 'failed')),
        contract_id INTEGER,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contract_id) REFERENCES contracts(id)
      )
    `);

    // Contracts table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER UNIQUE NOT NULL,
        contractor_address TEXT NOT NULL,
        supervisor_address TEXT NOT NULL,
        worker_address TEXT NOT NULL,
        milestone_count INTEGER NOT NULL,
        total_escrow INTEGER NOT NULL,
        total_escrow_inr REAL DEFAULT 0,
        algo_to_inr_rate REAL DEFAULT 0,
        algo_txid TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deployed_at DATETIME
      )
    `);

    // Migrate existing contracts table (add new columns if missing)
    try { await dbAsync.run(`ALTER TABLE contracts ADD COLUMN total_escrow_inr REAL DEFAULT 0`); } catch(e) {}
    try { await dbAsync.run(`ALTER TABLE contracts ADD COLUMN algo_to_inr_rate REAL DEFAULT 0`); } catch(e) {}
    try { await dbAsync.run(`ALTER TABLE contracts ADD COLUMN algo_txid TEXT`); } catch(e) {}

    // Milestones table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL,
        milestone_index INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        amount_inr REAL DEFAULT 0,
        description TEXT,
        paid BOOLEAN DEFAULT 0,
        txid TEXT,
        asset_id INTEGER,
        paid_at DATETIME,
        certificate_generated BOOLEAN DEFAULT 0,
        razorpay_payout_id TEXT,
        payout_status TEXT DEFAULT 'pending',
        payout_simulated BOOLEAN DEFAULT 0,
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        UNIQUE(contract_id, milestone_index)
      )
    `);

    // Migrate existing milestones table (add new columns if missing)
    try { await dbAsync.run(`ALTER TABLE milestones ADD COLUMN amount_inr REAL DEFAULT 0`); } catch(e) {}
    try { await dbAsync.run(`ALTER TABLE milestones ADD COLUMN razorpay_payout_id TEXT`); } catch(e) {}
    try { await dbAsync.run(`ALTER TABLE milestones ADD COLUMN payout_status TEXT DEFAULT 'pending'`); } catch(e) {}
    try { await dbAsync.run(`ALTER TABLE milestones ADD COLUMN payout_simulated BOOLEAN DEFAULT 0`); } catch(e) {}

    // Certificates table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id INTEGER NOT NULL,
        milestone_id INTEGER UNIQUE,
        pdf_path TEXT NOT NULL,
        ipfs_hash TEXT,
        txid TEXT NOT NULL,
        asset_id INTEGER NOT NULL,
        razorpay_payment_id TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (milestone_id) REFERENCES milestones(id)
      )
    `);

    // Consent logs table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS consent_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_address TEXT NOT NULL,
        institution_address TEXT NOT NULL,
        institution_name TEXT,
        scope_type TEXT NOT NULL,
        scope_contracts TEXT,
        scope_fields TEXT,
        scope_purpose TEXT,
        scope_expiry DATETIME,
        granted BOOLEAN DEFAULT 1,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        revoked_at DATETIME,
        txid TEXT,
        consent_id INTEGER,
        ip_address TEXT,
        user_agent TEXT
      )
    `);

    // Credit scores table for AI credit scoring
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS credit_scores (
        worker_address TEXT PRIMARY KEY,
        score_value INTEGER NOT NULL CHECK (score_value >= 0 AND score_value <= 100),
        factors_json TEXT NOT NULL,
        risk_category TEXT NOT NULL,
        max_loan_amount INTEGER NOT NULL DEFAULT 0,
        interest_rate REAL NOT NULL DEFAULT 0,
        tenure_months INTEGER NOT NULL DEFAULT 0,
        emi INTEGER NOT NULL DEFAULT 0,
        calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        refresh_at DATETIME NOT NULL
      )
    `);

    // Worker bank details table (for Razorpay payout routing)
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS worker_bank_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_address TEXT UNIQUE NOT NULL,
        upi_id TEXT,
        bank_account_number TEXT,
        bank_ifsc TEXT,
        account_holder_name TEXT,
        payment_mode TEXT DEFAULT 'UPI' CHECK (payment_mode IN ('UPI', 'IMPS', 'NEFT')),
        fund_account_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Watch cursor table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS watch_cursor (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_round INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index worker bank details
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_worker_bank ON worker_bank_details(worker_address)`);

    // Create indexes
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_payments_razorpay ON payments(razorpay_payment_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(razorpay_order_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_contracts_app ON contracts(app_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_contracts_worker ON contracts(worker_address)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_milestones_contract ON milestones(contract_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_milestones_paid ON milestones(paid)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_consent_worker ON consent_logs(worker_address)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_credit_scores_score ON credit_scores(score_value)`);

    // Initialize watch cursor
    const cursor = await dbAsync.get('SELECT * FROM watch_cursor WHERE id = 1');
    if (!cursor) {
      await dbAsync.run('INSERT INTO watch_cursor (id, last_round) VALUES (1, 0)');
    }

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Export both db (for direct access) and dbAsync (for promises)
module.exports = {
  db,
  ...dbAsync,
  initDatabase
};

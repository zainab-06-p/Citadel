const db = require('../config/database');

const ConsentLog = {
  /**
   * Record a new consent grant
   */
  async create({
    workerAddress,
    institutionAddress,
    institutionName,
    scopeType,
    scopeContracts = [],
    scopeFields = [],
    scopePurpose,
    scopeExpiry = null,
    txid,
    consentId,
    ipAddress = null,
    userAgent = null
  }) {
    const result = await db.run(
      `INSERT INTO consent_logs (
        worker_address, institution_address, institution_name,
        scope_type, scope_contracts, scope_fields, scope_purpose, scope_expiry,
        txid, consent_id, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workerAddress,
        institutionAddress,
        institutionName,
        scopeType,
        JSON.stringify(scopeContracts),
        JSON.stringify(scopeFields),
        scopePurpose,
        scopeExpiry,
        txid,
        consentId,
        ipAddress,
        userAgent
      ]
    );
    
    return {
      id: result.lastID,
      workerAddress,
      institutionAddress,
      scopeType,
      granted: true
    };
  },

  /**
   * Record consent revocation
   */
  async revoke(consentId, txid) {
    await db.run(
      `UPDATE consent_logs 
       SET granted = 0, revoked_at = ?, txid = ?
       WHERE consent_id = ?`,
      [new Date().toISOString(), txid, consentId]
    );
    
    return { consentId, granted: false };
  },

  /**
   * Get consent log for a worker
   */
  async getLog(workerAddress, { institutionAddress = null, activeOnly = false } = {}) {
    let query = 'SELECT * FROM consent_logs WHERE worker_address = ?';
    const params = [workerAddress];
    
    if (institutionAddress) {
      query += ' AND institution_address = ?';
      params.push(institutionAddress);
    }
    
    if (activeOnly) {
      query += ' AND granted = 1';
    }
    
    query += ' ORDER BY granted_at DESC';
    
    return await db.all(query, params);
  },

  /**
   * Verify active consent exists
   */
  async verifyActive(workerAddress, institutionAddress, scopeType) {
    const consent = await db.get(
      `SELECT * FROM consent_logs 
       WHERE worker_address = ? 
         AND institution_address = ? 
         AND scope_type = ?
         AND granted = 1
         AND (scope_expiry IS NULL OR scope_expiry > datetime('now'))
       ORDER BY granted_at DESC
       LIMIT 1`,
      [workerAddress, institutionAddress, scopeType]
    );
    
    return {
      hasConsent: !!consent,
      consent: consent ? {
        id: consent.id,
        consentId: consent.consent_id,
        grantedAt: consent.granted_at,
        expiry: consent.scope_expiry
      } : null
    };
  },

  /**
   * Get institutions with access to worker data
   */
  async getInstitutions(workerAddress) {
    return await db.all(
      `SELECT 
        institution_address,
        institution_name,
        scope_type,
        granted_at,
        scope_expiry
       FROM consent_logs 
       WHERE worker_address = ? AND granted = 1
       ORDER BY granted_at DESC`,
      [workerAddress]
    );
  }
};

module.exports = { ConsentLog };

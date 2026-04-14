const { ConsentLog } = require('../models/ConsentLog');

/**
 * Record a consent grant
 */
async function recordConsentGrant({
  workerAddress,
  institutionAddress,
  institutionName,
  scope,
  txid,
  consentId,
  ipAddress,
  userAgent
}) {
  return await ConsentLog.create({
    workerAddress,
    institutionAddress,
    institutionName,
    scopeType: scope.type,
    scopeContracts: scope.contracts || [],
    scopeFields: scope.fields || [],
    scopePurpose: scope.purpose,
    scopeExpiry: scope.expiry,
    txid,
    consentId,
    ipAddress,
    userAgent
  });
}

/**
 * Record consent revocation
 */
async function recordConsentRevoke(consentId, txid) {
  return await ConsentLog.revoke(consentId, txid);
}

/**
 * Get consent audit log
 */
async function getConsentLog(workerAddress, options = {}) {
  return await ConsentLog.getLog(workerAddress, options);
}

/**
 * Verify active consent
 */
async function verifyActiveConsent(workerAddress, institutionAddress, scopeType) {
  return await ConsentLog.verifyActive(workerAddress, institutionAddress, scopeType);
}

/**
 * Get institutions with access
 */
async function getAuthorizedInstitutions(workerAddress) {
  return await ConsentLog.getInstitutions(workerAddress);
}

module.exports = {
  recordConsentGrant,
  recordConsentRevoke,
  getConsentLog,
  verifyActiveConsent,
  getAuthorizedInstitutions
};

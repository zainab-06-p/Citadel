/**
 * routes/creditOracle.js
 * =======================
 * REST endpoints for WorkProofCreditOracle contract.
 */
const express = require('express');
const router  = express.Router();
const { getWorkerProfile, buildRegisterCredentialTxn, ORACLE_APP_ID } = require('../services/creditOracleService');

/**
 * GET /api/credit-oracle/profile/:address
 * Read on-chain credit profile for a worker.
 */
router.get('/profile/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const profile = await getWorkerProfile(address);
    if (!profile) {
      return res.json({
        success: true,
        registered: false,
        profile: null,
        appId: ORACLE_APP_ID(),
      });
    }
    return res.json({ success: true, registered: true, profile, appId: ORACLE_APP_ID() });
  } catch (err) {
    console.error('GET /credit-oracle/profile error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/credit-oracle/register-credential
 * Build an unsigned register_credential txn for the worker to sign.
 * Body: { workerAddress, credentialAssetId, incomeAmountMicroAlgo }
 */
router.post('/register-credential', async (req, res) => {
  try {
    const { workerAddress, credentialAssetId, incomeAmountMicroAlgo } = req.body;
    if (!workerAddress || !credentialAssetId || !incomeAmountMicroAlgo) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const unsignedTxnB64 = await buildRegisterCredentialTxn({
      workerAddress,
      credentialAssetId: parseInt(credentialAssetId),
      incomeAmountMicroAlgo: parseInt(incomeAmountMicroAlgo),
    });
    return res.json({ success: true, unsignedTxn: unsignedTxnB64, appId: ORACLE_APP_ID() });
  } catch (err) {
    console.error('POST /credit-oracle/register-credential error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { ConsentLog } = require('../models/ConsentLog');
const consentService = require('../services/consentService');
const { isValidAlgorandAddress } = require('../utils/validators');

/**
 * POST /api/consent/grant
 * Grant consent to an institution
 */
router.post('/grant', async (req, res) => {
  try {
    const {
      workerAddress,
      institutionAddress,
      institutionName,
      scope,
      txid,
      consentId
    } = req.body;
    
    // Validation
    if (!workerAddress || !institutionAddress || !scope || !txid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workerAddress, institutionAddress, scope, txid'
      });
    }
    
    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address format'
      });
    }
    
    if (!isValidAlgorandAddress(institutionAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid institution address format'
      });
    }
    
    // Record consent
    const result = await consentService.recordConsentGrant({
      workerAddress,
      institutionAddress,
      institutionName: institutionName || 'Unknown Institution',
      scope,
      txid,
      consentId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Grant consent error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/consent/revoke
 * Revoke previously granted consent
 */
router.post('/revoke', async (req, res) => {
  try {
    const { consentId, txid } = req.body;
    
    if (!consentId || !txid) {
      return res.status(400).json({
        success: false,
        error: 'Missing consentId or txid'
      });
    }
    
    const result = await consentService.recordConsentRevoke(consentId, txid);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Revoke consent error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/consent/:workerAddress/log
 * Get audit log of all consent grants/revocations
 */
router.get('/:workerAddress/log', async (req, res) => {
  try {
    const { workerAddress } = req.params;
    const { institution, active } = req.query;
    
    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address format'
      });
    }
    
    const logs = await consentService.getConsentLog(workerAddress, {
      institutionAddress: institution,
      activeOnly: active === 'true'
    });
    
    res.json({
      success: true,
      data: {
        workerAddress,
        totalRecords: logs.length,
        logs: logs.map(log => ({
          id: log.id,
          consentId: log.consent_id,
          institution: {
            name: log.institution_name,
            address: log.institution_address
          },
          scope: {
            type: log.scope_type,
            contracts: JSON.parse(log.scope_contracts || '[]'),
            fields: JSON.parse(log.scope_fields || '[]'),
            purpose: log.scope_purpose,
            expiry: log.scope_expiry
          },
          status: log.granted ? 'active' : 'revoked',
          grantedAt: log.granted_at,
          revokedAt: log.revoked_at,
          txid: log.txid
        }))
      }
    });
    
  } catch (error) {
    console.error('Get consent log error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/consent/:workerAddress/institutions
 * Get list of institutions with access
 */
router.get('/:workerAddress/institutions', async (req, res) => {
  try {
    const { workerAddress } = req.params;
    
    if (!isValidAlgorandAddress(workerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid worker address format'
      });
    }
    
    const institutions = await consentService.getAuthorizedInstitutions(workerAddress);
    
    res.json({
      success: true,
      data: {
        workerAddress,
        totalInstitutions: institutions.length,
        institutions
      }
    });
    
  } catch (error) {
    console.error('Get institutions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/consent/verify
 * Verify if active consent exists (for institutions)
 */
router.post('/verify', async (req, res) => {
  try {
    const { workerAddress, institutionAddress, scopeType } = req.body;
    
    if (!workerAddress || !institutionAddress || !scopeType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: workerAddress, institutionAddress, scopeType'
      });
    }
    
    const result = await consentService.verifyActiveConsent(
      workerAddress,
      institutionAddress,
      scopeType
    );
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Verify consent error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

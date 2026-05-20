/**
 * routes/invoiceGuard.js
 * =======================
 * REST endpoints for InvoiceGuard contract.
 */
const express = require('express');
const router  = express.Router();
const {
  getInvoiceState,
  buildTokenizeInvoiceTxn,
  buildRegisterInvoiceTxn,
  buildPledgeTxn,
  INVOICE_GUARD_APP_ID,
} = require('../services/invoiceGuardService');

/**
 * GET /api/invoice-guard/invoice/:assetId
 */
router.get('/invoice/:assetId', async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId);
    const state   = await getInvoiceState(assetId);
    if (!state) {
      return res.status(404).json({ success: false, error: 'Invoice not found on-chain' });
    }
    return res.json({ success: true, invoice: state, appId: INVOICE_GUARD_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/invoice-guard/tokenize
 * Body: { contractorAddress, invoiceName, invoiceAmountPaise, dueDateUnix, metadataUrl }
 */
router.post('/tokenize', async (req, res) => {
  try {
    const { contractorAddress, invoiceName, invoiceAmountPaise, dueDateUnix, metadataUrl } = req.body;
    if (!contractorAddress || !invoiceName || !invoiceAmountPaise) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const txn = await buildTokenizeInvoiceTxn({
      contractorAddress,
      invoiceName,
      invoiceAmountPaise: parseInt(invoiceAmountPaise),
      dueDateUnix:        parseInt(dueDateUnix || Math.floor(Date.now() / 1000) + 30 * 86400),
      metadataUrl:        metadataUrl || '',
    });
    return res.json({ success: true, unsignedTxn: txn, appId: INVOICE_GUARD_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/invoice-guard/pledge
 * Body: { contractorAddress, invoiceAssetId, workproofAppId }
 */
router.post('/pledge', async (req, res) => {
  try {
    const { contractorAddress, invoiceAssetId, workproofAppId } = req.body;
    const txn = await buildPledgeTxn({
      contractorAddress,
      invoiceAssetId:  parseInt(invoiceAssetId),
      workproofAppId:  parseInt(workproofAppId || process.env.WORKPROOF_APP_ID || 0),
    });
    return res.json({ success: true, unsignedTxn: txn, appId: INVOICE_GUARD_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/invoice-guard/register
 * Body: { contractorAddress, invoiceAssetId, invoiceAmountPaise, dueDateUnix }
 * Step 2 after tokenize — writes box data with the now-known ASA ID.
 */
router.post('/register', async (req, res) => {
  try {
    const { contractorAddress, invoiceAssetId, invoiceAmountPaise, dueDateUnix } = req.body;
    if (!contractorAddress || !invoiceAssetId) {
      return res.status(400).json({ success: false, error: 'Missing contractorAddress or invoiceAssetId' });
    }
    const txn = await buildRegisterInvoiceTxn({
      contractorAddress,
      invoiceAssetId:    parseInt(invoiceAssetId),
      invoiceAmountPaise: parseInt(invoiceAmountPaise || 0),
      dueDateUnix:       parseInt(dueDateUnix || Math.floor(Date.now() / 1000) + 30 * 86400),
    });
    return res.json({ success: true, unsignedTxn: txn, appId: INVOICE_GUARD_APP_ID() });
  } catch (err) {
    console.error('POST /register error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

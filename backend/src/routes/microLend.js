/**
 * routes/microLend.js
 * ====================
 * REST endpoints for MicroLendPool contract.
 */
const express = require('express');
const router  = express.Router();
const {
  getAccountState,
  buildRequestLoanTxn,
  buildRepayLoanTxn,
  buildDepositTxn,
  MICROLEND_APP_ID,
} = require('../services/microLendService');

/**
 * GET /api/micro-lend/state/:address
 */
router.get('/state/:address', async (req, res) => {
  try {
    const state = await getAccountState(req.params.address);
    const STATUS_LABELS = ['No Loan', 'Active', 'Repaid', 'Defaulted'];
    return res.json({
      success: true,
      state: state ? { ...state, loanStatusLabel: STATUS_LABELS[state.loanStatus] ?? 'Unknown' } : null,
      appId: MICROLEND_APP_ID(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/micro-lend/request-loan
 * Body: { borrowerAddress, amount, consistencyScore, creditLimit }
 */
router.post('/request-loan', async (req, res) => {
  try {
    const { borrowerAddress, amount, consistencyScore, creditLimit } = req.body;
    if (!borrowerAddress || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const txn = await buildRequestLoanTxn({
      borrowerAddress,
      amount:            parseInt(amount),
      consistencyScore:  parseInt(consistencyScore || 50),
      creditLimit:       parseInt(creditLimit || amount),
    });
    return res.json({ success: true, unsignedTxn: txn, appId: MICROLEND_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/micro-lend/repay
 * Body: { borrowerAddress, repaymentMicroAlgo }
 */
router.post('/repay', async (req, res) => {
  try {
    const { borrowerAddress, repaymentMicroAlgo } = req.body;
    const txns = await buildRepayLoanTxn({
      borrowerAddress,
      repaymentMicroAlgo: parseInt(repaymentMicroAlgo),
    });
    return res.json({ success: true, ...txns, appId: MICROLEND_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/micro-lend/deposit
 * Body: { lenderAddress, amountMicroAlgo }
 */
router.post('/deposit', async (req, res) => {
  try {
    const { lenderAddress, amountMicroAlgo } = req.body;
    const txns = await buildDepositTxn({
      lenderAddress,
      amountMicroAlgo: parseInt(amountMicroAlgo),
    });
    return res.json({ success: true, ...txns, appId: MICROLEND_APP_ID() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

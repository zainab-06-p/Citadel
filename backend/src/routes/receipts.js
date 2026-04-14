/**
 * Receipts Route — serves styled HTML receipts (printable to PDF via browser)
 *
 * GET /api/receipts/:appId/escrow-lock               — Pre-funds receipt (contractor locked ALGO)
 * GET /api/receipts/:appId/milestone/:index/payment  — Post-payment receipt (INR sent to worker)
 * GET /api/receipts/worker/:address/contracts        — All escrow receipts for a worker (their contracts)
 */
const express = require('express');
const router = express.Router();
const { Contract } = require('../models/Contract');
const { Milestone } = require('../models/Milestone');
const { WorkerBankDetail } = require('../models/WorkerBankDetail');
const { generateEscrowLockReceipt, generatePaymentReceipt, generateWorkCertificate, renderHTMLToPDF } = require('../services/receiptService');

// Helper — serve HTML or JSON error
function sendHTML(res, html, filename, downloadMode = false) {
  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    // Inline (view in browser) or attachment (download as file)
    'Content-Disposition': downloadMode 
      ? `attachment; filename="${filename}"` 
      : `inline; filename="${filename}"`,
  });
  res.send(html);
}

function sendPDF(res, pdfBuffer, filename, downloadMode = true) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': downloadMode
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
}

function sendError(res, status, message) {
  res.status(status).json({ success: false, error: message });
}

// ────────────────────────────────────────────────────────────────────────────
// 1.  GET /api/receipts/:appId/escrow-lock
//     Who can use it: Contractor, Worker, Supervisor (anyone with the App ID)
// ────────────────────────────────────────────────────────────────────────────
router.get('/:appId/escrow-lock', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    if (isNaN(appId)) return sendError(res, 400, 'Invalid app ID');

    const contract = await Contract.findByAppId(appId);
    if (!contract) return sendError(res, 404, 'Contract not found. Make sure you are using the correct App ID.');

    const milestones = await Milestone.findByContract(contract.id);
    const bankDetails = await WorkerBankDetail.findByWorker(contract.worker_address);

    const data = {
      appId,
      contractorAddress: contract.contractor_address,
      workerAddress:    contract.worker_address,
      supervisorAddress: contract.supervisor_address,
      algoTxid:  contract.algo_txid || null,
      totalAlgo: contract.total_escrow || 0,
      totalINR:  contract.total_escrow_inr || 0,
      algoToInrRate: contract.algo_to_inr_rate || 0,
      milestones: milestones.map(m => ({
        index:       m.milestone_index,
        description: m.description,
        amount:      m.amount,
        amountINR:   m.amount_inr || 0,
        paid:        !!m.paid,
      })),
      workerUpiId: bankDetails?.upi_id || null,
      workerName:  bankDetails?.account_holder_name || null,
      issuedAt:    contract.deployed_at || contract.created_at || new Date().toISOString(),
    };

    console.log(`📄 [Receipt] Escrow lock HTML for App #${appId}`);
    const { html } = await generateEscrowLockReceipt(data);
    const downloadMode = req.query.download === '1' || req.query.download === 'true';
    const wantsPDF = req.query.format === 'pdf';

    if (wantsPDF) {
      const pdfBuffer = await renderHTMLToPDF(html);
      sendPDF(res, pdfBuffer, `EscrowLock-App${appId}.pdf`, downloadMode);
    } else {
      sendHTML(res, html, `EscrowLock-App${appId}.html`, downloadMode);
    }

  } catch (err) {
    console.error('[Receipt] escrow-lock error:', err);
    sendError(res, 500, err.message || 'Failed to generate receipt');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 2.  GET /api/receipts/:appId/milestone/:index/payment
//     Who can use it: Worker, Contractor, Supervisor — only after milestone approved
// ────────────────────────────────────────────────────────────────────────────
router.get('/:appId/milestone/:index/payment', async (req, res) => {
  try {
    const appId          = parseInt(req.params.appId, 10);
    const milestoneIndex = parseInt(req.params.index, 10);
    if (isNaN(appId) || isNaN(milestoneIndex)) return sendError(res, 400, 'Invalid app ID or milestone index');

    const contract = await Contract.findByAppId(appId);
    if (!contract) return sendError(res, 404, 'Contract not found');

    const milestone = await Milestone.findByContractAndIndex(contract.id, milestoneIndex);
    if (!milestone) return sendError(res, 404, 'Milestone not found');

    if (!milestone.paid) {
      return sendError(res, 400,
        `Milestone ${milestoneIndex + 1} has not been approved yet. ` +
        `Payment receipts are only generated after supervisor approval.`
      );
    }

    const bankDetails = await WorkerBankDetail.findByWorker(contract.worker_address);
    const storedPayoutId = milestone.razorpay_payout_id || null;

    // Reconstruct UTR from payout ID for display
    let utrNumber = null, bankRef = null;
    if (storedPayoutId) {
      const banks = ['HDFC', 'ICIC', 'SBIN', 'AXIS', 'KOTK', 'PUNB'];
      const bank  = banks[storedPayoutId.charCodeAt(storedPayoutId.length > 5 ? 5 : 0) % banks.length];
      const d     = milestone.paid_at ? new Date(milestone.paid_at) : new Date();
      const date  = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
      const seq   = storedPayoutId.replace('pout_', '').split('').map(c => c.charCodeAt(0)).join('').slice(0,12).padStart(12,'0');
      utrNumber   = `${bank}${date}${seq}`;
      bankRef     = `REF${Date.now().toString().slice(-10)}`;
    }

    const data = {
      appId, milestoneIndex,
      milestoneDescription: milestone.description || `Milestone ${milestoneIndex + 1}`,
      contractorAddress:  contract.contractor_address,
      workerAddress:      contract.worker_address,
      supervisorAddress:  contract.supervisor_address,
      amountAlgo:    milestone.amount || 0,
      amountINR:     milestone.amount_inr || 0,
      algoToInrRate: contract.algo_to_inr_rate || 0,
      upiId:              bankDetails?.upi_id || null,
      accountHolderName:  bankDetails?.account_holder_name || null,
      utrNumber, bankRef,
      payoutId: storedPayoutId,
      approvalTxid: milestone.txid || null,
      assetId:      milestone.asset_id || null,
      paidAt:       milestone.paid_at || new Date().toISOString(),
      totalContractAlgo: contract.total_escrow,
      simulated: !!milestone.payout_simulated,
    };

    console.log(`📄 [Receipt] Payment HTML for App #${appId} / Milestone ${milestoneIndex}`);
    const { html } = await generatePaymentReceipt(data);
    const downloadMode = req.query.download === '1' || req.query.download === 'true';
    const wantsPDF = req.query.format === 'pdf';

    if (wantsPDF) {
      const pdfBuffer = await renderHTMLToPDF(html);
      sendPDF(res, pdfBuffer, `Payment-App${appId}-M${milestoneIndex + 1}.pdf`, downloadMode);
    } else {
      sendHTML(res, html, `Payment-App${appId}-M${milestoneIndex + 1}.html`, downloadMode);
    }

  } catch (err) {
    console.error('[Receipt] payment receipt error:', err);
    sendError(res, 500, err.message || 'Failed to generate receipt');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3.  GET /api/receipts/:appId/milestone/:index/certificate
//     A formal Work Certificate (separate from payment receipt) — gold-bordered
//     looking award certificate, not a financial document.
// ────────────────────────────────────────────────────────────────────────────
router.get('/:appId/milestone/:index/certificate', async (req, res) => {
  try {
    const appId          = parseInt(req.params.appId, 10);
    const milestoneIndex = parseInt(req.params.index, 10);
    if (isNaN(appId) || isNaN(milestoneIndex)) return sendError(res, 400, 'Invalid app ID or milestone index');

    const contract = await Contract.findByAppId(appId);
    if (!contract) return sendError(res, 404, 'Contract not found');

    const milestone = await Milestone.findByContractAndIndex(contract.id, milestoneIndex);
    if (!milestone) return sendError(res, 404, 'Milestone not found');

    if (!milestone.paid) {
      return sendError(res, 400,
        `Milestone ${milestoneIndex + 1} is not yet approved. ` +
        `Work Certificates are issued only after supervisor approval and successful payment.`
      );
    }

    const bankDetails = await WorkerBankDetail.findByWorker(contract.worker_address);

    const data = {
      appId, milestoneIndex,
      milestoneDescription: milestone.description || `Milestone ${milestoneIndex + 1}`,
      workerAddress:     contract.worker_address,
      workerName:        bankDetails?.account_holder_name || null,
      workerUpiId:       bankDetails?.upi_id || null,
      contractorAddress: contract.contractor_address,
      supervisorAddress: contract.supervisor_address,
      amountAlgo:    milestone.amount || 0,
      amountINR:     milestone.amount_inr || 0,
      algoToInrRate: contract.algo_to_inr_rate || 0,
      assetId:       milestone.asset_id || null,
      approvalTxid:  milestone.txid || null,
      paidAt:        milestone.paid_at || new Date().toISOString(),
    };

    console.log(`📄 [Certificate] Work certificate HTML for App #${appId} / Milestone ${milestoneIndex}`);
    const { html } = await generateWorkCertificate(data);
    const downloadMode = req.query.download === '1' || req.query.download === 'true';
    const wantsPDF = req.query.format === 'pdf';

    if (wantsPDF) {
      const pdfBuffer = await renderHTMLToPDF(html);
      sendPDF(res, pdfBuffer, `WorkCertificate-App${appId}-M${milestoneIndex + 1}.pdf`, downloadMode);
    } else {
      sendHTML(res, html, `WorkCertificate-App${appId}-M${milestoneIndex + 1}.html`, downloadMode);
    }

  } catch (err) {
    console.error('[Certificate] error:', err);
    sendError(res, 500, err.message || 'Failed to generate certificate');
  }
});

router.get('/worker/:address/contracts', async (req, res) => {
  try {
    const { address } = req.params;

    // Find all contracts where this address is the worker
    const db = require('../config/database');
    const contracts = await db.all(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id) AS milestone_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id AND m.paid = 1) AS paid_count
       FROM contracts c 
       WHERE c.worker_address = ? 
       ORDER BY c.id DESC`,
      [address]
    );

    const bankDetails = await WorkerBankDetail.findByWorker(address);

    const result = await Promise.all(contracts.map(async c => {
      const milestones = await Milestone.findByContract(c.id);
      return {
        appId:             c.app_id,
        contractId:        c.id,
        contractorAddress: c.contractor_address,
        supervisorAddress: c.supervisor_address,
        totalAlgo:         c.total_escrow,
        totalINR:          c.total_escrow_inr || 0,
        algoToInrRate:     c.algo_to_inr_rate || 0,
        status:            c.status,
        milestoneCount:    c.milestone_count || 0,
        paidCount:         c.paid_count || 0,
        deployedAt:        c.deployed_at || c.created_at,
        escrowReceiptUrl:  `/api/receipts/${c.app_id}/escrow-lock`,
        milestones: milestones.map(m => ({
          index:          m.milestone_index,
          description:    m.description,
          amountAlgo:     m.amount,
          amountINR:      m.amount_inr || 0,
          paid:           !!m.paid,
          paidAt:         m.paid_at || null,
          txid:           m.txid || null,
          assetId:        m.asset_id || null,
          paymentReceiptUrl: m.paid ? `/api/receipts/${c.app_id}/milestone/${m.milestone_index}/payment` : null,
        }))
      };
    }));

    res.json({
      success: true,
      data: {
        workerAddress: address,
        upiRegistered: !!bankDetails?.upi_id,
        upiId:         bankDetails?.upi_id || null,
        totalContracts: result.length,
        contracts: result
      }
    });

  } catch (err) {
    console.error('[Receipt] worker contracts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

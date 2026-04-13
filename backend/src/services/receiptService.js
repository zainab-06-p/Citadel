/**
 * Receipt Service
 *
 * Generates styled HTML for in-browser viewing and also supports
 * server-side PDF rendering via Puppeteer for CSP-safe downloads.
 */

const puppeteer = require('puppeteer');

function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true
    }) + ' IST';
  } catch { return iso; }
}

function fmtINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function generateId(type, appId, extra) {
  const ts = Date.now().toString(36).toUpperCase();
  return `WP-${type}-${appId}${extra !== undefined ? `-M${extra}` : ''}-${ts}`;
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED LAYOUT
// ════════════════════════════════════════════════════════════════════════════
const baseStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Inter', -apple-system, sans-serif; background: #f0f2f5; color: #1a1a2e; }
  
  .receipt-wrapper { max-width: 900px; margin: 0 auto; padding: 10px; }
  .receipt { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); position: relative; }
  .receipt > :not(.watermark) { position: relative; z-index: 2; }

  /* Colour bar at top */
  .top-bar { height: 3px; }
  .top-bar-escrow { background: linear-gradient(90deg, #2563eb, #7c3aed, #059669); }
  .top-bar-payment { background: linear-gradient(90deg, #059669, #10b981, #34d399); }

  /* Header */
  .r-header { padding: 12px 16px 10px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 6px; }
  .logo { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .logo-escrow { background: linear-gradient(135deg, #2563eb, #7c3aed); }
  .logo-payment { background: linear-gradient(135deg, #059669, #10b981); }
  .logo svg { width: 16px; height: 16px; stroke: white; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .brand-name { font-size: 13px; font-weight: 800; color: #0f172a; }
  .brand-sub { font-size: 8px; color: #94a3b8; margin-top: 0px; }
  .r-meta { text-align: right; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 12px; font-size: 8px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
  .badge-escrow { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .badge-payment { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .r-id { font-size: 8px; color: #94a3b8; margin-top: 2px; font-family: monospace; }
  .r-date { font-size: 8px; color: #64748b; margin-top: 1px; }

  /* Hero block */
  .hero { margin: 10px 16px; padding: 10px 12px; border-radius: 8px; }
  .hero-escrow { background: linear-gradient(135deg, #eff6ff, #e0f2fe); border: 1px solid #bfdbfe; }
  .hero-payment { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0; }
  .hero-label { font-size: 8px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
  .hero-amount { font-size: 22px; font-weight: 800; letter-spacing: -0.2px; }
  .hero-amount-escrow { color: #1d4ed8; }
  .hero-amount-payment { color: #059669; }
  .hero-sub { font-size: 9px; color: #64748b; margin-top: 2px; }
  .status-pill { display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; padding: 2px 6px; border-radius: 12px; font-size: 9px; font-weight: 600; }
  .pill-escrow { background: #dbeafe; color: #1e40af; }
  .pill-payment { background: #d1fae5; color: #065f46; }
  .dot { width: 4px; height: 4px; border-radius: 50%; display: inline-block; }
  .dot-escrow { background: #2563eb; }
  .dot-payment { background: #059669; }

  /* Parties row */
  .parties { display: flex; gap: 4px; margin: 0 16px; }
  .party { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; }
  .party-role { font-size: 7px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
  .party-addr { font-family: monospace; font-size: 7px; color: #475569; word-break: break-all; line-height: 1.3; }
  .party-upi { font-size: 8px; font-weight: 600; margin-top: 2px; }
  .upi-ok { color: #059669; }
  .upi-warn { color: #d97706; }

  /* Sections */
  .section { margin: 8px 16px 0; }
  .section-title { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid #f1f5f9; padding-bottom: 3px; margin-bottom: 2px; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid #f8fafc; font-size: 9px; }
  .row:last-child { border-bottom: none; }
  .row-label { font-size: 9px; color: #64748b; }
  .row-value { font-size: 9px; font-weight: 600; color: #1e293b; text-align: right; max-width: 55%; word-break: break-all; }
  .mono { font-family: monospace; font-size: 8px; }
  .green { color: #059669; }
  .blue { color: #2563eb; }
  .utr-box { background: #fefce8; border: 1px solid #fde047; color: #854d0e; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 7px; font-weight: 700; }

  /* Milestones table */
  .ms-table { width: 100%; border-collapse: collapse; margin-top: 3px; }
  .ms-table th { background: #f1f5f9; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: 600; color: #64748b; text-transform: uppercase; }
  .ms-table td { padding: 3px 6px; border-bottom: 1px solid #f8fafc; font-size: 9px; color: #374151; }
  .ms-table tr:last-child td { border-bottom: none; }
  .pill-paid { background: #d1fae5; color: #065f46; padding: 1px 4px; border-radius: 10px; font-size: 7px; font-weight: 600; display: inline-block; }
  .pill-pending { background: #fef9c3; color: #854d0e; padding: 1px 4px; border-radius: 10px; font-size: 7px; font-weight: 600; display: inline-block; }

  /* Verify box */
  .verify-box { margin: 8px 16px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
  .verify-title { font-size: 9px; font-weight: 700; color: #374151; margin-bottom: 4px; }
  .verify-row { display: flex; gap: 4px; align-items: flex-start; margin-bottom: 3px; }
  .verify-row:last-child { margin-bottom: 0; }
  .check-icon { width: 11px; height: 11px; background: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; font-size: 7px; color: white; }
  .verify-text { font-size: 8px; color: #6b7280; }
  .verify-link { font-size: 8px; color: #2563eb; font-family: monospace; word-break: break-all; }

  /* Notice boxes */
  .notice { margin: 6px 16px 0; padding: 6px 8px; border-radius: 4px; font-size: 8px; }
  .notice-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .notice-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

  /* Watermark */
  .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-30deg); font-size: 100px; font-weight: 900; color: rgba(5,150,105,0.10); pointer-events: none; z-index: 1; white-space: nowrap; letter-spacing: 0.08em; }

  /* Footer */
  .r-footer { margin-top: 8px; padding: 8px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 9px; font-weight: 700; color: #374151; }
  .footer-note { font-size: 7px; color: #94a3b8; }

  /* Download button */
  .print-bar { background: #0f172a; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 999; }
  .print-btn { background: #2563eb; color: white; border: none; padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; text-decoration: none; }
  .print-btn:hover { background: #1d4ed8; }
  .print-btn:disabled { background: #6b7280; cursor: not-allowed; }
  .print-tip { font-size: 10px; color: rgba(255,255,255,0.45); }

  @media print {
    .print-bar { display: none !important; }
    .watermark { color: rgba(5,150,105,0.12); }
    .receipt-wrapper { padding: 0; margin: 0; background: white; }
    .receipt { box-shadow: none; border-radius: 0; margin: 0; }
    html, body { background: white; margin: 0; padding: 0; page-break-after: avoid; size: A4; }
    * { orphans: 2; widows: 2; page-break-inside: avoid; }
    .section { margin-top: 6px; }
    .parties { margin: 8px 16px; }
    .notice { margin-top: 4px; }
    .r-footer { margin-top: 6px; }
  }
  
  @media screen and (max-width: 768px) {
    .receipt-wrapper { padding: 8px; }
    .parties { flex-direction: column; }
  }
`;

// ─── Shared download script (injected into every page) ───────────────────────
// Uses html2canvas + jsPDF loaded from CDN — produces a real .pdf download
// with zero dialog, zero Puppeteer, zero Chrome install needed.
const DOWNLOAD_SCRIPTS = (filename) => `
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script>
let isGeneratingPDF = false;

function waitForLibraries(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkLibs = () => {
      if (window.html2canvas && window.jspdf) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('PDF libraries took too long to load'));
      } else {
        setTimeout(checkLibs, 100);
      }
    };
    checkLibs();
  });
}

async function downloadPDF() {
  if (isGeneratingPDF) return;
  isGeneratingPDF = true;
  
  const btn = document.getElementById('dl-btn');
  const tip = document.getElementById('dl-tip');
  const urlParams = new URLSearchParams(window.location.search);
  const shouldAutoClose = urlParams.get('autoclose') === '1';
  
  if (!btn) {
    console.error('Download button not found');
    isGeneratingPDF = false;
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '⏳ Generating PDF…';
  if (tip) {
    tip.textContent = 'Loading PDF libraries...';
    tip.style.color = '#94a3b8';
  }

  try {
    // Wait for libraries to load
    await waitForLibraries(5000);
    
    if (tip) tip.textContent = 'Rendering document...';

    // Find the main content element
    const el = document.querySelector('.receipt-wrapper, .cert-page');
    if (!el) throw new Error('Content element not found on page');

    // Temporarily hide the sticky bar
    const bar = document.querySelector('.print-bar');
    if (bar) bar.style.display = 'none';

    // Render to canvas
    const canvas = await window.html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight
    });

    if (bar) bar.style.display = '';

    if (tip) tip.textContent = 'Creating PDF...';

    // Generate PDF from canvas
    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    // Fit full receipt/certificate on one page.
    const imgRatio = canvas.width / canvas.height;
    let renderW = maxW;
    let renderH = renderW / imgRatio;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = renderH * imgRatio;
    }

    const offsetX = (pageW - renderW) / 2;
    const offsetY = (pageH - renderH) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');

    pdf.save('${filename}');
    if (shouldAutoClose) {
      setTimeout(() => window.close(), 500);
    }
    btn.innerHTML = '✅ Downloaded!';
    if (tip) {
      tip.textContent = 'PDF saved to Downloads folder';
      tip.style.color = '#10b981';
    }
    
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '⬇ Download PDF';
      if (tip) {
        tip.textContent = 'Click to download a PDF copy';
        tip.style.color = 'rgba(255,255,255,0.45)';
      }
      isGeneratingPDF = false;
    }, 2000);
    
  } catch (err) {
    console.error('❌ PDF generation error:', err.message);
    btn.disabled = false;
    btn.innerHTML = '🖨 Use Print to PDF';
    if (tip) {
      tip.textContent = 'Click to open print dialog (Save as PDF)';
      tip.style.color = '#f59e0b';
    }
    isGeneratingPDF = false;
    
    // Offer fallback
    btn.onclick = (e) => {
      e.preventDefault();
      window.print();
    };
  }
}

// Auto-trigger PDF download if requested via URL param
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('dl-btn');
  if (btn) {
    btn.onclick = downloadPDF;
  }
  
  // Check if auto-pdf=1 parameter is set (for automatic PDF download)
  const params = new URLSearchParams(window.location.search);
  if (params.get('auto-pdf') === '1') {
    // Delay to ensure page renders, fonts load, and layout stabilizes
    setTimeout(() => {
      downloadPDF();
    }, 1500);
  }
});
</script>
`;

const PRINT_BAR = (title, downloadHref, color = '#2563eb') => `
<div class="print-bar">
  <div>
    <div style="color:white;font-size:13px;font-weight:600">${title}</div>
    <div id="dl-tip" class="print-tip">Download a PDF copy</div>
  </div>
  <a id="dl-btn" class="print-btn" style="background:${color};cursor:pointer;" href="${downloadHref}">
    ⬇ Download PDF
  </a>
</div>
`;

const LOGO_SVG = `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;

// ════════════════════════════════════════════════════════════════════════════
// ESCROW LOCK RECEIPT
// ════════════════════════════════════════════════════════════════════════════
function buildEscrowLockHTML({
  appId, contractorAddress, workerAddress, supervisorAddress,
  totalAlgo, totalINR, algoToInrRate, milestones,
  workerUpiId, workerName, algoTxid, issuedAt,
  network = 'Algorand TestNet'
}) {
  const rid = generateId('ESCROW', appId);
  const rows = (milestones || []).map((m, i) => {
    const inr = algoToInrRate > 0 ? fmtINR(m.amount * algoToInrRate) : '—';
    return `<tr>
      <td>${i+1}</td>
      <td>${m.description || `Milestone ${i+1}`}</td>
      <td><strong>${m.amount} ALGO</strong></td>
      <td>${inr}</td>
      <td>${m.paid ? '<span class="pill-paid">Paid</span>' : '<span class="pill-pending">Pending</span>'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Escrow Lock Receipt — WorkProof #${appId}</title>
<style>${baseStyle}</style>
</head>
<body>
${PRINT_BAR(`📋 Escrow Lock Receipt — WorkProof #${appId}`, `?format=pdf&download=1`)}
<div class="receipt-wrapper">
<div class="receipt">
  <div class="top-bar top-bar-escrow"></div>

  <div class="r-header">
    <div class="brand">
      <div class="logo logo-escrow">${LOGO_SVG}</div>
      <div>
        <div class="brand-name">WorkProof</div>
        <div class="brand-sub">Blockchain-Verified Work Platform</div>
      </div>
    </div>
    <div class="r-meta">
      <div><span class="badge badge-escrow">Escrow Lock Receipt</span></div>
      <div class="r-id">${rid}</div>
      <div class="r-date">Issued: ${fmtDate(issuedAt || new Date().toISOString())}</div>
    </div>
  </div>

  <div class="hero hero-escrow">
    <div class="hero-label">Total Amount Locked in Escrow</div>
    <div class="hero-amount hero-amount-escrow" style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <span>${totalAlgo} ALGO</span>
      <span style="font-size:13px;color:#64748b;font-weight:500">≈ ${fmtINR(totalINR)}</span>
    </div>
    <div class="hero-sub">@ ₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(4) : '—'} per ALGO &nbsp;·&nbsp; ${network}</div>
    <div class="status-pill pill-escrow">
      <span class="dot dot-escrow"></span>
      Funds Secured
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-role">📋 Contractor (Fund Source)</div>
      <div class="party-addr">${contractorAddress}</div>
    </div>
    <div class="party">
      <div class="party-role">👷 Worker (Beneficiary)</div>
      <div class="party-addr">${workerAddress}</div>
      ${workerUpiId
        ? `<div class="party-upi upi-ok">💳 ${workerUpiId}${workerName ? ` · ${workerName}` : ''}</div>`
        : `<div class="party-upi upi-warn">⚠ UPI not registered yet</div>`}
    </div>
    <div class="party">
      <div class="party-role">🛡 Supervisor</div>
      <div class="party-addr">${supervisorAddress}</div>
    </div>
  </div>

  <div class="section" style="margin-top:20px">
    <div class="section-title">Contract Details</div>
    <div class="row"><span class="row-label">Contract / App ID</span><span class="row-value blue">${appId}</span></div>
    <div class="row"><span class="row-label">Total ALGO Locked</span><span class="row-value blue">${totalAlgo} ALGO</span></div>
    <div class="row"><span class="row-label">INR Equivalent at Lock</span><span class="row-value green">${fmtINR(totalINR)}</span></div>
    <div class="row"><span class="row-label">Exchange Rate at Lock</span><span class="row-value">₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(4) : '—'} / ALGO</span></div>
    ${algoTxid ? `<div class="row"><span class="row-label">Escrow Transaction</span><span class="row-value mono">${shortAddr(algoTxid)}</span></div>` : ''}
    <div class="row"><span class="row-label">INR Payout Method</span><span class="row-value">Razorpay UPI (triggered on supervisor approval)</span></div>
    <div class="row"><span class="row-label">Network</span><span class="row-value">${network}</span></div>
  </div>

  <div class="section" style="margin-top:16px">
    <div class="section-title">Milestone Breakdown (${(milestones||[]).length} milestones)</div>
    <table class="ms-table">
      <thead><tr><th>#</th><th>Description</th><th>ALGO</th><th>INR Value</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="verify-box">
    <div class="verify-title">🔗 Blockchain Verification</div>
    <div class="verify-row">
      <span class="check-icon">✓</span>
      <div>
        <div class="verify-text">Smart Contract on ${network}</div>
        <div class="verify-link">https://testnet.explorer.perawallet.app/application/${appId}</div>
      </div>
    </div>
    ${algoTxid ? `<div class="verify-row">
      <span class="check-icon">✓</span>
      <div>
        <div class="verify-text">Escrow Lock Transaction</div>
        <div class="verify-link">https://testnet.explorer.perawallet.app/tx/${algoTxid}</div>
      </div>
    </div>` : ''}
  </div>

  <div class="notice notice-warn" style="margin-top:14px">
    <strong>Note:</strong> INR equivalent (${fmtINR(totalINR)}) is calculated at the ALGO/INR rate at contract creation time.
    The worker will receive INR automatically via Razorpay UPI when the supervisor approves each milestone.
    ${!workerUpiId ? '<br><strong>⚠ Action needed:</strong> The worker must register their UPI ID in the Worker Dashboard before payout can be released.' : ''}
  </div>

  <div class="r-footer">
    <div>
      <div class="footer-brand">WorkProof Platform</div>
      <div class="footer-note">Blockchain-secured · Razorpay-powered · Generated ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
    <div class="footer-note">Receipt ID: ${rid}</div>
  </div>
</div>
</div>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// PAYMENT RECEIPT
// ════════════════════════════════════════════════════════════════════════════
function buildPaymentReceiptHTML({
  appId, milestoneIndex, milestoneDescription,
  contractorAddress, workerAddress, supervisorAddress,
  amountAlgo, amountINR, algoToInrRate,
  upiId, accountHolderName,
  utrNumber, bankRef, payoutId,
  approvalTxid, assetId, paidAt,
  totalContractAlgo, simulated = true,
  network = 'Algorand TestNet'
}) {
  const rid = generateId('PAY', appId, milestoneIndex);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Receipt — WorkProof App#${appId} M${milestoneIndex + 1}</title>
<style>${baseStyle}</style>
</head>
<body>
${PRINT_BAR(`💸 Payment Receipt — ${milestoneDescription || `Milestone ${milestoneIndex + 1}`}`, `?format=pdf&download=1`, '#059669')}
<div class="receipt-wrapper">
<div class="receipt">
  <div class="watermark">PAID</div>
  <div class="top-bar top-bar-payment"></div>

  <div class="r-header">
    <div class="brand">
      <div class="logo logo-payment">${LOGO_SVG}</div>
      <div>
        <div class="brand-name">WorkProof</div>
        <div class="brand-sub">Blockchain-Verified Work Platform</div>
      </div>
    </div>
    <div class="r-meta">
      <div><span class="badge badge-payment">Payment Receipt</span></div>
      <div class="r-id">${rid}</div>
      <div class="r-date">Issued: ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="hero hero-payment">
    <div class="hero-label">Amount Paid to Worker</div>
    <div class="hero-amount hero-amount-payment">${fmtINR(amountINR)}</div>
    <div class="hero-sub">${amountAlgo} ALGO @ ₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(4) : '—'}/ALGO · Razorpay UPI</div>
    <div class="status-pill pill-payment">
      <span class="dot dot-payment"></span>
      Paid Successfully
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-role">💳 Paid To (Worker)</div>
      <div class="party-addr">${workerAddress}</div>
      ${upiId ? `<div class="party-upi upi-ok">📱 ${upiId}${accountHolderName ? ` · ${accountHolderName}` : ''}</div>` : ''}
    </div>
    <div class="party">
      <div class="party-role">📋 Contract By</div>
      <div class="party-addr">${contractorAddress}</div>
    </div>
    <div class="party">
      <div class="party-role">✅ Approved By</div>
      <div class="party-addr">${supervisorAddress}</div>
    </div>
  </div>

  <div class="section" style="margin-top:20px">
    <div class="section-title">Razorpay UPI Payment Details</div>
    ${upiId ? `<div class="row"><span class="row-label">Paid To UPI</span><span class="row-value green">${upiId}</span></div>` : ''}
    ${accountHolderName ? `<div class="row"><span class="row-label">Account Holder</span><span class="row-value">${accountHolderName}</span></div>` : ''}
    <div class="row"><span class="row-label">Amount Paid</span><span class="row-value green" style="font-size:15px;font-weight:800">${fmtINR(amountINR)}</span></div>
    <div class="row"><span class="row-label">Payment Method</span><span class="row-value">UPI — Instant Transfer via Razorpay</span></div>
    <div class="row"><span class="row-label">UTR Number (NPCI)</span><span class="row-value">${utrNumber ? `<span class="utr-box">${utrNumber}</span>` : '—'}</span></div>
    ${bankRef ? `<div class="row"><span class="row-label">Bank Reference</span><span class="row-value mono">${bankRef}</span></div>` : ''}
    ${payoutId ? `<div class="row"><span class="row-label">Razorpay Payout ID</span><span class="row-value mono">${payoutId}</span></div>` : ''}
    <div class="row"><span class="row-label">Processed At</span><span class="row-value">${fmtDate(paidAt)}</span></div>
  </div>

  <div class="section" style="margin-top:14px">
    <div class="section-title">ALGO → INR Conversion</div>
    <div class="row"><span class="row-label">ALGO Released from Escrow</span><span class="row-value blue">${amountAlgo} ALGO</span></div>
    <div class="row"><span class="row-label">Exchange Rate at Approval</span><span class="row-value">₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(4) : '—'} / ALGO</span></div>
    <div class="row"><span class="row-label">INR Converted (${amountAlgo} × ₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(2) : '—'})</span><span class="row-value green">${fmtINR(amountINR)}</span></div>
  </div>

  <div class="section" style="margin-top:14px">
    <div class="section-title">Milestone &amp; Contract Info</div>
    <div class="row"><span class="row-label">Milestone</span><span class="row-value">#${milestoneIndex + 1} — ${milestoneDescription || '—'}</span></div>
    <div class="row"><span class="row-label">Contract / App ID</span><span class="row-value blue">${appId}</span></div>
    ${approvalTxid ? `<div class="row"><span class="row-label">Approval Transaction</span><span class="row-value mono">${shortAddr(approvalTxid)}</span></div>` : ''}
    ${assetId ? `<div class="row"><span class="row-label">NFT Work Credential</span><span class="row-value">Asset #${assetId}</span></div>` : ''}
    <div class="row"><span class="row-label">Network</span><span class="row-value">${network}</span></div>
  </div>

  ${(approvalTxid || assetId) ? `<div class="verify-box">
    <div class="verify-title">🔗 Blockchain Verification</div>
    ${approvalTxid ? `<div class="verify-row">
      <span class="check-icon">✓</span>
      <div>
        <div class="verify-text">Milestone Approval Transaction on ${network}</div>
        <div class="verify-link">https://testnet.explorer.perawallet.app/tx/${approvalTxid}</div>
      </div>
    </div>` : ''}
    ${assetId ? `<div class="verify-row">
      <span class="check-icon">✓</span>
      <div>
        <div class="verify-text">NFT Work Credential (ASA)</div>
        <div class="verify-link">https://testnet.explorer.perawallet.app/asset/${assetId}</div>
      </div>
    </div>` : ''}
  </div>` : ''}

  ${simulated ? `<div class="notice notice-info" style="margin-top:14px">
    <strong>Test Mode:</strong> This receipt was generated in test mode. In production, ${fmtINR(amountINR)} would be instantly
    delivered to ${upiId || 'the registered UPI ID'} via Razorpay Payouts with a real NPCI UTR number.
  </div>` : ''}

  <div class="r-footer">
    <div>
      <div class="footer-brand">WorkProof Platform</div>
      <div class="footer-note">Secured by Algorand · Powered by Razorpay · ${new Date().toLocaleDateString('en-IN')}</div>
    </div>
    <div class="footer-note">UTR: ${utrNumber || 'N/A'} · ${rid}</div>
  </div>
</div>
</div>
</body>
</html>`;
}

// Update print bar in escrow receipt — make save-as-PDF instructions explicit
const PRINT_BAR_RECEIPT = (title) => `
<div class="print-bar">
  <span class="print-tip">📋 ${title}</span>
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:10px;color:rgba(255,255,255,0.35)">👇 Click → select <strong style="color:rgba(255,255,255,0.6)">"Save as PDF"</strong> in the dialog</span>
    <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
</div>`;

// ════════════════════════════════════════════════════════════════════════════
// WORK CERTIFICATE  (separate from payment receipt — looks like a formal award)
// ════════════════════════════════════════════════════════════════════════════
function buildWorkCertificateHTML({
  appId, milestoneIndex, milestoneDescription,
  workerAddress, workerName, workerUpiId,
  contractorAddress, supervisorAddress,
  amountAlgo, amountINR, algoToInrRate,
  assetId, approvalTxid, paidAt,
  network = 'Algorand TestNet'
}) {
  const certId = generateId('CERT', appId, milestoneIndex);
  const issuedDate = paidAt ? new Date(paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Work Certificate — ${milestoneDescription || `Milestone ${milestoneIndex + 1}`}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: 'Inter', sans-serif; background: #1a1a2e; color: #0f172a; }

/* Print bar — hidden when printing */
.print-bar { background: #0f172a; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 999; }
.print-btn { background: #7c3aed; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 8px; }
.print-btn:hover { background: #6d28d9; }
.print-btn:disabled { background: #6b7280; cursor: not-allowed; }
.print-tip { font-size: 11px; color: rgba(255,255,255,0.4); }

/* Certificate page */
.cert-page {
  width: 100%; max-width: 900px; margin: 24px auto;
  background: #fffdf6;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
  position: relative;
}

/* Gold border frame */
.cert-frame {
  margin: 18px; 
  border: 3px solid #b8860b;
  border-radius: 2px;
  position: relative;
  padding: 40px 48px;
}
.cert-frame::before {
  content: '';
  position: absolute; inset: 5px;
  border: 1px solid rgba(184,134,11,0.4);
  border-radius: 1px;
  pointer-events: none;
}

/* Corner ornaments */
.corner { position: absolute; width: 32px; height: 32px; }
.corner svg { width: 100%; height: 100%; }
.corner-tl { top: -2px; left: -2px; }
.corner-tr { top: -2px; right: -2px; transform: scaleX(-1); }
.corner-bl { bottom: -2px; left: -2px; transform: scaleY(-1); }
.corner-br { bottom: -2px; right: -2px; transform: scale(-1,-1); }

/* Background watermark */
.bg-seal {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 180px; opacity: 0.03; font-weight: 900;
  color: #7c3aed; pointer-events: none; white-space: nowrap;
  font-family: 'Playfair Display', serif;
}

/* Header */
.cert-logo { text-align: center; margin-bottom: 8px; }
.cert-logo-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 14px;
  background: linear-gradient(135deg, #7c3aed, #4f46e5);
  margin-bottom: 12px;
}
.cert-logo-icon svg { width: 30px; height: 30px; stroke: white; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cert-org { font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #b8860b; }
.cert-divider { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
.cert-divider-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, #b8860b, transparent); }
.cert-divider-diamond { color: #b8860b; font-size: 12px; }

/* Main title */
.cert-title { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; color: #1e1b4b; text-align: center; line-height: 1.2; margin: 8px 0; }
.cert-subtitle { font-size: 11px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; color: #6d28d9; text-align: center; margin-bottom: 20px; }

/* Awarded to */
.cert-awarded { text-align: center; margin: 20px 0; }
.cert-awarded-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 6px; }
.cert-worker-name { font-family: 'Playfair Display', serif; font-style: italic; font-size: 28px; color: #1e1b4b; font-weight: 400; margin-bottom: 4px; }
.cert-worker-addr { font-family: monospace; font-size: 10px; color: #94a3b8; word-break: break-all; }

/* Achievement */
.cert-achievement { text-align: center; margin: 16px 0; }
.cert-achievement-text { font-size: 13px; color: #374151; line-height: 1.6; max-width: 560px; margin: 0 auto; }
.cert-milestone { font-size: 17px; font-weight: 700; color: #1e1b4b; margin: 8px 0 4px; }

/* Value badge */
.cert-value-badge {
  display: inline-flex; align-items: center; gap: 20px;
  background: linear-gradient(135deg, #f0fdf4, #dcfce7);
  border: 2px solid #10b981; border-radius: 12px;
  padding: 14px 28px; margin: 16px 0;
}
.cert-value-item { text-align: center; }
.cert-value-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #059669; margin-bottom: 2px; }
.cert-value-num { font-size: 22px; font-weight: 800; color: #065f46; }
.cert-value-divider { width: 1px; height: 36px; background: rgba(16,185,129,0.3); }

/* NFT credential */
.cert-nft { text-align: center; margin: 12px 0; }
.cert-nft-badge { display: inline-flex; align-items: center; gap: 8px; background: #ede9fe; border: 1px solid #7c3aed; border-radius: 20px; padding: 6px 16px; font-size: 11px; font-weight: 600; color: #5b21b6; }

/* Signatures */
.cert-sigs { display: flex; justify-content: space-around; margin-top: 28px; }
.cert-sig { text-align: center; }
.cert-sig-line { width: 140px; height: 1px; background: #b8860b; margin: 0 auto 6px; }
.cert-sig-name { font-size: 11px; font-weight: 700; color: #374151; }
.cert-sig-role { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

/* Certificate ID bar */
.cert-id-bar { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8; margin-top: 6px; }
.cert-id-bar strong { color: #374151; }

/* Blockchain seal */
.cert-seal { position: absolute; bottom: 24px; right: 24px; text-align: right; }
.cert-seal-badge { background: #1e1b4b; color: white; border-radius: 8px; padding: 6px 10px; font-size: 9px; font-weight: 600; display: inline-block; }

@media print {
  .print-bar { display: none !important; }
  html, body { background: white; margin: 0; padding: 0; }
  .cert-page { margin: 0; box-shadow: none; border-radius: 0; max-width: 100%; }
  * { orphans: 3; widows: 3; page-break-inside: avoid; }
}
</style>
</head>
<body>
${PRINT_BAR(`🎖️ Work Certificate — ${milestoneDescription || `Milestone ${milestoneIndex + 1}`}`, `?format=pdf&download=1`, '#7c3aed')}

<div class="cert-page">
  <div class="cert-frame">
    <!-- Corner ornaments -->
    <div class="corner corner-tl"><svg viewBox="0 0 32 32"><path d="M2 2 L2 16 M2 2 L16 2 M6 6 L6 12 M6 6 L12 6" stroke="#b8860b" stroke-width="2" fill="none"/></svg></div>
    <div class="corner corner-tr"><svg viewBox="0 0 32 32"><path d="M2 2 L2 16 M2 2 L16 2 M6 6 L6 12 M6 6 L12 6" stroke="#b8860b" stroke-width="2" fill="none"/></svg></div>
    <div class="corner corner-bl"><svg viewBox="0 0 32 32"><path d="M2 2 L2 16 M2 2 L16 2 M6 6 L6 12 M6 6 L12 6" stroke="#b8860b" stroke-width="2" fill="none"/></svg></div>
    <div class="corner corner-br"><svg viewBox="0 0 32 32"><path d="M2 2 L2 16 M2 2 L16 2 M6 6 L6 12 M6 6 L12 6" stroke="#b8860b" stroke-width="2" fill="none"/></svg></div>

    <div class="bg-seal">✦</div>

    <!-- Logo & Org name -->
    <div class="cert-logo">
      <div class="cert-logo-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div class="cert-org">WorkProof · Blockchain-Verified Work Platform</div>
    </div>

    <div class="cert-divider"><div class="cert-divider-line"></div><div class="cert-divider-diamond">◆</div><div class="cert-divider-line"></div></div>

    <div class="cert-title">Certificate of<br>Work Completion</div>
    <div class="cert-subtitle">On-Chain Verified Credential</div>

    <!-- Awarded to -->
    <div class="cert-awarded">
      <div class="cert-awarded-label">This certifies that</div>
      <div class="cert-worker-name">${workerName || 'Verified Worker'}</div>
      <div class="cert-worker-addr">${workerAddress}</div>
    </div>

    <!-- Achievement text -->
    <div class="cert-achievement">
      <div class="cert-achievement-text">has successfully completed the following work milestone under a blockchain-secured WorkProof contract, verified on the Algorand ${network}:</div>
      <div class="cert-milestone">"${milestoneDescription || `Milestone ${milestoneIndex + 1}`}"</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px">Milestone ${milestoneIndex + 1} · Contract #${appId} · Issued on ${issuedDate}</div>
    </div>

    <!-- Value earned -->
    <div style="text-align:center;margin:16px 0">
      <div class="cert-value-badge">
        <div class="cert-value-item">
          <div class="cert-value-label">ALGO Earned</div>
          <div class="cert-value-num">${amountAlgo}</div>
        </div>
        <div class="cert-value-divider"></div>
        <div class="cert-value-item">
          <div class="cert-value-label">INR Paid Out</div>
          <div class="cert-value-num">${fmtINR(amountINR)}</div>
        </div>
        <div class="cert-value-divider"></div>
        <div class="cert-value-item">
          <div class="cert-value-label">Rate</div>
          <div class="cert-value-num" style="font-size:14px">₹${algoToInrRate > 0 ? Number(algoToInrRate).toFixed(2) : '—'}</div>
        </div>
      </div>
    </div>

    <!-- NFT badge if exists -->
    ${assetId ? `<div class="cert-nft">
      <div class="cert-nft-badge">
        🔗 NFT Credential · Algorand ASA #${assetId} · Permanently On-Chain
      </div>
    </div>` : ''}

    <div class="cert-divider"><div class="cert-divider-line"></div><div class="cert-divider-diamond">◆</div><div class="cert-divider-line"></div></div>

    <!-- Signatures -->
    <div class="cert-sigs">
      <div class="cert-sig">
        <div class="cert-sig-line"></div>
        <div class="cert-sig-name">${shortAddr(contractorAddress) || 'Contractor'}</div>
        <div class="cert-sig-role">Contractor · Fund Source</div>
      </div>
      <div class="cert-sig">
        <div style="font-size:32px;text-align:center;margin-bottom:6px">🎖️</div>
        <div class="cert-sig-name">WorkProof Platform</div>
        <div class="cert-sig-role">Blockchain Authority</div>
      </div>
      <div class="cert-sig">
        <div class="cert-sig-line"></div>
        <div class="cert-sig-name">${shortAddr(supervisorAddress) || 'Supervisor'}</div>
        <div class="cert-sig-role">Supervisor · Approving Authority</div>
      </div>
    </div>
  </div>

  <!-- Certificate ID footer -->
  <div class="cert-id-bar">
    <div>Certificate ID: <strong>${certId}</strong></div>
    <div>Verify on-chain: ${assetId ? `testnet.explorer.perawallet.app/asset/${assetId}` : `testnet.explorer.perawallet.app/application/${appId}`}</div>
    <div>Issued: ${issuedDate} · WorkProof.io</div>
  </div>
</div>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

async function generateEscrowLockReceipt(data) {
  const html = buildEscrowLockHTML(data);
  return { html, receiptId: generateId('ESCROW', data.appId) };
}

async function generatePaymentReceipt(data) {
  const html = buildPaymentReceiptHTML(data);
  return { html, receiptId: generateId('PAY', data.appId, data.milestoneIndex) };
}

async function generateWorkCertificate(data) {
  const html = buildWorkCertificateHTML(data);
  return { html, certId: generateId('CERT', data.appId, data.milestoneIndex) };
}

async function renderHTMLToPDF(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '6mm', right: '6mm', bottom: '6mm', left: '6mm' },
      preferCSSPageSize: true
    });
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  generateEscrowLockReceipt,
  generatePaymentReceipt,
  generateWorkCertificate,
  renderHTMLToPDF,
  generateId
};


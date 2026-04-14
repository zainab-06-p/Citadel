const path = require('path');
const moment = require('moment');
const QRCode = require('qrcode');

// Note: Puppeteer is a heavy dependency. In production, 
// consider using a lighter PDF library or a PDF generation service
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.warn('Puppeteer not installed. PDF generation will not work.');
}

const CERTIFICATES_DIR = path.join(__dirname, '../../certificates');

/**
 * Generate a PDF certificate
 * @param {Object} params
 * @param {Object} params.contract
 * @param {Object} params.milestone
 * @param {string} params.txid
 * @param {number} params.assetId
 * @param {string} params.paidAt
 * @returns {Promise<Object>}
 */
async function generateCertificate({ contract, milestone, txid, assetId, paidAt }) {
  if (!puppeteer) {
    throw new Error('Puppeteer not installed. Run: npm install puppeteer');
  }
  
  // Generate certificate ID
  const certificateId = generateCertificateId(contract.app_id, milestone.milestone_index);
  
  // Format data
  const shortWorker = shortenAddress(contract.worker_address);
  const shortContractor = shortenAddress(contract.contractor_address);
  const shortSupervisor = shortenAddress(contract.supervisor_address);
  const shortTxid = shortenTxid(txid);
  
  const algoAmount = (milestone.amount / 1000000).toFixed(6);
  const inrAmount = formatINR(contract.amount_inr || 0);
  const formattedDate = moment(paidAt).format('MMMM DD, YYYY [at] h:mm A');
  
  // Generate QR code
  const qrCode = generateQRCode(txid);
  
  // Create HTML
  const html = createCertificateHTML({
    certificateId,
    workerAddress: contract.worker_address,
    shortWorker,
    contractorAddress: contract.contractor_address,
    shortContractor,
    supervisorAddress: contract.supervisor_address,
    shortSupervisor,
    milestoneDescription: milestone.description,
    appId: contract.app_id,
    algoAmount,
    inrAmount,
    paidAt: formattedDate,
    razorpayPaymentId: contract.razorpay_payment_id || 'N/A',
    txid,
    shortTxid,
    assetId,
    network: 'Algorand TestNet'
  });
  
  // Generate PDF
  const pdfPath = path.join(CERTIFICATES_DIR, `${certificateId}.pdf`);
  await htmlToPDF(html, pdfPath);
  
  console.log(`Certificate generated: ${pdfPath}`);
  
  return {
    path: pdfPath,
    filename: `${certificateId}.pdf`,
    certificateId,
    generatedAt: new Date().toISOString()
  };
}

function generateCertificateId(appId, milestoneIndex) {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `WP-${moment().format('YYYY')}-${appId}-${milestoneIndex}-${timestamp}`;
}

function shortenAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortenTxid(txid) {
  if (!txid || txid.length < 10) return txid;
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount / 100);
}

async function generateQRCode(txid) {
  const explorerUrl = `https://testnet.algoexplorer.io/tx/${txid}`;
  try {
    return await QRCode.toDataURL(explorerUrl, {
      width: 128,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR generation error:', err);
    return '';
  }
}

function createCertificateHTML(data) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; color: #333; }
    .header { text-align: center; border: 3px double #2c3e50; padding: 20px; margin-bottom: 30px; background: #f5f7fa; }
    .header h1 { font-size: 28pt; margin: 0; color: #2c3e50; text-transform: uppercase; }
    .meta-box { background: #f8f9fa; border-left: 4px solid #2c3e50; padding: 15px; margin: 20px 0; }
    .field-label { font-weight: bold; color: #2c3e50; }
    .field-value { font-family: monospace; background: #fff; padding: 8px; border: 1px solid #ddd; }
    .highlight-box { background: #e8f4f8; border: 2px solid #3498db; padding: 20px; margin: 20px 0; text-align: center; }
    .section-title { font-size: 14pt; font-weight: bold; color: #2c3e50; border-bottom: 2px solid #2c3e50; margin-top: 30px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .details-table td { padding: 10px; border-bottom: 1px solid #eee; }
    .details-table td:first-child { font-weight: bold; color: #555; width: 40%; }
    .verification-section { display: flex; align-items: center; margin: 30px 0; padding: 20px; background: #f0f0f0; border-radius: 8px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #2c3e50; text-align: center; font-size: 10pt; color: #666; }
    .network-badge { display: inline-block; background: #27ae60; color: white; padding: 5px 15px; border-radius: 20px; font-size: 9pt; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WorkProof Certificate</h1>
    <p>Verified Proof of Work Completion</p>
  </div>
  
  <div class="meta-box">
    <span class="field-label">Certificate ID:</span> <span class="field-value">${data.certificateId}</span><br><br>
    <span class="field-label">Issue Date:</span> <span class="field-value">${moment().format('MMMM DD, YYYY')}</span>
  </div>
  
  <p style="text-align: center; font-size: 14pt; margin: 30px 0;">This certifies that</p>
  
  <div class="highlight-box">
    <div style="font-size: 9pt; color: #666;">Worker</div>
    <div style="font-size: 16pt; font-weight: bold; color: #2c3e50;">${data.shortWorker}</div>
    <div style="font-size: 9pt; color: #666; margin-top: 10px;">${data.workerAddress}</div>
  </div>
  
  <p style="text-align: center; font-size: 14pt; margin: 30px 0;">has successfully completed the milestone:</p>
  
  <div class="highlight-box">
    <div style="font-size: 9pt; color: #666;">Milestone</div>
    <div style="font-size: 16pt; font-weight: bold; color: #2c3e50;">${data.milestoneDescription}</div>
    <div style="font-size: 9pt; color: #666; margin-top: 10px;">Project Contract: ${data.appId}</div>
  </div>
  
  <div class="section-title">Payment Details</div>
  <table class="details-table">
    <tr><td>Amount (ALGO)</td><td>${data.algoAmount} ALGO</td></tr>
    <tr><td>Amount (INR)</td><td>${data.inrAmount}</td></tr>
    <tr><td>Payment Date</td><td>${data.paidAt}</td></tr>
  </table>
  
  <div class="section-title">Verification Details</div>
  <table class="details-table">
    <tr><td>Razorpay Payment ID</td><td>${data.razorpayPaymentId}</td></tr>
    <tr><td>Algorand Transaction</td><td>${data.shortTxid}</td></tr>
    <tr><td>NFT Credential</td><td>Asset #${data.assetId}</td></tr>
    <tr><td>Network</td><td><span class="network-badge">${data.network}</span></td></tr>
  </table>
  
  <div class="verification-section">
    <div style="margin-right: 20px;">${data.qrCode}</div>
    <div>
      <strong>Verify this certificate</strong><br>
      Scan the QR code or visit:<br>
      <code>https://testnet.algoexplorer.io/tx/${data.txid}</code>
    </div>
  </div>
  
  <div class="section-title">Issued By</div>
  <table class="details-table">
    <tr><td>Contractor</td><td>${data.shortContractor} (${data.contractorAddress})</td></tr>
    <tr><td>Approved By</td><td>${data.shortSupervisor} (${data.supervisorAddress})</td></tr>
  </table>
  
  <div class="footer">
    <p><strong>WorkProof Platform</strong><br>This certificate is cryptographically verifiable on the Algorand blockchain.</p>
    <p style="font-size: 8pt; color: #999;">Tampering with this document invalidates its authenticity.</p>
  </div>
</body>
</html>
  `;
}

async function htmlToPDF(html, outputPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
  } finally {
    await browser.close();
  }
}

module.exports = {
  generateCertificate,
  shortenAddress,
  shortenTxid
};

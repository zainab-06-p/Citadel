const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const razorpayRoutes = require('./routes/razorpay');
const algoPaymentRoutes = require('./routes/algoPayment');
const contractRoutes = require('./routes/contracts');
const workerRoutes = require('./routes/workers');
const consentRoutes = require('./routes/consent');
const bankRoutes = require('./routes/bank');
const receiptsRoutes = require('./routes/receipts');
// Round 3 — Citadel Extension Routes
const creditOracleRoutes = require('./routes/creditOracle');
const microLendRoutes    = require('./routes/microLend');
const invoiceGuardRoutes = require('./routes/invoiceGuard');

// Import middleware
const { webhookAuth } = require('./middleware/webhookAuth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────
// Allowlist: deployed Vercel frontend + localhost dev variants.
// Any origin in this list (or matching FRONTEND_URL env) is permitted.
const ALLOWED_ORIGINS = [
  'https://frontend-six-livid-85.vercel.app',   // production frontend
  'https://frontend-8ueyjacri-zainabs-projects-7c3d81a5.vercel.app', // preview
  'http://localhost:5173',                        // vite dev
  'http://localhost:3000',                        // alternative dev
  'http://localhost:4173',                        // vite preview
  process.env.FRONTEND_URL,                       // from env (override)
].filter(Boolean);

console.log('📡 CORS enabled for:', ALLOWED_ORIGINS);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, mobile apps, server-to-server)
    if (!origin) return callback(null, true);
    // Allow if in allowlist
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // Block unknown origins in production
    return callback(new Error(`CORS: origin ${origin} not allowed`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,  // no cookies/sessions needed
  optionsSuccessStatus: 200, // IE11 compatibility
}));

// Handle preflight OPTIONS for all routes
app.options('*', cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});
app.use(limiter);

// Stricter rate limit for payment endpoints
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many payment requests'
  }
});

// Health check endpoint (before body parsers)
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/database');
    await db.get('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        algorand: 'configured',
        razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not_configured'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook route needs raw body for HMAC verification
app.use('/api/razorpay/webhook', 
  express.raw({ type: 'application/json' }),
  webhookAuth,
  razorpayRoutes
);

// Regular JSON body parser for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply payment limiter to order creation
app.use('/api/razorpay/create-order', paymentLimiter);
app.use('/api/algo-payment/verify-and-deploy', paymentLimiter);

// API Routes
app.use('/api/razorpay', razorpayRoutes);
app.use('/api/algo-payment', algoPaymentRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/receipts', receiptsRoutes);
// Round 3 — Citadel Extension Routes
app.use('/api/credit-oracle', creditOracleRoutes);
app.use('/api/micro-lend',    microLendRoutes);
app.use('/api/invoice-guard', invoiceGuardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`╔════════════════════════════════════════════════════════╗`);
    console.log(`║           WorkProof Backend Server                      ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║  Port: ${PORT.toString().padEnd(46)} ║`);
    console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}${''.padEnd(36)} ║`);
    console.log(`║  Health Check: http://localhost:${PORT}/health${''.padEnd(19)} ║`);
    console.log(`╚════════════════════════════════════════════════════════╝`);
    console.log();
    console.log('Waiting for requests...');
  });
}

module.exports = app;

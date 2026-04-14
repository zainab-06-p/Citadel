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

// Import middleware
const { webhookAuth } = require('./middleware/webhookAuth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security middleware
app.use(helmet());

// Log CORS configuration for debugging
console.log('📡 CORS enabled for:', configuredOrigins.length ? configuredOrigins.join(', ') : '*');

app.use(cors({
  origin: configuredOrigins.length ? configuredOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Backward-compatible certificate endpoint used by frontend worker dashboard.
app.get('/api/certificates/:appId/:milestoneIndex', (req, res) => {
  const { appId, milestoneIndex } = req.params;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query || {})) {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }

  if (!query.has('format')) {
    query.set('format', 'pdf');
  }

  const queryString = query.toString();
  const target = `/api/receipts/${appId}/milestone/${milestoneIndex}/certificate${queryString ? `?${queryString}` : ''}`;
  return res.redirect(307, target);
});

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
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

    console.log(`╔════════════════════════════════════════════════════════╗`);
    console.log(`║           WorkProof Backend Server                      ║`);
    console.log(`╠════════════════════════════════════════════════════════╣`);
    console.log(`║  Port: ${PORT.toString().padEnd(46)} ║`);
    console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}${''.padEnd(36)} ║`);
    console.log(`║  Health Check: ${`${publicBaseUrl}/health`.padEnd(38)} ║`);
    console.log(`╚════════════════════════════════════════════════════════╝`);
    console.log();
    console.log('Waiting for requests...');
  });
}

module.exports = app;

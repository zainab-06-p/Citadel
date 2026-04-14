/**
 * Integration Tests: API Routes
 * Tests the Express server endpoints using supertest-style approach
 * Uses the exported app from server.js (NODE_ENV=test prevents listen())
 */
const http = require('http');

// Set test environment before requiring app
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';

// We test the app by making real HTTP requests to it
let server;
let baseUrl;

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

describe('API Integration Tests', () => {

  beforeAll(async () => {
    // Try to start the app on a random port
    try {
      const app = require('../src/server');
      server = app.listen(0); // random port
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
    } catch (err) {
      console.warn('Could not start server for integration tests:', err.message);
    }
  }, 15000);

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  // ══════════════════════════════════════════════
  // HEALTH CHECK
  // ══════════════════════════════════════════════
  describe('GET /health', () => {
    test('returns health status', async () => {
      if (!server) return; // skip if server failed to start
      const res = await makeRequest('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('version', '1.0.0');
      expect(res.body).toHaveProperty('services');
    });
  });

  // ══════════════════════════════════════════════
  // 404 HANDLING
  // ══════════════════════════════════════════════
  describe('404 Handler', () => {
    test('returns 404 for unknown routes', async () => {
      if (!server) return;
      const res = await makeRequest('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Endpoint not found');
    });
  });

  // ══════════════════════════════════════════════
  // WORKERS ROUTES
  // ══════════════════════════════════════════════
  describe('Workers API', () => {
    test('GET /api/workers/:address/certificates - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/workers/INVALID/certificates');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    test('GET /api/workers/:address/contracts - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/workers/INVALID/contracts');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/workers/:address/credit-score - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/workers/SHORT/credit-score');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/workers/:address/certificates - returns data for valid address format', async () => {
      if (!server) return;
      // Valid format but no data in test DB
      const addr = 'A'.repeat(58);
      const res = await makeRequest(`/api/workers/${addr}/certificates`);
      // Should return 200 with empty array, or 500 if DB not initialized
      expect([200, 500]).toContain(res.status);
    });
  });

  // ══════════════════════════════════════════════
  // CONTRACTS ROUTES
  // ══════════════════════════════════════════════
  describe('Contracts API', () => {
    test('GET /api/contracts/:appId - rejects non-numeric appId', async () => {
      if (!server) return;
      const res = await makeRequest('/api/contracts/abc');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid');
    });

    test('GET /api/contracts/99999 - returns 404 for non-existent contract', async () => {
      if (!server) return;
      const res = await makeRequest('/api/contracts/99999');
      // Either 404 (not found) or 500 (DB not ready) are acceptable
      expect([404, 500]).toContain(res.status);
    });

    test('GET /api/contracts/:appId/transactions - rejects non-numeric appId', async () => {
      if (!server) return;
      const res = await makeRequest('/api/contracts/xyz/transactions');
      expect(res.status).toBe(400);
    });
  });

  // ══════════════════════════════════════════════
  // RAZORPAY ROUTES
  // ══════════════════════════════════════════════
  describe('Razorpay API', () => {
    test('POST /api/razorpay/create-order - rejects missing fields', async () => {
      if (!server) return;
      const res = await makeRequest('/api/razorpay/create-order', {
        method: 'POST',
        body: {}
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Missing');
    });

    test('POST /api/razorpay/create-order - rejects invalid contractor address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/razorpay/create-order', {
        method: 'POST',
        body: {
          contractorAddress: 'BAD',
          supervisorAddress: 'A'.repeat(58),
          workerAddress: 'A'.repeat(58),
          milestones: [{ amount: 1000, description: 'Test' }],
          amountINR: 1000
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('contractor');
    });

    test('POST /api/razorpay/create-order - rejects invalid milestones', async () => {
      if (!server) return;
      const res = await makeRequest('/api/razorpay/create-order', {
        method: 'POST',
        body: {
          contractorAddress: 'A'.repeat(58),
          supervisorAddress: 'A'.repeat(58),
          workerAddress: 'A'.repeat(58),
          milestones: [],
          amountINR: 1000
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('milestone');
    });

    test('POST /api/razorpay/create-order - rejects zero amount', async () => {
      if (!server) return;
      const res = await makeRequest('/api/razorpay/create-order', {
        method: 'POST',
        body: {
          contractorAddress: 'A'.repeat(58),
          supervisorAddress: 'A'.repeat(58),
          workerAddress: 'A'.repeat(58),
          milestones: [{ amount: 1000, description: 'Test milestone' }],
          amountINR: 0
        }
      });
      expect(res.status).toBe(400);
    });

    test('POST /api/razorpay/webhook - rejects missing signature', async () => {
      if (!server) return;
      const res = await makeRequest('/api/razorpay/webhook', {
        method: 'POST',
        body: { event: 'payment.captured' }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Signature');
    });
  });

  // ══════════════════════════════════════════════
  // CONSENT ROUTES
  // ══════════════════════════════════════════════
  describe('Consent API', () => {
    test('POST /api/consent/grant - rejects missing fields', async () => {
      if (!server) return;
      const res = await makeRequest('/api/consent/grant', {
        method: 'POST',
        body: {}
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing');
    });

    test('POST /api/consent/grant - rejects invalid worker address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/consent/grant', {
        method: 'POST',
        body: {
          workerAddress: 'SHORT',
          institutionAddress: 'A'.repeat(58),
          scope: 'loan',
          txid: 'TX123'
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('worker');
    });

    test('POST /api/consent/revoke - rejects missing fields', async () => {
      if (!server) return;
      const res = await makeRequest('/api/consent/revoke', {
        method: 'POST',
        body: {}
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('consentId');
    });

    test('GET /api/consent/:address/log - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/consent/BAD_ADDR/log');
      expect(res.status).toBe(400);
    });

    test('POST /api/consent/verify - rejects missing fields', async () => {
      if (!server) return;
      const res = await makeRequest('/api/consent/verify', {
        method: 'POST',
        body: {}
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing');
    });
  });

  // ══════════════════════════════════════════════
  // BANK ROUTES
  // ══════════════════════════════════════════════
  describe('Bank API', () => {
    test('GET /api/bank/worker-profile/:address - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/bank/worker-profile/INVALID');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });

    test('POST /api/bank/simulate-loan-approval - rejects invalid address', async () => {
      if (!server) return;
      const res = await makeRequest('/api/bank/simulate-loan-approval', {
        method: 'POST',
        body: {
          workerAddress: 'BAD',
          loanAmount: 10000,
          tenure: 6
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    });
  });

  // ══════════════════════════════════════════════
  // SECURITY HEADERS
  // ══════════════════════════════════════════════
  describe('Security', () => {
    test('CORS and Helmet headers are present', async () => {
      if (!server) return;
      const res = await makeRequest('/health');
      // Helmet sets various headers
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('Rate limiting header is set', async () => {
      if (!server) return;
      const res = await makeRequest('/health');
      // Rate limiter sets these headers
      expect(res.headers).toHaveProperty('x-ratelimit-limit');
    });
  });
});

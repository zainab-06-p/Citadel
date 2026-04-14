/**
 * Unit Tests: HMAC & Webhook Auth
 * Tests webhook signature verification used for Razorpay security
 */
const { verifyWebhookSignature, generateSignature } = require('../src/utils/hmac');

describe('HMAC Utility', () => {
  const SECRET = 'test_webhook_secret_12345';
  const BODY = JSON.stringify({ event: 'payment.captured', payload: { amount: 1000 } });

  describe('generateSignature', () => {
    test('produces a hex HMAC SHA256 string', () => {
      const sig = generateSignature(BODY, SECRET);
      expect(typeof sig).toBe('string');
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    test('produces deterministic output for same input', () => {
      const sig1 = generateSignature(BODY, SECRET);
      const sig2 = generateSignature(BODY, SECRET);
      expect(sig1).toBe(sig2);
    });

    test('produces different output for different bodies', () => {
      const sig1 = generateSignature('body1', SECRET);
      const sig2 = generateSignature('body2', SECRET);
      expect(sig1).not.toBe(sig2);
    });

    test('produces different output for different secrets', () => {
      const sig1 = generateSignature(BODY, 'secret1');
      const sig2 = generateSignature(BODY, 'secret2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyWebhookSignature', () => {
    test('returns true for valid signature', () => {
      const sig = generateSignature(BODY, SECRET);
      expect(verifyWebhookSignature(BODY, sig, SECRET)).toBe(true);
    });

    test('returns false for tampered body', () => {
      const sig = generateSignature(BODY, SECRET);
      const tampered = BODY + 'extra';
      expect(verifyWebhookSignature(tampered, sig, SECRET)).toBe(false);
    });

    test('returns false for wrong secret', () => {
      const sig = generateSignature(BODY, SECRET);
      expect(verifyWebhookSignature(BODY, sig, 'wrong_secret')).toBe(false);
    });

    test('returns false for tampered signature', () => {
      const sig = generateSignature(BODY, SECRET);
      const tampered = sig.substring(0, sig.length - 2) + 'ff';
      expect(verifyWebhookSignature(BODY, tampered, SECRET)).toBe(false);
    });

    test('returns false for empty signature', () => {
      expect(verifyWebhookSignature(BODY, '', SECRET)).toBe(false);
    });

    test('returns false for mismatched length signature', () => {
      expect(verifyWebhookSignature(BODY, 'short', SECRET)).toBe(false);
    });
  });
});

describe('webhookAuth middleware', () => {
  const { webhookAuth } = require('../src/middleware/webhookAuth');

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockReq = (signature, body, secret) => ({
    headers: { 'x-razorpay-signature': signature },
    body: body
  });

  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test_secret';
  });

  test('returns 400 when signature header is missing', () => {
    const req = { headers: {}, body: '{}' };
    const res = mockRes();
    const next = jest.fn();

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Missing')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 500 when webhook secret is not configured', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const req = { headers: { 'x-razorpay-signature': 'some-sig' }, body: '{}' };
    const res = mockRes();
    const next = jest.fn();

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid signature', () => {
    const req = { headers: { 'x-razorpay-signature': 'invalid_sig_here' }, body: '{}' };
    const res = mockRes();
    const next = jest.fn();

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() and parses body for valid signature', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const sig = generateSignature(body, 'test_secret');
    const req = { headers: { 'x-razorpay-signature': sig }, body: body };
    const res = mockRes();
    const next = jest.fn();

    webhookAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ event: 'payment.captured' });
  });

  test('returns 400 for valid signature but malformed JSON body', () => {
    const body = 'not valid json{{{';
    const sig = generateSignature(body, 'test_secret');
    const req = { headers: { 'x-razorpay-signature': sig }, body: body };
    const res = mockRes();
    const next = jest.fn();

    webhookAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Invalid JSON')
    }));
    expect(next).not.toHaveBeenCalled();
  });
});

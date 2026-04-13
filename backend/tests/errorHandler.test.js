/**
 * Unit Tests: Error Handler Middleware
 */
const { errorHandler } = require('../src/middleware/errorHandler');

describe('errorHandler middleware', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockReq = {};
  const mockNext = jest.fn();

  test('returns 500 by default for generic errors', () => {
    const err = new Error('Something broke');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Something broke',
      code: 'INTERNAL_ERROR',
      timestamp: expect.any(String),
    }));
  });

  test('respects custom statusCode on error object', () => {
    const err = new Error('Not Found');
    err.statusCode = 404;
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('respects custom error code', () => {
    const err = new Error('Bad request data');
    err.code = 'VALIDATION_ERROR';
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'VALIDATION_ERROR'
    }));
  });

  test('includes stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Dev error');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('excludes stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Prod error');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  test('uses default message when error has no message', () => {
    const err = {};
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Internal server error'
    }));
  });
});

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/index.js', () => ({
  appConfig: { isDev: false },
}));

import { errorHandler, createError } from '../errorHandler.js';

describe('errorHandler', () => {
  it('should send error response with status and message', () => {
    const err = { status: 404, message: 'Not Found' };
    const req = { method: 'GET', originalUrl: '/api/test' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Not Found' });
  });

  it('should default to 500 and generic message', () => {
    const err = {};
    const req = { method: 'GET', originalUrl: '/api/test' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: '服务器内部错误' });
  });
});

describe('createError()', () => {
  it('should create error with message and status', () => {
    const err = createError('Bad Request', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Bad Request');
    expect(err.status).toBe(400);
  });

  it('should default to 500', () => {
    const err = createError('Server Error');
    expect(err.status).toBe(500);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { requestLogger } from '../logger.js';

describe('requestLogger', () => {
  it('should register finish event listener', () => {
    const req = { method: 'GET', originalUrl: '/api/test' };
    const res = { on: vi.fn() };
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should call next()', () => {
    const req = { method: 'GET', originalUrl: '/api/test' };
    const res = { on: vi.fn() };
    const next = vi.fn();

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

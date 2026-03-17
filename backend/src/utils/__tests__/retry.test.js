import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../retry.js';

describe('withRetry()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return result on first success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and succeed on Nth attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 3, baseDelay: 100, maxDelay: 1000 });

    // Advance through retries
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw last error after exceeding maxRetries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100, maxDelay: 1000 });

    // Catch the rejection immediately to prevent unhandled rejection
    const catchPromise = promise.catch((e) => e);

    await vi.advanceTimersByTimeAsync(5000);

    const error = await catchPromise;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('always fails');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should pass custom options', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { maxRetries: 1, baseDelay: 50, maxDelay: 200, label: 'test' });

    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe('ok');
  });
});

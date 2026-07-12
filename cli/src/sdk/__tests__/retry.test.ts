import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, computeBackoffDelay } from '../retry.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** 跑空队列，推进 fake timer 下挂起的 setTimeout */
async function flush() {
  await vi.advanceTimersByTimeAsync(60_000);
}

describe('withRetry()', () => {
  it('首次成功不重试', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const p = withRetry(fn);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('5xx 重试直到成功', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500 } }))
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 502 } }))
      .mockResolvedValue('ok');
    const p = withRetry(fn, { maxRetries: 3 });
    const flushPromise = flush();
    await expect(p).resolves.toBe('ok');
    await flushPromise;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('4xx 默认不重试', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 400 } }));
    const p = withRetry(fn, { maxRetries: 3 });
    await expect(p).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retryOnAllErrors 对 4xx 也重试', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('bad'), { response: { status: 422 } }))
      .mockResolvedValue('ok');
    const p = withRetry(fn, { maxRetries: 3, retryOnAllErrors: true });
    const fp = flush();
    await expect(p).resolves.toBe('ok');
    await fp;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('达到 maxRetries 后抛最后一次错误', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('always'), { response: { status: 500 } }));
    const p = withRetry(fn, { maxRetries: 2 });
    const fp = flush();
    await expect(p).rejects.toThrow('always');
    await fp;
    expect(fn).toHaveBeenCalledTimes(3); // 初始 + 2 次重试
  });

  it('onRetry 回调被调用并携带 attempt/delay/label', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500 } }))
      .mockResolvedValue('ok');
    const p = withRetry(fn, { maxRetries: 2, label: 'L', onRetry });
    const fp = flush();
    await p;
    await fp;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, label: 'L' });
    expect(typeof onRetry.mock.calls[0][0].delay).toBe('number');
  });

  it('网络错误（无 response）也重试', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('net'), { code: 'ECONNREFUSED' }))
      .mockResolvedValue('ok');
    const p = withRetry(fn, { maxRetries: 2 });
    const fp = flush();
    await expect(p).resolves.toBe('ok');
    await fp;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('computeBackoffDelay()', () => {
  it('attempt 越大延迟越大（指数）', () => {
    const d0 = computeBackoffDelay(0, 1000, 10000);
    const d3 = computeBackoffDelay(3, 1000, 10000);
    // 去掉抖动比较基底
    expect(d0).toBeGreaterThanOrEqual(1000);
    expect(d3).toBeGreaterThanOrEqual(8000);
  });

  it('不超过 maxDelay', () => {
    const d = computeBackoffDelay(10, 1000, 5000);
    expect(d).toBeLessThanOrEqual(5000);
  });
});

import { describe, it, expect } from 'vitest';
import { runWithConcurrency } from '../array.js';

describe('runWithConcurrency()', () => {
  it('应按顺序返回所有结果', async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => async () => n * 2);
    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('空任务数组返回空数组', async () => {
    const results = await runWithConcurrency([], 3);
    expect(results).toEqual([]);
  });

  it('限制并发数不超过 limit', async () => {
    let currentRunning = 0;
    let maxRunning = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      currentRunning++;
      maxRunning = Math.max(maxRunning, currentRunning);
      await new Promise((r) => setTimeout(r, 10));
      currentRunning--;
      return 'done';
    });
    await runWithConcurrency(tasks, 3);
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it('并发数大于任务数时正常工作', async () => {
    const tasks = [1, 2].map((n) => async () => n);
    const results = await runWithConcurrency(tasks, 10);
    expect(results).toEqual([1, 2]);
  });

  it('单个任务失败时 reject 整体（Promise.all 语义）', async () => {
    const tasks = [
      async () => 'ok',
      async () => {
        throw new Error('fail');
      },
    ];
    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow('fail');
  });
});

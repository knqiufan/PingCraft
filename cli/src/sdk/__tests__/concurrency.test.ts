import { describe, it, expect } from 'vitest';
import { chunk, runWithConcurrency } from '../concurrency.js';

describe('chunk()', () => {
  it('按大小分块', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('size 向下取整且至少为 1', () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
    expect(chunk([1, 2, 3], 1.9)).toEqual([[1], [2], [3]]);
  });

  it('空数组', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('runWithConcurrency()', () => {
  it('结果按输入顺序', async () => {
    const tasks = [1, 2, 3, 4].map((n) => async () => {
      await new Promise((r) => setTimeout(r, Math.random() * 20));
      return n * 10;
    });
    const res = await runWithConcurrency(tasks, 2);
    expect(res).toEqual([10, 20, 30, 40]);
  });

  it('并发不超过 limit', async () => {
    let running = 0;
    let maxRunning = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return 'done';
    });
    await runWithConcurrency(tasks, 3);
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it('空输入返回空数组', async () => {
    expect(await runWithConcurrency([], 3)).toEqual([]);
  });

  it('limit 大于任务数时正常完成', async () => {
    const res = await runWithConcurrency([async () => 1, async () => 2], 10);
    expect(res).toEqual([1, 2]);
  });
});

/**
 * 并发控制工具（L2 sdk）。
 *
 * 迁移自后端 `utils/array.ts`：`chunk` + `runWithConcurrency`。
 * Phase 1 用于批量命令（workItems.batchCreate 等），保持顺序与受限并发，
 * 避免 Promise.all 一次性打满下游 PingCode 限流（200/min）。
 *
 * 无外部依赖，Phase 3 抽包候选。
 */

/** 将数组分割为指定大小的块 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  const s = Math.max(1, Math.floor(size));
  for (let i = 0; i < arr.length; i += s) {
    result.push(arr.slice(i, i + s));
  }
  return result;
}

/**
 * 以受限并发执行异步任务。
 *
 * @param tasks 返回 Promise 的函数数组
 * @param limit 最大并发数
 * @returns 按输入顺序排列的结果数组
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function runNext(): Promise<void> {
    while (true) {
      const i = index++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(Math.max(1, limit), tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

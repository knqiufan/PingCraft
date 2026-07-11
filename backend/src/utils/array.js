/**
 * 将数组分割为指定大小的块
 */
export function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * 以受限并发执行异步任务（避免 Promise.all 一次性打满下游 API 限流）。
 *
 * @param {Array<() => Promise>} tasks - 返回 Promise 的函数数组
 * @param {number} limit - 最大并发数
 * @returns {Promise<Array>} 按输入顺序排列的结果数组
 */
export async function runWithConcurrency(tasks, limit) {
  if (!tasks.length) return [];
  const results = new Array(tasks.length);
  let index = 0;

  async function runNext() {
    while (true) {
      const i = index++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => runNext()
  );
  await Promise.all(workers);
  return results;
}


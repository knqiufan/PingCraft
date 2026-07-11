/**
 * 带指数退避的重试工具
 *
 * 默认不对 4xx 客户端错误重试（参数错误、权限不足等不会因重试而成功），
 * 仅对 5xx 服务端错误和网络错误重试。可通过 retryOnAllErrors: true 关闭此行为。
 *
 * @param {Function} fn - 需要重试的异步函数
 * @param {object} options - 配置
 * @param {number} [options.maxRetries=3] - 最大重试次数
 * @param {number} [options.baseDelay=1000] - 基础延迟（毫秒）
 * @param {number} [options.maxDelay=10000] - 最大延迟（毫秒）
 * @param {string} [options.label=''] - 日志标签
 * @param {boolean} [options.retryOnAllErrors=false] - 为 true 时对所有错误（含 4xx）重试
 * @returns {Promise<*>} 函数执行结果
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    label = '',
    retryOnAllErrors = false,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) {
        break;
      }

      // 4xx 客户端错误不重试（除非显式要求）
      const status = err?.response?.status;
      if (!retryOnAllErrors && status >= 400 && status < 500) {
        break;
      }

      // 指数退避 + 随机抖动
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
      const tag = label ? `[${label}]` : '';
      console.warn(`${tag} 第 ${attempt + 1} 次失败，${Math.round(delay)}ms 后重试: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

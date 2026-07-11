/**
 * 带指数退避的重试工具
 *
 * 默认不对 4xx 客户端错误重试（参数错误、权限不足等不会因重试而成功），
 * 仅对 5xx 服务端错误和网络错误重试。可通过 retryOnAllErrors: true 关闭此行为。
 */

/** withRetry 配置选项 */
export interface RetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 基础延迟（毫秒，默认 1000） */
  baseDelay?: number;
  /** 最大延迟（毫秒，默认 10000） */
  maxDelay?: number;
  /** 日志标签 */
  label?: string;
  /** 为 true 时对所有错误（含 4xx）重试 */
  retryOnAllErrors?: boolean;
}

/** axios 风格的错误（带 response.status） */
interface AxiosLikeError {
  response?: { status?: number };
  message?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    label = '',
    retryOnAllErrors = false,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const axiosErr = err as AxiosLikeError;

      if (attempt === maxRetries) {
        break;
      }

      // 4xx 客户端错误不重试（除非显式要求）
      const status = axiosErr?.response?.status;
      if (!retryOnAllErrors && status && status >= 400 && status < 500) {
        break;
      }

      // 指数退避 + 随机抖动
      const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
      const tag = label ? `[${label}]` : '';
      console.warn(
        `${tag} 第 ${attempt + 1} 次失败，${Math.round(delay)}ms 后重试: ${axiosErr?.message ?? err}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

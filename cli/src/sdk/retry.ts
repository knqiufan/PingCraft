/**
 * 带指数退避的重试工具（L2 sdk）。
 *
 * 迁移自后端 `utils/retry.ts`，并做库化改造：去掉 `console.warn` 直写，
 * 改为可选的 `onRetry` 回调（默认 noop），保持 sdk 层无 IO 副作用、无外部依赖。
 *
 * 默认不对 4xx 客户端错误重试（参数错误、权限不足等不会因重试而成功），
 * 仅对 5xx 服务端错误和网络错误重试。可通过 `retryOnAllErrors: true` 关闭此行为。
 *
 * Phase 3 抽 `@pingcraft/pingcode-sdk` 共享包时，本文件是首批候选。
 */

export interface RetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 基础延迟（毫秒，默认 1000） */
  baseDelay?: number;
  /** 最大延迟（毫秒，默认 10000） */
  maxDelay?: number;
  /** 日志标签（透传给 onRetry，便于上层归类） */
  label?: string;
  /** 为 true 时对所有错误（含 4xx）重试 */
  retryOnAllErrors?: boolean;
  /** 重试前回调（默认 noop；上层可接 logProgress 等） */
  onRetry?: (info: { attempt: number; delay: number; error: unknown; label?: string }) => void;
}

/** axios 风格错误的最小结构 */
interface HttpLikeError {
  response?: { status?: number };
  message?: string;
  code?: string;
}

/**
 * 指数退避 + 随机抖动。第 attempt 次失败后的延迟：
 *   min(baseDelay * 2^attempt + jitter(0..500), maxDelay)
 */
export function computeBackoffDelay(attempt: number, baseDelay = 1000, maxDelay = 10000): number {
  return Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 500, maxDelay);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    label,
    retryOnAllErrors = false,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const httpErr = err as HttpLikeError;

      if (attempt === maxRetries) break;

      // 4xx 客户端错误不重试（除非显式要求）
      const status = httpErr?.response?.status;
      if (!retryOnAllErrors && status !== undefined && status >= 400 && status < 500) break;

      const delay = computeBackoffDelay(attempt, baseDelay, maxDelay);
      onRetry?.({ attempt: attempt + 1, delay, error: err, label });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

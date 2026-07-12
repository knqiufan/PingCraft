/**
 * PingCode HTTP client（L2 sdk）。
 *
 * 设计要点（对照阶段 1 §3.2 与风险备注 §8）：
 *  - **统一重试循环**（非 axios 拦截器）：401 刷新重放、429 退避、5xx/网络 指数退避三者在
 *    同一循环内**互斥分支**处理，避免"429 退避后又进 withRetry 二次延迟"。
 *  - **无鉴权请求**：`{ auth: false }` 跳过 Bearer 注入，供 token 端点使用（风险 §8）。
 *  - 令牌由调用方经 `credentials.getToken()` 提供，过期由 core/auth 检测、刷新由
 *    `credentials.refreshToken()` 完成后更新存储，重放自动取得新令牌。
 *  - 暴露底层 `axios` 实例，便于测试挂 `axios-mock-adapter`。
 */
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { computeBackoffDelay } from './retry.js';

/** 凭证提供者（由 core/auth + config 装配） */
export interface ClientCredentials {
  /** 取当前 access_token（可能为空——未登录时） */
  getToken(): Promise<string | undefined>;
  /** 刷新令牌（更新存储）；失败时抛错。存在时 401 会触发一次刷新重放 */
  refreshToken?(): Promise<void>;
}

export interface CreateClientOptions {
  /** PingCode 开放平台地址，如 https://open.pingcode.com */
  host: string;
  /** API 基路径前缀（默认 /v1） */
  apiPrefix?: string;
  credentials?: ClientCredentials;
  /** 5xx/网络错误最大重试次数（默认 3） */
  maxRetries?: number;
  /** 429 退避最大重试次数（默认 5） */
  rateLimitMaxRetries?: number;
  /** 请求超时（毫秒，默认 30000） */
  timeout?: number;
  /** User-Agent */
  userAgent?: string;
  /** 退避回调（便于上层 logProgress） */
  onBackoff?: (info: { reason: 'rate-limit' | 'server' | 'network'; attempt: number; delay: number }) => void;
}

/** 单次请求的扩展选项 */
export interface RequestOptions {
  /** 是否注入 Bearer 鉴权头（默认 true；token 端点传 false） */
  auth?: boolean;
  /** query 参数 */
  params?: Record<string, unknown>;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 响应类型（默认 json） */
  responseType?: 'json' | 'arraybuffer' | 'text';
}

/** 客户端公共接口 */
export interface PingCodeClient {
  readonly axios: AxiosInstance;
  get<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
}

const NETWORK_ERR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'ERR_NETWORK',
]);

/** 解析 Retry-After / x-pc-retry-after 头（秒数或 HTTP-date），返回毫秒 */
function parseRetryAfter(value: unknown, fallbackMs: number): number {
  if (value === undefined || value === null) return fallbackMs;
  // 数字 → 秒
  const asNum = Number(value);
  if (Number.isFinite(asNum)) return Math.max(0, asNum) * 1000;
  // HTTP-date
  const ts = Date.parse(String(value));
  if (Number.isFinite(ts)) return Math.max(0, ts - Date.now());
  return fallbackMs;
}

function getHeader(headers: unknown, name: string): unknown {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as Record<string, unknown>;
  // 大小写不敏感查找
  const key = Object.keys(h).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? h[key] : undefined;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 创建 PingCode 客户端。
 *
 * 内部 axios 实例 baseURL 为 `${host}${apiPrefix}`，模块方法传相对路径（如 `/project/projects`）。
 */
export function createClient(opts: CreateClientOptions): PingCodeClient {
  const apiPrefix = opts.apiPrefix ?? '/v1';
  const maxRetries = opts.maxRetries ?? 3;
  const rateLimitMaxRetries = opts.rateLimitMaxRetries ?? 5;
  const timeout = opts.timeout ?? 30_000;
  const userAgent = opts.userAgent ?? '@pingcraft/cli';

  const ax: AxiosInstance = axios.create({
    baseURL: `${opts.host.replace(/\/$/, '')}${apiPrefix}`,
    timeout,
    headers: { 'User-Agent': userAgent, Accept: 'application/json' },
  });

  async function doRequest<T>(method: string, url: string, body: unknown, options?: RequestOptions): Promise<T> {
    const wantAuth = options?.auth !== false;
    let hasRefreshed = false;
    let rateRetries = 0;
    let serverRetries = 0;

    // 每次循环重新读 token，使刷新后重放取得新令牌
    while (true) {
      const headers: Record<string, string> = { ...(options?.headers ?? {}) };
      if (wantAuth) {
        const token = await opts.credentials?.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      try {
        const res = await ax.request<unknown, { data: T }>({
          method,
          url,
          data: body,
          params: options?.params,
          headers,
          responseType: options?.responseType ?? 'json',
        });
        return res.data;
      } catch (err) {
        const e = err as AxiosError;
        const status = e.response?.status;
        const headersLo = e.response?.headers;

        // 401：刷新一次后重放（仅当提供了 refreshToken 且本次请求需要鉴权）
        if (status === 401 && wantAuth && opts.credentials?.refreshToken && !hasRefreshed) {
          hasRefreshed = true;
          await opts.credentials.refreshToken();
          continue;
        }

        // 429：读 x-pc-retry-after 退避后重试（专用分支，与 5xx 互斥）
        if (status === 429 && rateRetries < rateLimitMaxRetries) {
          rateRetries++;
          const delay = parseRetryAfter(getHeader(headersLo, 'x-pc-retry-after'), 1000 * rateRetries);
          opts.onBackoff?.({ reason: 'rate-limit', attempt: rateRetries, delay });
          await sleep(delay);
          continue;
        }

        // 5xx：指数退避重试
        const isServer = status !== undefined && status >= 500;
        const isNetwork = e.response === undefined && (!!e.code && NETWORK_ERR_CODES.has(e.code));
        if ((isServer || isNetwork) && serverRetries < maxRetries) {
          serverRetries++;
          const delay = computeBackoffDelay(serverRetries - 1);
          opts.onBackoff?.({ reason: isServer ? 'server' : 'network', attempt: serverRetries, delay });
          await sleep(delay);
          continue;
        }

        throw err; // 4xx（非 401/429）或预算耗尽——交由 core/errors 归一化
      }
    }
  }

  return {
    axios: ax,
    get: (url, options) => doRequest('GET', url, undefined, options),
    post: (url, body, options) => doRequest('POST', url, body, options),
    patch: (url, body, options) => doRequest('PATCH', url, body, options),
    put: (url, body, options) => doRequest('PUT', url, body, options),
    delete: (url, options) => doRequest('DELETE', url, undefined, options),
  };
}

/**
 * 错误与退出码规范（L1 core）。
 *
 * 与总体规划 §4.3 的退出码表对齐；提供统一的 `CliError` 与 axios→CliError 映射，
 * 以及机器可读的 stderr 错误体（见阶段 1 §5.2）。
 */

/** 退出码（与总体规划 §4.3 一致） */
export const ExitCode = {
  SUCCESS: 0,
  GENERIC: 1,
  ARGS: 2,
  UNAUTHORIZED: 3,
  FORBIDDEN: 4,
  NOT_FOUND: 5,
  RATE_LIMITED: 10,
  NETWORK: 20,
  API_ERROR: 30,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** 常用机器错误码（error.code） */
export const ErrorCode = {
  UNAUTHORIZED: 'E_UNAUTHORIZED',
  FORBIDDEN: 'E_FORBIDDEN',
  NOT_FOUND: 'E_NOT_FOUND',
  RATE_LIMITED: 'E_RATE_LIMITED',
  NETWORK: 'E_NETWORK',
  API_ERROR: 'E_API_ERROR',
  ARGS: 'E_ARGS',
  GENERIC: 'E_GENERIC',
} as const;

export interface CliErrorOptions {
  /** 人类可读信息 */
  message: string;
  /** 机器错误码（如 E_NOT_FOUND），默认 E_GENERIC */
  code?: string;
  /** 进程退出码，默认 ExitCode.GENERIC */
  exitCode?: ExitCodeValue;
  /** HTTP 状态码（若有） */
  statusCode?: number;
  /** PingCode 返回的原始错误码（透传给上层） */
  pingcodeCode?: string | number;
  /** 原始错误 */
  cause?: unknown;
}

/**
 * CLI 统一错误类型。handler 捕获后经 `emitError` 输出 stderr，并以 `exitCode` 退出。
 */
export class CliError extends Error {
  readonly code: string;
  readonly exitCode: ExitCodeValue;
  readonly statusCode?: number;
  readonly pingcodeCode?: string | number;

  constructor(opts: CliErrorOptions) {
    super(opts.message);
    this.name = 'CliError';
    this.code = opts.code ?? ErrorCode.GENERIC;
    this.exitCode = opts.exitCode ?? ExitCode.GENERIC;
    this.statusCode = opts.statusCode;
    this.pingcodeCode = opts.pingcodeCode;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }

  /** 序列化为机器可读的 error 体（不含 stack） */
  toJSON(): { code: string; message: string; statusCode?: number; pingcodeCode?: string | number } {
    const body: { code: string; message: string; statusCode?: number; pingcodeCode?: string | number } = {
      code: this.code,
      message: this.message,
    };
    if (this.statusCode !== undefined) body.statusCode = this.statusCode;
    if (this.pingcodeCode !== undefined) body.pingcodeCode = this.pingcodeCode;
    return body;
  }
}

/** axios 风格错误的最小结构（避免直接依赖 axios 类型） */
interface AxiosLikeError {
  response?: { status?: number; data?: unknown };
  code?: string;
  message?: string;
}

/** 从 PingCode 响应体中提取原始错误码（兼容多种字段名） */
function extractPingcodeCode(data: unknown): string | number | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const candidate = obj.code ?? obj.error_code ?? obj.error;
  if (typeof candidate === 'string' || typeof candidate === 'number') return candidate;
  return undefined;
}

/** 从 PingCode 响应体中提取人类可读信息 */
function extractPingcodeMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  const msg = obj.message ?? obj.msg ?? obj.error;
  return typeof msg === 'string' && msg ? msg : fallback;
}

const NETWORK_ERR_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
]);

/**
 * 将任意错误（重点是 axios 错误）归一化为 `CliError`。
 *
 * 映射：401→UNAUTHORIZED, 403→FORBIDDEN, 404→NOT_FOUND, 429→RATE_LIMITED,
 * 5xx/其它非 2xx→API_ERROR，网络错误→NETWORK，其余→GENERIC。
 */
export function toCliError(err: unknown): CliError {
  if (err instanceof CliError) return err;

  const ax = err as AxiosLikeError;

  // 有 HTTP 响应
  if (ax?.response) {
    const status = ax.response.status;
    const data = ax.response.data;
    const pingcodeCode = extractPingcodeCode(data);
    const message = extractPingcodeMessage(data, ax.message ?? 'PingCode API 错误');

    if (status === 401) {
      return new CliError({ message, code: ErrorCode.UNAUTHORIZED, exitCode: ExitCode.UNAUTHORIZED, statusCode: status, pingcodeCode, cause: err });
    }
    if (status === 403) {
      return new CliError({ message, code: ErrorCode.FORBIDDEN, exitCode: ExitCode.FORBIDDEN, statusCode: status, pingcodeCode, cause: err });
    }
    if (status === 404) {
      return new CliError({ message, code: ErrorCode.NOT_FOUND, exitCode: ExitCode.NOT_FOUND, statusCode: status, pingcodeCode, cause: err });
    }
    if (status === 429) {
      return new CliError({ message, code: ErrorCode.RATE_LIMITED, exitCode: ExitCode.RATE_LIMITED, statusCode: status, pingcodeCode, cause: err });
    }
    if (status !== undefined && status >= 500) {
      return new CliError({ message, code: ErrorCode.API_ERROR, exitCode: ExitCode.API_ERROR, statusCode: status, pingcodeCode, cause: err });
    }
    // 其它非 2xx
    return new CliError({ message, code: ErrorCode.API_ERROR, exitCode: ExitCode.API_ERROR, statusCode: status, pingcodeCode, cause: err });
  }

  // 无响应：网络层错误
  if (ax?.code && NETWORK_ERR_CODES.has(ax.code)) {
    return new CliError({ message: ax.message ?? '网络错误', code: ErrorCode.NETWORK, exitCode: ExitCode.NETWORK, cause: err });
  }

  // 兜底
  return new CliError({ message: err instanceof Error ? err.message : String(err), code: ErrorCode.GENERIC, exitCode: ExitCode.GENERIC, cause: err });
}

/** 将错误以 JSON 写入 stderr（机器可读），返回应使用的退出码 */
export function emitError(err: unknown, stream: NodeJS.WritableStream = process.stderr): ExitCodeValue {
  const cliErr = toCliError(err);
  stream.write(`${JSON.stringify({ error: cliErr.toJSON() })}\n`);
  return cliErr.exitCode;
}

import { describe, it, expect } from 'vitest';
import {
  CliError,
  ExitCode,
  ErrorCode,
  toCliError,
  emitError,
} from '../errors.js';

/** 构造一个 axios 风格错误 */
function axiosError(status: number | undefined, data?: unknown, code?: string) {
  const err: Record<string, unknown> = {
    message: 'request failed',
    code,
  };
  if (status !== undefined) {
    err.response = { status, data };
  }
  return err;
}

describe('toCliError() 状态码映射', () => {
  it('401 → UNAUTHORIZED / exit 3', () => {
    const e = toCliError(axiosError(401, { code: '100001', message: '未授权' }));
    expect(e).toBeInstanceOf(CliError);
    expect(e.exitCode).toBe(ExitCode.UNAUTHORIZED);
    expect(e.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(e.statusCode).toBe(401);
    expect(e.pingcodeCode).toBe('100001');
    expect(e.message).toBe('未授权');
  });

  it('403 → FORBIDDEN / exit 4', () => {
    expect(toCliError(axiosError(403)).exitCode).toBe(ExitCode.FORBIDDEN);
  });

  it('404 → NOT_FOUND / exit 5', () => {
    expect(toCliError(axiosError(404)).exitCode).toBe(ExitCode.NOT_FOUND);
  });

  it('429 → RATE_LIMITED / exit 10，透传 pingcodeCode', () => {
    const e = toCliError(axiosError(429, { code: 100051, message: '限流' }));
    expect(e.exitCode).toBe(ExitCode.RATE_LIMITED);
    expect(e.pingcodeCode).toBe(100051);
  });

  it('500 → API_ERROR / exit 30', () => {
    expect(toCliError(axiosError(500)).exitCode).toBe(ExitCode.API_ERROR);
  });

  it('其它 4xx → API_ERROR', () => {
    expect(toCliError(axiosError(422, { message: '校验失败' })).exitCode).toBe(ExitCode.API_ERROR);
  });

  it('网络错误（ENOTFOUND 等）→ NETWORK / exit 20', () => {
    const e = toCliError(axiosError(undefined, undefined, 'ENOTFOUND'));
    expect(e.exitCode).toBe(ExitCode.NETWORK);
    expect(e.code).toBe(ErrorCode.NETWORK);
  });

  it('ECONNREFUSED → NETWORK', () => {
    expect(toCliError(axiosError(undefined, undefined, 'ECONNREFUSED')).exitCode).toBe(ExitCode.NETWORK);
  });

  it('普通 Error → GENERIC / exit 1', () => {
    const e = toCliError(new Error('boom'));
    expect(e.exitCode).toBe(ExitCode.GENERIC);
    expect(e.message).toBe('boom');
  });

  it('CliError 透传（幂等）', () => {
    const original = new CliError({ message: 'x', exitCode: ExitCode.NOT_FOUND });
    expect(toCliError(original)).toBe(original);
  });

  it('响应体无 message 字段时回退到 axios message', () => {
    const e = toCliError(axiosError(500, { unrelated: 1 }));
    expect(e.message).toBe('request failed');
  });
});

describe('CliError', () => {
  it('toJSON() 只含 code/message/statusCode/pingcodeCode', () => {
    const e = new CliError({
      message: '不存在',
      code: ErrorCode.NOT_FOUND,
      exitCode: ExitCode.NOT_FOUND,
      statusCode: 404,
      pingcodeCode: '100010',
    });
    expect(e.toJSON()).toEqual({
      code: 'E_NOT_FOUND',
      message: '不存在',
      statusCode: 404,
      pingcodeCode: '100010',
    });
  });

  it('默认 code 与 exitCode', () => {
    const e = new CliError({ message: 'x' });
    expect(e.code).toBe(ErrorCode.GENERIC);
    expect(e.exitCode).toBe(ExitCode.GENERIC);
    expect(e.toJSON()).not.toHaveProperty('statusCode');
  });
});

describe('emitError()', () => {
  it('写机器可读 JSON 到流并返回退出码', () => {
    const writes: string[] = [];
    const stream = { write: (s: string) => (writes.push(s), true) } as unknown as NodeJS.WritableStream;
    const code = emitError(new CliError({ message: '不存在', code: ErrorCode.NOT_FOUND, exitCode: ExitCode.NOT_FOUND, statusCode: 404 }), stream);
    expect(code).toBe(ExitCode.NOT_FOUND);
    expect(writes.length).toBe(1);
    const parsed = JSON.parse(writes[0]);
    expect(parsed).toEqual({
      error: { code: 'E_NOT_FOUND', message: '不存在', statusCode: 404 },
    });
  });

  it('对裸 axios 错误也能归一化输出', () => {
    const writes: string[] = [];
    const stream = { write: (s: string) => (writes.push(s), true) } as unknown as NodeJS.WritableStream;
    const code = emitError(axiosError(404), stream);
    expect(code).toBe(ExitCode.NOT_FOUND);
    expect(JSON.parse(writes[0]).error.code).toBe('E_NOT_FOUND');
  });
});

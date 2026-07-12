import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadCredentials, saveCredentials, clearCredentials, isExpired } from '../auth.js';
import { readConfigFile } from '../config.js';

function tmpFile(): string {
  return path.join(os.tmpdir(), `pingcode-auth-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

let file: string;

beforeEach(() => {
  delete process.env.PINGCODE_CONFIG_FILE;
  file = tmpFile();
});

afterEach(() => {
  try {
    fs.unlinkSync(file);
  } catch {
    /* noop */
  }
});

describe('saveCredentials / loadCredentials', () => {
  it('写入后可读回', () => {
    saveCredentials('default', { accessToken: 'acc', refreshToken: 'ref', expiresAt: '2099-01-01T00:00:00.000Z' }, file);
    const creds = loadCredentials('default', file);
    expect(creds).toEqual({ accessToken: 'acc', refreshToken: 'ref', expiresAt: '2099-01-01T00:00:00.000Z' });
  });

  it('保留 profile 内其它连接配置', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', client_id: 'cid' } } }));
    saveCredentials('default', { accessToken: 'acc' }, file);
    const cfg = readConfigFile(file);
    expect(cfg.profiles.default?.host).toBe('https://x');
    expect(cfg.profiles.default?.client_id).toBe('cid');
    expect(cfg.profiles.default?.token?.access_token).toBe('acc');
  });

  it('合并写：未提供字段保留原值', () => {
    saveCredentials('default', { accessToken: 'a1', refreshToken: 'r1' }, file);
    saveCredentials('default', { accessToken: 'a2' }, file);
    const creds = loadCredentials('default', file);
    expect(creds.accessToken).toBe('a2');
    expect(creds.refreshToken).toBe('r1');
  });

  it('文件不存在时 loadCredentials 返回空对象', () => {
    expect(loadCredentials('default', file)).toEqual({});
  });

  it('空串清空对应字段', () => {
    saveCredentials('default', { accessToken: 'acc' }, file);
    saveCredentials('default', { accessToken: '' }, file);
    expect(loadCredentials('default', file).accessToken).toBe('');
  });

  it('POSIX 下文件权限为 0o600', { skip: process.platform === 'win32' }, () => {
    saveCredentials('default', { accessToken: 'acc' }, file);
    const stat = fs.statSync(file);
    // 掩码取低 9 位
    expect(stat.mode & 0o777).toBe(0o600);
  });
});

describe('clearCredentials()', () => {
  it('删除 token 但保留 profile 连接配置', () => {
    saveCredentials('default', { accessToken: 'acc', refreshToken: 'ref' }, file);
    clearCredentials('default', file);
    const cfg = readConfigFile(file);
    expect(cfg.profiles.default?.token).toBeUndefined();
  });

  it('profile 不存在时无副作用', () => {
    expect(() => clearCredentials('nope', file)).not.toThrow();
  });
});

describe('isExpired()', () => {
  it('无 expiresAt 返回 false（交由 API 401 触发刷新）', () => {
    expect(isExpired(undefined)).toBe(false);
  });

  it('未来时间未过期', () => {
    const future = new Date(Date.now() + 3600 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });

  it('过去时间已过期', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it('skewMin 提前量：距过期 5 分钟内视为过期', () => {
    const soon = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 分钟后
    expect(isExpired(soon, 5)).toBe(true);
    expect(isExpired(soon, 1)).toBe(false);
  });

  it('非法时间字符串返回 false', () => {
    expect(isExpired('not-a-date')).toBe(false);
  });
});

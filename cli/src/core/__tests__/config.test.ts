import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadConfig,
  readConfigFile,
  writeConfigFile,
  resolveProfileName,
  DEFAULT_HOST,
  DEFAULT_PROFILE_NAME,
} from '../config.js';
import { CliError } from '../errors.js';

function tmpFile(): string {
  return path.join(os.tmpdir(), `pingcode-config-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

const ENV_KEYS = [
  'PINGCODE_HOST',
  'PINGCODE_CLIENT_ID',
  'PINGCODE_CLIENT_SECRET',
  'PINGCODE_ACCESS_TOKEN',
  'PINGCODE_REFRESH_TOKEN',
  'PINGCODE_PROFILE',
  'PINGCODE_CONFIG_FILE',
  'PINGCODE_REDIRECT_URI',
  'PINGCRAFT_API_URL',
];

let savedEnv: Record<string, string | undefined>;
let file: string;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  file = tmpFile();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  try {
    fs.unlinkSync(file);
  } catch {
    /* noop */
  }
});

describe('readConfigFile()', () => {
  it('文件不存在时返回空配置', () => {
    const cfg = readConfigFile(file);
    expect(cfg.profiles).toEqual({});
  });

  it('合法文件可读取并填充默认 profiles', () => {
    fs.writeFileSync(file, JSON.stringify({ default_profile: 'p', profiles: { p: { host: 'https://x' } } }));
    const cfg = readConfigFile(file);
    expect(cfg.default_profile).toBe('p');
    expect(cfg.profiles.p?.host).toBe('https://x');
  });

  it('JSON 解析失败抛 CliError(ARGS)', () => {
    fs.writeFileSync(file, '{ not json');
    expect(() => readConfigFile(file)).toThrow(CliError);
    try {
      readConfigFile(file);
    } catch (e) {
      expect((e as CliError).exitCode).toBe(2);
    }
  });

  it('schema 校验失败抛 CliError(ARGS)', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: 'not-an-object' }));
    expect(() => readConfigFile(file)).toThrow(CliError);
  });
});

describe('writeConfigFile()', () => {
  it('写入并创建目录', () => {
    const nested = path.join(path.dirname(file), `nested-${Date.now()}`, 'config.json');
    writeConfigFile({ profiles: { a: { host: 'h' } } }, nested);
    const cfg = readConfigFile(nested);
    expect(cfg.profiles.a?.host).toBe('h');
    fs.unlinkSync(nested);
    fs.rmdirSync(path.dirname(nested));
  });
});

describe('resolveProfileName()', () => {
  it('args 优先', () => {
    process.env.PINGCODE_PROFILE = 'env';
    expect(resolveProfileName({ profile: 'args' }, { default_profile: 'file', profiles: {} })).toBe('args');
    delete process.env.PINGCODE_PROFILE;
  });

  it('env 次之', () => {
    process.env.PINGCODE_PROFILE = 'env';
    expect(resolveProfileName({}, { default_profile: 'file', profiles: {} })).toBe('env');
    delete process.env.PINGCODE_PROFILE;
  });

  it('file.default_profile 再次之', () => {
    expect(resolveProfileName({}, { default_profile: 'file', profiles: {} })).toBe('file');
  });

  it('全部缺失时回退默认', () => {
    expect(resolveProfileName({}, { profiles: {} })).toBe(DEFAULT_PROFILE_NAME);
  });
});

describe('loadConfig() 三源合并', () => {
  it('全部缺失时 host 回退默认', () => {
    const cfg = loadConfig({ configFilePath: file });
    expect(cfg.host).toBe(DEFAULT_HOST);
    expect(cfg.name).toBe(DEFAULT_PROFILE_NAME);
  });

  it('文件 profile 提供连接与凭证', () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        profiles: { default: { host: 'https://file', client_id: 'cid', token: { access_token: 'tok', expires_at: '2099-01-01T00:00:00.000Z' } } },
      }),
    );
    const cfg = loadConfig({ configFilePath: file });
    expect(cfg.host).toBe('https://file');
    expect(cfg.clientId).toBe('cid');
    expect(cfg.accessToken).toBe('tok');
    expect(cfg.expiresAt).toBe('2099-01-01T00:00:00.000Z');
  });

  it('env 覆盖文件', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://file', client_id: 'filecid' } } }));
    process.env.PINGCODE_HOST = 'https://env';
    process.env.PINGCODE_CLIENT_ID = 'envcid';
    const cfg = loadConfig({ configFilePath: file });
    expect(cfg.host).toBe('https://env');
    expect(cfg.clientId).toBe('envcid');
  });

  it('args 覆盖 env 与文件', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://file' } } }));
    process.env.PINGCODE_HOST = 'https://env';
    const cfg = loadConfig({ configFilePath: file, host: 'https://arg' });
    expect(cfg.host).toBe('https://arg');
  });

  it('--profile 切换不同 profile', () => {
    fs.writeFileSync(
      file,
      JSON.stringify({ profiles: { a: { host: 'https://a' }, b: { host: 'https://b' } } }),
    );
    expect(loadConfig({ configFilePath: file, profile: 'b' }).host).toBe('https://b');
    expect(loadConfig({ configFilePath: file, profile: 'a' }).host).toBe('https://a');
  });

  it('PINGCODE_ACCESS_TOKEN 覆盖文件 token', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { token: { access_token: 'filetoken' } } } }));
    process.env.PINGCODE_ACCESS_TOKEN = 'envtoken';
    expect(loadConfig({ configFilePath: file }).accessToken).toBe('envtoken');
  });

  it('pingcraft_api_url 经 env/文件合并', () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { pingcraft_api_url: 'http://file:3000' } } }));
    expect(loadConfig({ configFilePath: file }).pingcraftApiUrl).toBe('http://file:3000');
    process.env.PINGCRAFT_API_URL = 'http://env:3000';
    expect(loadConfig({ configFilePath: file }).pingcraftApiUrl).toBe('http://env:3000');
  });
});

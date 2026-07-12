import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCmd, parseJsonOut } from '../../../tests/cmd-driver.js';

// ---- SDK 模拟（whoami 等需走 SDK 的命令）----
const sdkMocks = vi.hoisted(() => ({
  getMyself: vi.fn(),
}));
vi.mock('../../sdk/index.js', () => {
  const stub = () => {
    const cache = new Map<string, ReturnType<typeof vi.fn>>();
    return new Proxy(
      {},
      {
        get: (_t, key) => {
          if (typeof key !== 'string') return undefined;
          if (!cache.has(key)) cache.set(key, vi.fn(async () => ({ values: [], total: 0 })));
          return cache.get(key);
        },
      },
    );
  };
  return {
    createClient: vi.fn(() => ({ axios: {}, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn(), postForm: vi.fn() })),
    createAuthModule: vi.fn(() => ({
      getMyself: sdkMocks.getMyself,
      buildAuthUrl: vi.fn(() => 'https://open.pingcode.com/oauth2/authorize?client_id=cid'),
      getTokenByCode: vi.fn(async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })),
      getTokenByClientCredentials: vi.fn(async () => ({ access_token: 'at', expires_in: 3600 })),
      refresh: vi.fn(async () => ({ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 })),
    })),
    createProjectsModule: vi.fn(() => stub()),
    createWorkItemsModule: vi.fn(() => stub()),
    createWorkItemMetaModule: vi.fn(() => stub()),
    createWorkItemSubResourcesModule: vi.fn(() => stub()),
    createWorkItemSchemeModule: vi.fn(() => stub()),
    createSprintsModule: vi.fn(() => stub()),
    createReleasesModule: vi.fn(() => stub()),
    createKanbansModule: vi.fn(() => stub()),
    createWaterfallModule: vi.fn(() => stub()),
    createDirectoryModule: vi.fn(() => stub()),
    createCommonResourcesModule: vi.fn(() => stub()),
    createLogsModule: vi.fn(() => stub()),
    createWikiModule: vi.fn(() => stub()),
    createProductsModule: vi.fn(() => stub()),
    createCustomersModule: vi.fn(() => stub()),
    createTicketsModule: vi.fn(() => stub()),
    createRequirementsModule: vi.fn(() => stub()),
    createTestLibraryModule: vi.fn(() => stub()),
    createTestCasesModule: vi.fn(() => stub()),
    createTestPlansModule: vi.fn(() => stub()),
    createTestExecutionsModule: vi.fn(() => stub()),
    createTestConfigModule: vi.fn(() => stub()),
    createScmModule: vi.fn(() => stub()),
    createBuildModule: vi.fn(() => stub()),
    createDeliveryModule: vi.fn(() => stub()),
  };
});

function tmpFile(): string {
  return path.join(os.tmpdir(), `pingcode-cmd-auth-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

let file: string;
const ENV_KEYS = ['PINGCODE_CONFIG_FILE', 'PINGCODE_HOST', 'PINGCODE_CLIENT_ID', 'PINGCODE_CLIENT_SECRET', 'PINGCODE_ACCESS_TOKEN', 'PINGCODE_PROFILE'];
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  file = tmpFile();
  process.env.PINGCODE_CONFIG_FILE = file;
  sdkMocks.getMyself.mockReset();
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

describe('auth status', () => {
  it('未登录时显示 authenticated=false，退出码 0', async () => {
    const { stdout, exitCode } = await runCmd(['auth', 'status', '--json']);
    expect(exitCode).toBe(0);
    const data = parseJsonOut<{ data: { authenticated: boolean; profile: string } }>(stdout).data;
    expect(data.authenticated).toBe(false);
    expect(data.profile).toBe('default');
  });

  it('已登录时显示凭证与过期状态', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        profiles: { default: { host: 'https://x', token: { access_token: 'tok', refresh_token: 'rt', expires_at: '2099-01-01T00:00:00.000Z' } } },
      }),
    );
    const { stdout, exitCode } = await runCmd(['auth', 'status', '--json']);
    expect(exitCode).toBe(0);
    const data = parseJsonOut<{ data: { authenticated: boolean; hasRefreshToken: boolean; expired: boolean } }>(stdout).data;
    expect(data).toMatchObject({ authenticated: true, hasRefreshToken: true, expired: false });
  });
});

describe('auth logout', () => {
  it('清除凭证（保留连接配置）', async () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', client_id: 'cid', token: { access_token: 'tok' } } } }));
    const { stdout, exitCode } = await runCmd(['auth', 'logout', '--json']);
    expect(exitCode).toBe(0);
    expect(parseJsonOut<{ data: Record<string, unknown> }>(stdout).data).toMatchObject({ loggedOut: true });
    const after = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(after.profiles.default.token).toBeUndefined();
    expect(after.profiles.default.client_id).toBe('cid');
  });
});

describe('auth whoami', () => {
  it('调 myself 并输出，退出码 0', async () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', token: { access_token: 'tok' } } } }));
    sdkMocks.getMyself.mockResolvedValue({ id: 'u1', name: 'Alice', email: 'a@x.com' });
    const { stdout, exitCode } = await runCmd(['auth', 'whoami', '--json']);
    expect(exitCode).toBe(0);
    expect(sdkMocks.getMyself).toHaveBeenCalledTimes(1);
    expect(parseJsonOut<{ data: Record<string, unknown> }>(stdout).data).toMatchObject({ id: 'u1', name: 'Alice' });
  });

  it('未传 client 凭证时 token --grant user 缺 code → 退出码 2', async () => {
    fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', client_id: 'cid', client_secret: 'cs' } } }));
    // Commander 的 requiredOption 校验失败走 exitOverride(usage) → 非 ExitSignal，runCmd 映射为 1 或抛出
    const { exitCode } = await runCmd(['auth', 'token', '--grant', 'user', '--client-id', 'cid', '--client-secret', 'cs']);
    // 缺 --code → handler 抛 CliError(ARGS) → runHandler → ExitSignal(2)
    expect(exitCode).toBe(2);
  });
});

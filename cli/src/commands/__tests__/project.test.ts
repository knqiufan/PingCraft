import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCmd, parseJsonOut } from '../../../tests/cmd-driver.js';
import { CliError, ExitCode, ErrorCode } from '../../core/errors.js';

const m = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  members: vi.fn(),
}));
vi.mock('../../sdk/index.js', () => {
  const stub = () => {
    const cache = new Map<string, ReturnType<typeof vi.fn>>();
    return new Proxy({}, { get: (_t, key) => {
      if (typeof key !== 'string') return undefined;
      if (!cache.has(key)) cache.set(key, vi.fn(async () => ({ values: [], total: 0 })));
      return cache.get(key);
    } });
  };
  return {
    createClient: vi.fn(() => ({ axios: {}, get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn(), postForm: vi.fn() })),
    createAuthModule: vi.fn(() => stub()),
    createProjectsModule: vi.fn(() => m),
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

function tmpFile() {
  return path.join(os.tmpdir(), `pingcode-cmd-proj-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}
let file: string;
beforeEach(() => {
  file = tmpFile();
  process.env.PINGCODE_CONFIG_FILE = file;
  fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', token: { access_token: 'tok' } } } }));
  m.list.mockReset();
  m.get.mockReset();
  m.create.mockReset();
  m.update.mockReset();
  m.remove.mockReset();
  m.members.mockReset();
});
afterEach(() => {
  delete process.env.PINGCODE_CONFIG_FILE;
  try {
    fs.unlinkSync(file);
  } catch {
    /* noop */
  }
});

describe('project list', () => {
  it('--json 输出成功包络', async () => {
    m.list.mockResolvedValue({ values: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], total: 2 });
    const { stdout, exitCode } = await runCmd(['project', 'list', '--json']);
    expect(exitCode).toBe(0);
    const parsed = parseJsonOut<{ data: unknown[]; pagination: unknown }>(stdout);
    expect(parsed.data).toHaveLength(2);
    expect(parsed.pagination).toBeDefined();
    expect(m.list).toHaveBeenCalled();
  });

  it('--quiet 仅输出 id', async () => {
    m.list.mockResolvedValue({ values: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }] });
    const { stdout, exitCode } = await runCmd(['project', 'list', '--quiet']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('p1\np2\n');
  });
});

describe('project create --dry-run', () => {
  it('打印请求体且不调用 create', async () => {
    const { stdout, exitCode } = await runCmd(['project', 'create', '--name', 'N', '--type', 'scrum', '--identifier', 'NID', '--dry-run', '--json']);
    expect(exitCode).toBe(0);
    expect(m.create).not.toHaveBeenCalled();
    expect(parseJsonOut<{ data: Record<string, unknown> }>(stdout).data).toMatchObject({ name: 'N', type: 'scrum', identifier: 'NID' });
  });

  it('--name 必填缺失 → Commander usage 错误', async () => {
    const { exitCode } = await runCmd(['project', 'create', '--dry-run']);
    // requiredOption 缺失 → CommanderError(commander.missingArgument) → runCmd 标记为 1（usage 错误）
    expect(exitCode).not.toBe(0);
  });
});

describe('project delete 错误退出码', () => {
  it('404 → 退出码 5（NOT_FOUND）', async () => {
    // 模拟 SDK 抛出带 response.status 的 axios 风格错误
    const notFoundErr = Object.assign(new Error('not found'), { response: { status: 404, data: { message: '项目不存在' } } });
    m.remove.mockRejectedValue(notFoundErr);
    const { stderr, exitCode } = await runCmd(['project', 'delete', 'p1', '--json']);
    expect(exitCode).toBe(ExitCode.NOT_FOUND);
    const errBody = JSON.parse(stderr.trim()).error;
    expect(errBody.code).toBe(ErrorCode.NOT_FOUND);
    expect(errBody.statusCode).toBe(404);
  });

  it('CliError 直接抛也能映射退出码', async () => {
    m.remove.mockRejectedValue(new CliError({ message: 'x', exitCode: ExitCode.FORBIDDEN, code: ErrorCode.FORBIDDEN }));
    const { exitCode } = await runCmd(['project', 'delete', 'p1']);
    expect(exitCode).toBe(ExitCode.FORBIDDEN);
  });
});

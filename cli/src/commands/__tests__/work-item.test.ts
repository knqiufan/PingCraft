import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCmd, parseJsonOut } from '../../../tests/cmd-driver.js';
import { ExitCode, ErrorCode } from '../../core/errors.js';

const m = vi.hoisted(() => ({
  list: vi.fn(),
  listAll: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
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
    createProjectsModule: vi.fn(() => stub()),
    createWorkItemsModule: vi.fn(() => m),
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
  return path.join(os.tmpdir(), `pingcode-cmd-wi-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}
let file: string;
beforeEach(() => {
  file = tmpFile();
  process.env.PINGCODE_CONFIG_FILE = file;
  fs.writeFileSync(file, JSON.stringify({ profiles: { default: { host: 'https://x', token: { access_token: 'tok' } } } }));
  m.list.mockReset();
  m.listAll.mockReset();
  m.get.mockReset();
  m.create.mockReset();
  m.update.mockReset();
  m.remove.mockReset();
});
afterEach(() => {
  delete process.env.PINGCODE_CONFIG_FILE;
  try {
    fs.unlinkSync(file);
  } catch {
    /* noop */
  }
});

describe('work-item list', () => {
  it('--all 走 listAll 自动分页', async () => {
    m.listAll.mockResolvedValue({ values: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }], total: 3, truncated: false });
    const { stdout, exitCode } = await runCmd(['work-item', 'list', '--project', 'p1', '--all', '--json']);
    expect(exitCode).toBe(0);
    expect(m.listAll).toHaveBeenCalled();
    const parsed = parseJsonOut<{ data: unknown[]; pagination: { total: number } }>(stdout);
    expect(parsed.data).toHaveLength(3);
    expect(parsed.pagination.total).toBe(3);
  });

  it('单页走 list', async () => {
    m.list.mockResolvedValue({ values: [{ id: 'w1' }], total: 1 });
    const { stdout, exitCode } = await runCmd(['work-item', 'list', '--project', 'p1', '--json']);
    expect(exitCode).toBe(0);
    expect(m.list).toHaveBeenCalled();
    expect(parseJsonOut<{ data: unknown[] }>(stdout).data).toHaveLength(1);
  });
});

describe('work-item create', () => {
  it('--dry-run 打印请求体，含 start_at 时间戳', async () => {
    const { stdout, exitCode } = await runCmd([
      'work-item', 'create', '--project', 'p1', '--type', 't1', '--title', 'T',
      '--start-at', '2026-01-01', '--priority', 'pri1', '--dry-run', '--json',
    ]);
    expect(exitCode).toBe(0);
    expect(m.create).not.toHaveBeenCalled();
    const data = parseJsonOut<{ data: Record<string, unknown> }>(stdout).data;
    expect(data).toMatchObject({ project_id: 'p1', type_id: 't1', title: 'T', priority_id: 'pri1' });
    expect(data.start_at).toBe(Math.floor(Date.parse('2026-01-01') / 1000));
  });

  it('实际创建调用 create', async () => {
    m.create.mockResolvedValue({ id: 'w9', title: 'T' });
    const { stdout, exitCode } = await runCmd(['work-item', 'create', '--project', 'p1', '--type', 't1', '--title', 'T', '--json']);
    expect(exitCode).toBe(0);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'p1', type_id: 't1', title: 'T' }));
    expect(parseJsonOut<{ data: { id: string } }>(stdout).data.id).toBe('w9');
  });
});

describe('work-item get 404 → 退出码 5', () => {
  it('404 → NOT_FOUND', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('nf'), { response: { status: 404, data: { message: '不存在' } } }));
    const { exitCode } = await runCmd(['work-item', 'get', 'w1', '--json']);
    expect(exitCode).toBe(ExitCode.NOT_FOUND);
  });

  it('401 → UNAUTHORIZED(3)', async () => {
    m.get.mockRejectedValue(Object.assign(new Error('unauth'), { response: { status: 401 } }));
    const { exitCode, stderr } = await runCmd(['work-item', 'get', 'w1', '--json']);
    expect(exitCode).toBe(ExitCode.UNAUTHORIZED);
    expect(JSON.parse(stderr.trim()).error.code).toBe(ErrorCode.UNAUTHORIZED);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCmd, parseJsonOut } from '../../../tests/cmd-driver.js';

const m = vi.hoisted(() => ({
  productsList: vi.fn(),
  testCasesBatch: vi.fn(),
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
    createProductsModule: vi.fn(() => ({ ...stub(), list: m.productsList })),
    createCustomersModule: vi.fn(() => stub()),
    createTicketsModule: vi.fn(() => stub()),
    createRequirementsModule: vi.fn(() => stub()),
    createTestLibraryModule: vi.fn(() => stub()),
    createTestCasesModule: vi.fn(() => ({ ...stub(), batchCreate: m.testCasesBatch })),
    createTestPlansModule: vi.fn(() => stub()),
    createTestExecutionsModule: vi.fn(() => stub()),
    createTestConfigModule: vi.fn(() => stub()),
  };
});

function tmpFile(data: unknown): string {
  const p = path.join(os.tmpdir(), `pc-testhub-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
}

let cfgFile: string;
beforeEach(() => {
  cfgFile = path.join(os.tmpdir(), `pc-testhub-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env.PINGCODE_CONFIG_FILE = cfgFile;
  fs.writeFileSync(cfgFile, JSON.stringify({ profiles: { default: { host: 'https://x', token: { access_token: 'tok' } } } }));
  m.productsList.mockReset();
  m.testCasesBatch.mockReset();
});
afterEach(() => {
  delete process.env.PINGCODE_CONFIG_FILE;
  try {
    fs.unlinkSync(cfgFile);
  } catch {
    /* noop */
  }
});

describe('product list', () => {
  it('--json 输出包络', async () => {
    m.productsList.mockResolvedValue({ values: [{ id: 'pd1', name: 'P' }], total: 1 });
    const { stdout, exitCode } = await runCmd(['product', 'list', '--json']);
    expect(exitCode).toBe(0);
    expect(m.productsList).toHaveBeenCalled();
    expect(parseJsonOut<{ data: unknown[] }>(stdout).data).toHaveLength(1);
  });
});

describe('test-case batch-create', () => {
  it('从 --file 批量创建并聚合', async () => {
    const file = tmpFile([{ name: 'C1' }, { name: 'C2' }]);
    m.testCasesBatch.mockResolvedValue({ success: 2, failed: 0, created: [], errors: [] });
    const { stdout, exitCode } = await runCmd(['test-case', 'batch-create', '--file', file, '--json']);
    expect(exitCode).toBe(0);
    expect(m.testCasesBatch).toHaveBeenCalledTimes(1);
    expect(parseJsonOut<{ data: { success: number } }>(stdout).data.success).toBe(2);
    fs.unlinkSync(file);
  });

  it('缺 --file → 退出码 2', async () => {
    const { exitCode } = await runCmd(['test-case', 'batch-create', '--json']);
    expect(exitCode).toBe(2);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCmd, parseJsonOut } from '../../../tests/cmd-driver.js';

const m = vi.hoisted(() => ({
  createBatch: vi.fn(),
  commentsList: vi.fn(),
  commentsAdd: vi.fn(),
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
    createWorkItemSubResourcesModule: vi.fn(() => ({
      comments: { list: m.commentsList, add: m.commentsAdd, remove: vi.fn() },
      attachments: { list: vi.fn(), upload: vi.fn() },
      watchers: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
      links: { list: vi.fn(), create: vi.fn() },
      history: vi.fn(),
      tags: { list: vi.fn(), add: vi.fn() },
      deliverables: vi.fn(),
      transition: vi.fn(),
    })),
    createWorkItemSchemeModule: vi.fn(() => ({ states: vi.fn(), properties: vi.fn(), types: vi.fn(), transitions: vi.fn(), linkTypes: vi.fn() })),
    createSprintsModule: vi.fn(() => ({
      list: vi.fn(async () => ({ values: [], total: 0 })),
      get: vi.fn(), create: vi.fn(), update: vi.fn(), groups: vi.fn(), categories: vi.fn(), workItems: vi.fn(),
      createBatch: m.createBatch,
    })),
    createReleasesModule: vi.fn(() => stub()),
    createKanbansModule: vi.fn(() => stub()),
    createWaterfallModule: vi.fn(() => stub()),
    createDirectoryModule: vi.fn(() => stub()),
    createCommonResourcesModule: vi.fn(() => stub()),
    createLogsModule: vi.fn(() => stub()),
    createWikiModule: vi.fn(() => stub()),
  };
});

function tmpFile(data: unknown): string {
  const p = path.join(os.tmpdir(), `pc-sprint-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
}

let cfgFile: string;
beforeEach(() => {
  cfgFile = path.join(os.tmpdir(), `pc-sprint-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env.PINGCODE_CONFIG_FILE = cfgFile;
  fs.writeFileSync(cfgFile, JSON.stringify({ profiles: { default: { host: 'https://x', token: { access_token: 'tok' } } } }));
  m.createBatch.mockReset();
  m.commentsList.mockReset();
  m.commentsAdd.mockReset();
});
afterEach(() => {
  delete process.env.PINGCODE_CONFIG_FILE;
  try {
    fs.unlinkSync(cfgFile);
  } catch {
    /* noop */
  }
});

describe('sprint create-batch', () => {
  it('从 --file 读取并批量创建，聚合结果', async () => {
    const file = tmpFile([{ name: 'S1' }, { name: 'S2' }]);
    m.createBatch.mockResolvedValue({ success: 2, failed: 0, created: [{ id: 'sp1' }, { id: 'sp2' }], errors: [] });
    const { stdout, exitCode } = await runCmd(['sprint', 'create-batch', '--project', 'p1', '--file', file, '--json']);
    expect(exitCode).toBe(0);
    expect(m.createBatch).toHaveBeenCalledTimes(1);
    // 传入的每条都带 project_id
    const arg = m.createBatch.mock.calls[0][0] as Array<{ project_id: string; name: string }>;
    expect(arg).toHaveLength(2);
    expect(arg.every((a) => a.project_id === 'p1')).toBe(true);
    expect(parseJsonOut<{ data: { success: number } }>(stdout).data.success).toBe(2);
    fs.unlinkSync(file);
  });

  it('缺 --file/--stdin → 退出码 2', async () => {
    const { exitCode } = await runCmd(['sprint', 'create-batch', '--project', 'p1', '--json']);
    expect(exitCode).toBe(2);
  });
});

describe('work-item comment（子资源三级命令）', () => {
  it('comment list', async () => {
    m.commentsList.mockResolvedValue({ values: [{ id: 'c1', content: 'hi' }], total: 1 });
    const { stdout, exitCode } = await runCmd(['work-item', 'comment', 'list', 'w1', '--json']);
    expect(exitCode).toBe(0);
    expect(m.commentsList).toHaveBeenCalledWith('w1');
    expect(parseJsonOut<{ data: unknown[] }>(stdout).data).toHaveLength(1);
  });

  it('comment add --content', async () => {
    m.commentsAdd.mockResolvedValue({ id: 'c2', content: 'ok' });
    const { stdout, exitCode } = await runCmd(['work-item', 'comment', 'add', 'w1', '--content', 'ok', '--json']);
    expect(exitCode).toBe(0);
    expect(m.commentsAdd).toHaveBeenCalledWith('w1', 'ok');
    expect(parseJsonOut<{ data: { id: string } }>(stdout).data.id).toBe('c2');
  });
});

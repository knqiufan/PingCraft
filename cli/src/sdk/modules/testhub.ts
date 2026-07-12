/**
 * 测试管理 Testhub 模块集合（L2 sdk）。
 *
 * test-library（+成员/模块）、test-case（+批量/模块/属性/状态/类型/历史/关联工作项）、
 * test-plan（+类型）、test-execution（创建/批量/结果）、test-config。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';
import { extractList, type Id } from '../types.js';
import { runWithConcurrency } from '../concurrency.js';

export interface TestLibrary {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface TestCase {
  id?: Id;
  name?: string;
  library_id?: Id;
  [k: string]: unknown;
}
export interface TestPlan {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface TestExecution {
  id?: Id;
  [k: string]: unknown;
}

const metaList = (client: PingCodeClient) => async (path: string) => extractList<unknown>((await client.get(path)) as never);

export function createTestLibraryModule(client: PingCodeClient) {
  const crud = createCrud<TestLibrary>(client, '/testhub/libraries');
  return {
    ...crud,
    async members(id: Id) {
      const data = await client.get(`/testhub/libraries/${encodeURIComponent(id)}/members`);
      return Array.isArray(data) ? data : (extractList<unknown>(data as never).values);
    },
    async modules(id: Id) {
      const data = await client.get(`/testhub/libraries/${encodeURIComponent(id)}/modules`);
      return Array.isArray(data) ? data : (extractList<unknown>(data as never).values);
    },
  };
}

export function createTestCasesModule(client: PingCodeClient) {
  const crud = createCrud<TestCase>(client, '/testhub/cases');
  const list = metaList(client);
  return {
    ...crud,
    /** 批量创建用例（并发 + 部分失败聚合） */
    async batchCreate(items: Array<Record<string, unknown>>, opts: { concurrency?: number; onProgress?: (current: number, total: number, status: 'success' | 'failed') => void } = {}): Promise<{ success: number; failed: number; created: unknown[]; errors: unknown[] }> {
      const concurrency = Math.max(1, opts.concurrency ?? 3);
      const total = items.length;
      let completed = 0;
      const result = { success: 0, failed: 0, created: [] as unknown[], errors: [] as unknown[] };
      const tasks = items.map((item) => async () => {
        try {
          const created = await client.post<TestCase>('/testhub/cases', item);
          result.success++;
          result.created.push(created);
        } catch (e) {
          result.failed++;
          result.errors.push({ item, error: e instanceof Error ? e.message : String(e) });
        }
        opts.onProgress?.(++completed, total, completed <= result.success ? 'success' : 'failed');
      });
      await runWithConcurrency(tasks, concurrency);
      return result;
    },
    async history(id: Id) {
      return list(`/testhub/cases/${encodeURIComponent(id)}/history`);
    },
    async linkWorkItem(id: Id, workItemId: Id) {
      return client.post(`/testhub/cases/${encodeURIComponent(id)}/work_items`, { work_item_id: workItemId });
    },
    async unlinkWorkItem(id: Id, workItemId: Id) {
      await client.delete(`/testhub/cases/${encodeURIComponent(id)}/work_items/${encodeURIComponent(workItemId)}`);
    },
    async modules() {
      return list('/testhub/case/modules');
    },
    async states() {
      return list('/testhub/case/states');
    },
    async types() {
      return list('/testhub/case/types');
    },
    async properties() {
      return list('/testhub/case/properties');
    },
  };
}

export function createTestPlansModule(client: PingCodeClient) {
  const crud = createCrud<TestPlan>(client, '/testhub/plans');
  return {
    ...crud,
    async types() {
      return metaList(client)('/testhub/plan/types');
    },
  };
}

export function createTestExecutionsModule(client: PingCodeClient) {
  return {
    async create(body: Record<string, unknown>): Promise<TestExecution> {
      return client.post<TestExecution>('/testhub/executions', body);
    },
    async batchCreate(items: Array<Record<string, unknown>>, opts: { concurrency?: number; onProgress?: (current: number, total: number, status: 'success' | 'failed') => void } = {}): Promise<{ success: number; failed: number; created: unknown[]; errors: unknown[] }> {
      const concurrency = Math.max(1, opts.concurrency ?? 3);
      const total = items.length;
      let completed = 0;
      const result = { success: 0, failed: 0, created: [] as unknown[], errors: [] as unknown[] };
      const tasks = items.map((item) => async () => {
        try {
          result.created.push(await client.post('/testhub/executions', item));
          result.success++;
          opts.onProgress?.(++completed, total, 'success');
        } catch (e) {
          result.failed++;
          result.errors.push({ item, error: e instanceof Error ? e.message : String(e) });
          opts.onProgress?.(++completed, total, 'failed');
        }
      });
      await runWithConcurrency(tasks, concurrency);
      return result;
    },
    async update(id: Id, body: Record<string, unknown>): Promise<TestExecution> {
      return client.patch<TestExecution>(`/testhub/executions/${encodeURIComponent(id)}`, body);
    },
    async list(params: Record<string, unknown> = {}) {
      return extractList<TestExecution>((await client.get('/testhub/executions', { params })) as never);
    },
    async result(id: Id) {
      return client.get(`/testhub/executions/${encodeURIComponent(id)}/result`);
    },
  };
}

export function createTestConfigModule(client: PingCodeClient) {
  const list = metaList(client);
  return {
    caseStates: () => list('/testhub/config/case/states'),
    caseTypes: () => list('/testhub/config/case/types'),
    severities: () => list('/testhub/config/case/severities'),
    caseProperties: () => list('/testhub/config/case/properties'),
    planStates: () => list('/testhub/config/plan/states'),
  };
}

export type TestLibraryModule = ReturnType<typeof createTestLibraryModule>;
export type TestCasesModule = ReturnType<typeof createTestCasesModule>;
export type TestPlansModule = ReturnType<typeof createTestPlansModule>;
export type TestExecutionsModule = ReturnType<typeof createTestExecutionsModule>;
export type TestConfigModule = ReturnType<typeof createTestConfigModule>;

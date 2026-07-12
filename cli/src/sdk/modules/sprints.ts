/**
 * Scrum 迭代模块（L2 sdk）。
 *
 * 路径：`/project/sprints`（CRUD）+ `/project/sprints/{id}/work_items` + `/project/sprint_groups` + `/project/sprint_categories`。
 * createBatch 用 runWithConcurrency（并发 + onProgress，复刻 workItems.batchCreate 模式）。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';
import { runWithConcurrency } from '../concurrency.js';

export interface Sprint {
  id?: Id;
  name?: string;
  project_id?: Id;
  start_at?: number;
  end_at?: number;
  goal?: string;
  status?: string;
  [k: string]: unknown;
}

export interface CreateSprintBody {
  project_id: Id;
  name: string;
  start_at?: number;
  end_at?: number;
  goal?: string;
  [k: string]: unknown;
}
export type UpdateSprintBody = Partial<CreateSprintBody>;
export interface BatchCreateItem extends CreateSprintBody {
  _local_id?: string | number;
}
export interface BatchCreateResult {
  success: number;
  failed: number;
  created: Array<{ local_id?: string | number; id?: Id; name?: string }>;
  errors: Array<{ local_id?: string | number; item?: string; error?: string }>;
}

export function createSprintsModule(client: PingCodeClient) {
  return {
    async list(params: PageParams & { projectId: Id }) {
      const data = await client.get('/project/sprints', { params: { project_id: params.projectId, page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<Sprint>(data as never);
    },
    async get(id: Id): Promise<Sprint> {
      return client.get<Sprint>(`/project/sprints/${encodeURIComponent(id)}`);
    },
    async create(body: CreateSprintBody): Promise<Sprint> {
      return client.post<Sprint>('/project/sprints', body);
    },
    async update(id: Id, body: UpdateSprintBody): Promise<Sprint> {
      return client.patch<Sprint>(`/project/sprints/${encodeURIComponent(id)}`, body);
    },
    async groups(projectId: Id) {
      const data = await client.get('/project/sprint_groups', { params: { project_id: projectId } });
      return extractList<unknown>(data as never);
    },
    async categories() {
      const data = await client.get('/project/sprint_categories');
      return extractList<unknown>(data as never);
    },
    async workItems(id: Id) {
      const data = await client.get(`/project/sprints/${encodeURIComponent(id)}/work_items`);
      return extractList<unknown>(data as never);
    },
    /** 批量创建（有限并发 + 进度回调） */
    async createBatch(items: BatchCreateItem[], opts: { concurrency?: number; onProgress?: (current: number, total: number, status: 'success' | 'failed', item?: BatchCreateItem) => void } = {}): Promise<BatchCreateResult> {
      const concurrency = Math.max(1, opts.concurrency ?? 3);
      const result: BatchCreateResult = { success: 0, failed: 0, created: [], errors: [] };
      const total = items.length;
      let completed = 0;
      const tasks = items.map((item) => async () => {
        const localId = item._local_id;
        const { _local_id, ...body } = item;
        void _local_id;
        try {
          const created = await client.post<Sprint>('/project/sprints', body);
          result.success++;
          result.created.push({ local_id: localId, id: created?.id, name: body.name });
          opts.onProgress?.(++completed, total, 'success', item);
        } catch (e) {
          const msg = e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : String(e);
          result.failed++;
          result.errors.push({ local_id: localId, item: body.name, error: msg });
          opts.onProgress?.(++completed, total, 'failed', item);
        }
      });
      await runWithConcurrency(tasks, concurrency);
      return result;
    },
  };
}

export type SprintsModule = ReturnType<typeof createSprintsModule>;

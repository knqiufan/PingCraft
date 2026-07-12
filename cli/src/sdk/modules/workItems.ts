/**
 * 工作项模块（L2 sdk）。
 *
 * 对照后端 getWorkItems/getWorkItemDetail/updateWorkItem/createWorkItemsBatch：
 *  - 列表 GET /project/work_items?project_id&page_size&page_index（支持过滤）
 *  - 详情 GET /project/work_items/{id}
 *  - 创建 POST /project/work_items
 *  - 更新 PATCH /project/work_items/{id}
 *  - 删除 DELETE /project/work_items/{id}
 *
 * `listAll` 使用 `core/pagination.paginate` 自动分页（阶段 1 §3.2 显式约定）。
 * 注：pagination 为纯工具（无 IO/输出格式依赖），Phase 3 抽包时随 SDK 一并迁移。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';
// biome-ignore lint/correctness/noUnusedImports: 分页工具跨层引用（见模块注释）
import { paginate } from '../../core/pagination.js';
import { runWithConcurrency } from '../concurrency.js';

/** 工作项资源 */
export interface WorkItem {
  id?: Id;
  identifier?: string;
  name?: string;
  title?: string;
  project_id?: Id;
  work_item_type_id?: Id;
  work_item_type_name?: string;
  state_id?: Id;
  priority_id?: Id;
  assignee_id?: Id;
  sprint_id?: Id;
  parent_id?: Id;
  created_at?: number;
  updated_at?: number;
  [k: string]: unknown;
}

export interface WorkItemListParams extends PageParams {
  projectId: Id;
  typeId?: Id;
  stateId?: Id;
  assigneeId?: Id;
  /** 关键字搜索 */
  q?: string;
}

/** 创建工作项请求体（type_id 必填） */
export interface CreateWorkItemBody {
  project_id: Id;
  type_id: Id;
  name?: string;
  title?: string;
  description?: string;
  priority_id?: Id;
  assignee_id?: Id;
  sprint_id?: Id;
  start_at?: number;
  end_at?: number;
  estimated_workload?: number;
  properties?: Record<string, unknown>;
  [k: string]: unknown;
}

export type UpdateWorkItemBody = Partial<CreateWorkItemBody>;

/** 批量创建的单条（可带 _local_id 以便追溯） */
export interface BatchCreateItem extends CreateWorkItemBody {
  _local_id?: string | number;
}

export interface BatchProgressItem {
  title?: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface BatchCreateResult {
  success: number;
  failed: number;
  created: Array<{ local_id?: string | number; pingcode_id?: Id; pingcode_identifier?: string; title?: string }>;
  errors: Array<{ local_id?: string | number; item?: string; error?: string }>;
}

export interface BatchCreateOptions {
  concurrency?: number;
  onProgress?: (current: number, total: number, item: BatchProgressItem) => void;
}

/** 把过滤参数映射为 PingCode query */
function listQuery(params: WorkItemListParams, pageIndex: number, pageSize: number): Record<string, unknown> {
  const q: Record<string, unknown> = {
    project_id: params.projectId,
    page_index: pageIndex,
    page_size: pageSize,
  };
  if (params.typeId) q.work_item_type_id = params.typeId;
  if (params.stateId) q.state_id = params.stateId;
  if (params.assigneeId) q.assignee_id = params.assigneeId;
  if (params.q) q.q = params.q;
  return q;
}

export function createWorkItemsModule(client: PingCodeClient) {
  return {
    /** 工作项列表（单页） */
    async list(params: WorkItemListParams) {
      const data = await client.get('/project/work_items', {
        params: listQuery(params, params.pageIndex ?? 0, params.pageSize ?? 100),
      });
      return extractList<WorkItem>(data as never);
    },

    /** 工作项列表（自动分页拉全量） */
    async listAll(params: Omit<WorkItemListParams, 'pageIndex' | 'pageSize'> & { pageSize?: number; maxPages?: number }) {
      const result = await paginate<WorkItem>(
        async (pageIndex, pageSize) => {
          const data = await client.get('/project/work_items', { params: listQuery(params, pageIndex, pageSize) });
          return extractList<WorkItem>(data as never);
        },
        { pageSize: params.pageSize ?? 100, maxPages: params.maxPages },
      );
      return result;
    },

    /** 工作项详情 */
    async get(id: Id): Promise<WorkItem> {
      return client.get<WorkItem>(`/project/work_items/${encodeURIComponent(id)}`);
    },

    /** 创建工作项 */
    async create(body: CreateWorkItemBody): Promise<WorkItem> {
      return client.post<WorkItem>('/project/work_items', body);
    },

    /** 更新工作项 */
    async update(id: Id, body: UpdateWorkItemBody): Promise<WorkItem> {
      return client.patch<WorkItem>(`/project/work_items/${encodeURIComponent(id)}`, body);
    },

    /** 删除工作项 */
    async remove(id: Id): Promise<void> {
      await client.delete(`/project/work_items/${encodeURIComponent(id)}`);
    },

    /**
     * 批量更新工作项（有限并发 + onProgress + 部分失败聚合）。
     * 每条形如 { id, ...fields }，按 id 逐条 PATCH。
     */
    async batchUpdate(items: Array<UpdateWorkItemBody & { id: Id }>, opts: { concurrency?: number; onProgress?: (current: number, total: number, status: 'success' | 'failed', item?: { id: Id }) => void } = {}): Promise<{ success: number; failed: number; updated: Id[]; errors: Array<{ id?: Id; error?: string }> }> {
      const concurrency = Math.max(1, opts.concurrency ?? 3);
      const total = items.length;
      let completed = 0;
      const result = { success: 0, failed: 0, updated: [] as Id[], errors: [] as Array<{ id?: Id; error?: string }> };
      const tasks = items.map((item) => async () => {
        const { id, ...body } = item;
        try {
          await client.patch(`/project/work_items/${encodeURIComponent(id)}`, body);
          result.success++;
          result.updated.push(id);
          opts.onProgress?.(++completed, total, 'success', { id });
        } catch (e) {
          const msg = e && typeof e === 'object' && 'message' in e ? (e as { message: string }).message : String(e);
          result.failed++;
          result.errors.push({ id, error: msg });
          opts.onProgress?.(++completed, total, 'failed', { id });
        }
      });
      await runWithConcurrency(tasks, concurrency);
      return result;
    },

    /**
     * 批量创建工作项（有限并发 + onProgress 回调）。
     * 复刻后端 createWorkItemsBatch：每条独立 try/catch，单条失败不中断整体。
     */
    async batchCreate(items: BatchCreateItem[], opts: BatchCreateOptions = {}): Promise<BatchCreateResult> {
      const concurrency = Math.max(1, opts.concurrency ?? 3);
      const result: BatchCreateResult = { success: 0, failed: 0, created: [], errors: [] };
      const total = items.length;
      let completed = 0;

      const tasks = items.map((item) => async () => {
        const localId = item._local_id;
        const { _local_id, ...body } = item;
        void _local_id;
        const title = (body.title ?? body.name) as string | undefined;

        try {
          const created = await client.post<WorkItem>('/project/work_items', body);
          result.success++;
          result.created.push({
            local_id: localId,
            pingcode_id: created?.id,
            pingcode_identifier: created?.identifier,
            title,
          });
          if (opts.onProgress) opts.onProgress(++completed, total, { title, status: 'success' });
        } catch (e) {
          const errorDetail = extractErrorMessage(e);
          result.failed++;
          result.errors.push({ local_id: localId, item: title, error: errorDetail });
          if (opts.onProgress) opts.onProgress(++completed, total, { title, status: 'failed', error: errorDetail });
        }
      });

      await runWithConcurrency(tasks, concurrency);
      return result;
    },
  };
}

function extractErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as { response?: { data?: unknown }; message?: string };
  const data = e.response?.data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.msg;
    if (typeof msg === 'string') return msg;
  }
  return e.message ?? String(err);
}

export type WorkItemsModule = ReturnType<typeof createWorkItemsModule>;

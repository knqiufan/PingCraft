/**
 * 看板 Kanban 模块（L2 sdk）。
 *
 * 路径：`/project/kanbans`（看板 CRUD）+ `/project/kanbans/{id}/columns`（栏）+ `/project/kanbans/{id}/swimlanes`（泳道）。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

export interface Kanban {
  id?: Id;
  name?: string;
  project_id?: Id;
  [k: string]: unknown;
}
export interface KanbanColumn {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface KanbanSwimlane {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}

export function createKanbansModule(client: PingCodeClient) {
  return {
    async list(params: PageParams & { projectId: Id }) {
      const data = await client.get('/project/kanbans', { params: { project_id: params.projectId, page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<Kanban>(data as never);
    },
    async get(id: Id): Promise<Kanban> {
      return client.get<Kanban>(`/project/kanbans/${encodeURIComponent(id)}`);
    },
    async create(body: { project_id: Id; name: string }): Promise<Kanban> {
      return client.post<Kanban>('/project/kanbans', body);
    },
    // ---- 栏 ----
    async columns(id: Id) {
      const data = await client.get(`/project/kanbans/${encodeURIComponent(id)}/columns`);
      return extractList<KanbanColumn>(data as never);
    },
    async createColumn(id: Id, body: { name: string }) {
      return client.post<KanbanColumn>(`/project/kanbans/${encodeURIComponent(id)}/columns`, body);
    },
    async updateColumn(kanbanId: Id, columnId: Id, body: Partial<{ name: string }>) {
      return client.patch<KanbanColumn>(`/project/kanbans/${encodeURIComponent(kanbanId)}/columns/${encodeURIComponent(columnId)}`, body);
    },
    async deleteColumn(kanbanId: Id, columnId: Id) {
      await client.delete(`/project/kanbans/${encodeURIComponent(kanbanId)}/columns/${encodeURIComponent(columnId)}`);
    },
    // ---- 泳道 ----
    async swimlanes(id: Id) {
      const data = await client.get(`/project/kanbans/${encodeURIComponent(id)}/swimlanes`);
      return extractList<KanbanSwimlane>(data as never);
    },
    async createSwimlane(id: Id, body: { name: string }) {
      return client.post<KanbanSwimlane>(`/project/kanbans/${encodeURIComponent(id)}/swimlanes`, body);
    },
    async deleteSwimlane(kanbanId: Id, swimlaneId: Id) {
      await client.delete(`/project/kanbans/${encodeURIComponent(kanbanId)}/swimlanes/${encodeURIComponent(swimlaneId)}`);
    },
  };
}

export type KanbansModule = ReturnType<typeof createKanbansModule>;

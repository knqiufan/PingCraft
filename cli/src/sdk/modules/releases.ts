/**
 * 发布 Release 模块（L2 sdk）。
 *
 * 路径：`/project/releases`（CRUD）+ `/project/releases/{id}/stages` + `/project/release_groups` + `/project/release_categories`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

export interface Release {
  id?: Id;
  name?: string;
  project_id?: Id;
  start_at?: number;
  end_at?: number;
  [k: string]: unknown;
}
export interface CreateReleaseBody {
  project_id: Id;
  name: string;
  start_at?: number;
  end_at?: number;
  [k: string]: unknown;
}
export type UpdateReleaseBody = Partial<CreateReleaseBody>;

export function createReleasesModule(client: PingCodeClient) {
  return {
    async list(params: PageParams & { projectId: Id }) {
      const data = await client.get('/project/releases', { params: { project_id: params.projectId, page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<Release>(data as never);
    },
    async get(id: Id): Promise<Release> {
      return client.get<Release>(`/project/releases/${encodeURIComponent(id)}`);
    },
    async create(body: CreateReleaseBody): Promise<Release> {
      return client.post<Release>('/project/releases', body);
    },
    async update(id: Id, body: UpdateReleaseBody): Promise<Release> {
      return client.patch<Release>(`/project/releases/${encodeURIComponent(id)}`, body);
    },
    async remove(id: Id): Promise<void> {
      await client.delete(`/project/releases/${encodeURIComponent(id)}`);
    },
    async stages(id: Id) {
      const data = await client.get(`/project/releases/${encodeURIComponent(id)}/stages`);
      return extractList<unknown>(data as never);
    },
    async groups() {
      const data = await client.get('/project/release_groups');
      return extractList<unknown>(data as never);
    },
    async categories() {
      const data = await client.get('/project/release_categories');
      return extractList<unknown>(data as never);
    },
  };
}

export type ReleasesModule = ReturnType<typeof createReleasesModule>;

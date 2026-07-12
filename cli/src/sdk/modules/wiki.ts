/**
 * Wiki 知识库模块（L2 sdk）。
 *
 * space（CRUD + 成员）+ page（CRUD + body get/update + versions + restore）。
 * 路径：`/wiki/spaces`、`/wiki/spaces/{id}`、`/wiki/pages`、`/wiki/pages/{id}`、
 * `/wiki/pages/{id}/body`、`/wiki/pages/{id}/versions`、`/wiki/pages/{id}/versions/{vid}/restore`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

export interface WikiSpace {
  id?: Id;
  name?: string;
  description?: string;
  visibility?: string;
  [k: string]: unknown;
}
export interface WikiPage {
  id?: Id;
  space_id?: Id;
  parent_id?: Id;
  title?: string;
  slug?: string;
  [k: string]: unknown;
}
export interface WikiPageVersion {
  id?: Id;
  version?: number;
  [k: string]: unknown;
}

export function createWikiModule(client: PingCodeClient) {
  return {
    // ---- 空间 ----
    spaces: {
      async list(params: PageParams = {}) {
        const data = await client.get('/wiki/spaces', { params: { page_index: params.pageIndex, page_size: params.pageSize } });
        return extractList<WikiSpace>(data as never);
      },
      async get(id: Id): Promise<WikiSpace> {
        return client.get<WikiSpace>(`/wiki/spaces/${encodeURIComponent(id)}`);
      },
      async create(body: { name: string; description?: string }): Promise<WikiSpace> {
        return client.post<WikiSpace>('/wiki/spaces', body);
      },
      async update(id: Id, body: Partial<{ name: string; description: string }>): Promise<WikiSpace> {
        return client.patch<WikiSpace>(`/wiki/spaces/${encodeURIComponent(id)}`, body);
      },
      async remove(id: Id): Promise<void> {
        await client.delete(`/wiki/spaces/${encodeURIComponent(id)}`);
      },
      async members(id: Id) {
        const data = await client.get(`/wiki/spaces/${encodeURIComponent(id)}/members`);
        return extractList<unknown>(data as never);
      },
    },
    // ---- 页面 ----
    pages: {
      async list(params: PageParams & { spaceId?: Id }) {
        const data = await client.get('/wiki/pages', { params: { space_id: params.spaceId, page_index: params.pageIndex, page_size: params.pageSize } });
        return extractList<WikiPage>(data as never);
      },
      async get(id: Id): Promise<WikiPage> {
        return client.get<WikiPage>(`/wiki/pages/${encodeURIComponent(id)}`);
      },
      async create(body: { space_id: Id; title: string; parent_id?: Id }): Promise<WikiPage> {
        return client.post<WikiPage>('/wiki/pages', body);
      },
      async update(id: Id, body: Partial<{ title: string; parent_id: Id }>): Promise<WikiPage> {
        return client.patch<WikiPage>(`/wiki/pages/${encodeURIComponent(id)}`, body);
      },
      async remove(id: Id): Promise<void> {
        await client.delete(`/wiki/pages/${encodeURIComponent(id)}`);
      },
      // ---- 正文 ----
      body: {
        async get(id: Id): Promise<string> {
          // body 可能返回纯文本或 HTML，统一按 text 读取
          const res = await client.get<{ content?: string } | string>(`/wiki/pages/${encodeURIComponent(id)}/body`, { responseType: 'text' });
          return typeof res === 'string' ? res : (res?.content ?? '');
        },
        async update(id: Id, content: string): Promise<WikiPage> {
          return client.put<WikiPage>(`/wiki/pages/${encodeURIComponent(id)}/body`, { content });
        },
      },
      // ---- 版本 ----
      async versions(id: Id) {
        const data = await client.get(`/wiki/pages/${encodeURIComponent(id)}/versions`);
        return extractList<WikiPageVersion>(data as never);
      },
      async restore(id: Id, versionId: Id): Promise<WikiPage> {
        return client.post<WikiPage>(`/wiki/pages/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`);
      },
    },
  };
}

export type WikiModule = ReturnType<typeof createWikiModule>;

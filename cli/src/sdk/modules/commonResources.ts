/**
 * 全局通用资源（L2 sdk）。
 *
 * 评论/附件/关注/关联/活动/工时/评审 等以 principal（type+id）为锚的通用资源。
 * 路径：`/comments|/attachments|/watchers|/associations|/activities|/worklogs|/worklog_types|/reviews`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id } from '../types.js';

export interface Principal {
  principal_type: string;
  principal_id: Id;
  [k: string]: unknown;
}

export interface CommonComment {
  id?: Id;
  content?: string;
  [k: string]: unknown;
}
export interface CommonAttachment {
  id?: Id;
  name?: string;
  size?: number;
  url?: string;
  [k: string]: unknown;
}
export interface Worklog {
  id?: Id;
  [k: string]: unknown;
}
export interface Review {
  id?: Id;
  [k: string]: unknown;
}

export function createCommonResourcesModule(client: PingCodeClient) {
  return {
    // ---- 评论 ----
    comments: {
      async list(principal: Principal) {
        const data = await client.get('/comments', { params: principal });
        return extractList<CommonComment>(data as never);
      },
      async create(body: Principal & { content: string }) {
        return client.post<CommonComment>('/comments', body);
      },
      async get(id: Id) {
        return client.get<CommonComment>(`/comments/${encodeURIComponent(id)}`);
      },
      async remove(id: Id) {
        await client.delete(`/comments/${encodeURIComponent(id)}`);
      },
    },
    // ---- 附件 ----
    attachments: {
      async list(principal: Principal) {
        const data = await client.get('/attachments', { params: principal });
        return extractList<CommonAttachment>(data as never);
      },
      async upload(formData: FormData) {
        return client.postForm<CommonAttachment>('/attachments', formData);
      },
      async get(id: Id) {
        return client.get<CommonAttachment>(`/attachments/${encodeURIComponent(id)}`);
      },
      async remove(id: Id) {
        await client.delete(`/attachments/${encodeURIComponent(id)}`);
      },
      /** 代码段 */
      async snippet(body: { name: string; language: string; content: string }) {
        return client.post<CommonAttachment>('/attachments/snippet', body);
      },
    },
    // ---- 关注人 ----
    watchers: {
      async list(principal: Principal) {
        const data = await client.get('/watchers', { params: principal });
        return extractList<{ user_id?: Id }>(data as never);
      },
      async add(body: Principal & { user_id: Id }) {
        return client.post('/watchers', body);
      },
      async remove(id: Id) {
        await client.delete(`/watchers/${encodeURIComponent(id)}`);
      },
    },
    // ---- 关联 ----
    associations: {
      async list(principal: Principal) {
        const data = await client.get('/associations', { params: principal });
        return extractList<unknown>(data as never);
      },
      async create(body: Record<string, unknown>) {
        return client.post('/associations', body);
      },
      async get(id: Id) {
        return client.get(`/associations/${encodeURIComponent(id)}`);
      },
      async remove(id: Id) {
        await client.delete(`/associations/${encodeURIComponent(id)}`);
      },
    },
    // ---- 活动记录 ----
    async activities(principal: Principal) {
      const data = await client.get('/activities', { params: principal });
      return extractList<unknown>(data as never);
    },
    // ---- 工时 ----
    worklogs: {
      async list(principal: Principal) {
        const data = await client.get('/worklogs', { params: principal });
        return extractList<Worklog>(data as never);
      },
      async create(body: Record<string, unknown>) {
        return client.post<Worklog>('/worklogs', body);
      },
      async get(id: Id) {
        return client.get<Worklog>(`/worklogs/${encodeURIComponent(id)}`);
      },
      async update(id: Id, body: Record<string, unknown>) {
        return client.patch<Worklog>(`/worklogs/${encodeURIComponent(id)}`, body);
      },
      async remove(id: Id) {
        await client.delete(`/worklogs/${encodeURIComponent(id)}`);
      },
    },
    async worklogTypes() {
      const data = await client.get('/worklog_types');
      return extractList<{ id?: Id; name?: string }>(data as never);
    },
    // ---- 评审 ----
    reviews: {
      async list(principal: Principal) {
        const data = await client.get('/reviews', { params: principal });
        return extractList<Review>(data as never);
      },
      async create(body: Record<string, unknown>) {
        return client.post<Review>('/reviews', body);
      },
      async remove(id: Id) {
        await client.delete(`/reviews/${encodeURIComponent(id)}`);
      },
    },
  };
}

export type CommonResourcesModule = ReturnType<typeof createCommonResourcesModule>;

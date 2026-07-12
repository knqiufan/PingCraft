/**
 * 工作项子资源模块（L2 sdk）。
 *
 * comment / attachment / watcher / link / history(activity) / tag / deliverables / transition。
 * 路径：`/project/work_items/{id}/<sub>`（transition 复用工作项 PATCH）。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id } from '../types.js';

export interface Comment {
  id?: Id;
  content?: string;
  user_id?: Id;
  created_at?: number;
  [k: string]: unknown;
}
export interface Attachment {
  id?: Id;
  name?: string;
  size?: number;
  url?: string;
  [k: string]: unknown;
}
export interface Watcher {
  user_id?: Id;
  [k: string]: unknown;
}
export interface WorkItemLink {
  id?: Id;
  target_id?: Id;
  link_type_id?: Id;
  [k: string]: unknown;
}
export interface Activity {
  id?: Id;
  type?: string;
  created_at?: number;
  [k: string]: unknown;
}
export interface Tag {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}

export function createWorkItemSubResourcesModule(client: PingCodeClient) {
  const base = (id: Id) => `/project/work_items/${encodeURIComponent(id)}`;
  return {
    // ---- 评论 ----
    comments: {
      async list(workItemId: Id) {
        const data = await client.get(`${base(workItemId)}/comments`);
        return extractList<Comment>(data as never);
      },
      async add(workItemId: Id, content: string) {
        return client.post<Comment>(`${base(workItemId)}/comments`, { content });
      },
      async remove(workItemId: Id, commentId: Id) {
        await client.delete(`${base(workItemId)}/comments/${encodeURIComponent(commentId)}`);
      },
    },
    // ---- 附件 ----
    attachments: {
      async list(workItemId: Id) {
        const data = await client.get(`${base(workItemId)}/attachments`);
        return extractList<Attachment>(data as never);
      },
      async upload(workItemId: Id, formData: FormData) {
        return client.postForm<Attachment>(`${base(workItemId)}/attachments`, formData);
      },
    },
    // ---- 关注人 ----
    watchers: {
      async list(workItemId: Id) {
        const data = await client.get(`${base(workItemId)}/watchers`);
        return extractList<Watcher>(data as never);
      },
      async add(workItemId: Id, userId: Id) {
        return client.post(`${base(workItemId)}/watchers`, { user_id: userId });
      },
      async remove(workItemId: Id, userId: Id) {
        await client.delete(`${base(workItemId)}/watchers/${encodeURIComponent(userId)}`);
      },
    },
    // ---- 关联 ----
    links: {
      async list(workItemId: Id) {
        const data = await client.get(`${base(workItemId)}/links`);
        return extractList<WorkItemLink>(data as never);
      },
      async create(workItemId: Id, body: { target_id: Id; link_type_id: Id }) {
        return client.post<WorkItemLink>(`${base(workItemId)}/links`, body);
      },
    },
    // ---- 历史/活动 ----
    async history(workItemId: Id) {
      const data = await client.get(`${base(workItemId)}/activities`);
      return extractList<Activity>(data as never);
    },
    // ---- 标签 ----
    tags: {
      async list(workItemId: Id) {
        const data = await client.get(`${base(workItemId)}/tags`);
        return extractList<Tag>(data as never);
      },
      async add(workItemId: Id, tag: string) {
        return client.post<Tag>(`${base(workItemId)}/tags`, { name: tag });
      },
    },
    // ---- 交付目标 ----
    async deliverables(workItemId: Id) {
      const data = await client.get(`${base(workItemId)}/deliverables`);
      return extractList<unknown>(data as never);
    },
    // ---- 流转（变更状态）----
    async transition(workItemId: Id, stateId: Id) {
      return client.patch(`/project/work_items/${encodeURIComponent(workItemId)}`, { state_id: stateId });
    },
  };
}

export type WorkItemSubResourcesModule = ReturnType<typeof createWorkItemSubResourcesModule>;

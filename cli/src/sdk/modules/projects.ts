/**
 * 项目模块（L2 sdk）。
 *
 * 对照阶段 1 §2：GET /project/projects（列表）、/{id}（详情）、POST（创建）、
 * PATCH /{id}（更新）、DELETE /{id}（删除）、/{id}/members（成员）。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

/** 项目资源 */
export interface Project {
  id?: Id;
  name?: string;
  identifier?: string;
  type?: string;
  description?: string;
  status?: string;
  visibility?: string;
  created_at?: number;
  updated_at?: number;
  [k: string]: unknown;
}

/** 项目成员资源 */
export interface ProjectMember {
  id?: Id;
  user_id?: Id;
  name?: string;
  email?: string;
  role?: string;
  [k: string]: unknown;
}

export interface ProjectListParams extends PageParams {
  /** 名称搜索 */
  search?: string;
}

export interface CreateProjectBody {
  name: string;
  type?: string;
  identifier?: string;
  description?: string;
  assignee_id?: Id;
  members?: Id[];
  [k: string]: unknown;
}

export type UpdateProjectBody = Partial<CreateProjectBody>;

export function createProjectsModule(client: PingCodeClient) {
  return {
    /** 项目列表（单页） */
    async list(params: ProjectListParams = {}) {
      const data = await client.get('/project/projects', {
        params: {
          ...(params.search ? { search: params.search } : {}),
          page_index: params.pageIndex,
          page_size: params.pageSize,
        },
      });
      return extractList<Project>(data as never);
    },

    /** 项目详情 */
    async get(id: Id): Promise<Project> {
      return client.get<Project>(`/project/projects/${encodeURIComponent(id)}`);
    },

    /** 创建项目 */
    async create(body: CreateProjectBody): Promise<Project> {
      return client.post<Project>('/project/projects', body);
    },

    /** 更新项目 */
    async update(id: Id, body: UpdateProjectBody): Promise<Project> {
      return client.patch<Project>(`/project/projects/${encodeURIComponent(id)}`, body);
    },

    /** 删除项目 */
    async remove(id: Id): Promise<void> {
      await client.delete(`/project/projects/${encodeURIComponent(id)}`);
    },

    /** 项目成员列表 */
    async members(id: Id) {
      const data = await client.get(`/project/projects/${encodeURIComponent(id)}/members`);
      return extractList<ProjectMember>(data as never);
    },
  };
}

export type ProjectsModule = ReturnType<typeof createProjectsModule>;

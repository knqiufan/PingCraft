/**
 * 全局个人与组织 directory（L2 sdk）。
 *
 * 路径：`/myself`、`/directory/users|departments|teams|roles|positions|organizations`。
 * team 成员：`/directory/teams/{id}/members`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

export interface User {
  id?: Id;
  name?: string;
  email?: string;
  [k: string]: unknown;
}
export interface Department {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface Team {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface Role {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface Position {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface Organization {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}

export function createDirectoryModule(client: PingCodeClient) {
  return {
    async getMyself(): Promise<User> {
      return client.get<User>('/myself');
    },
    // ---- 用户 ----
    async listUsers(params: PageParams = {}) {
      const data = await client.get('/directory/users', { params: { page_index: params.pageIndex, page_size: params.pageSize } });
      return extractList<User>(data as never);
    },
    async getUser(id: Id): Promise<User> {
      return client.get<User>(`/directory/users/${encodeURIComponent(id)}`);
    },
    async createUser(body: { name: string; email: string }): Promise<User> {
      return client.post<User>('/directory/users', body);
    },
    async updateUser(id: Id, body: Partial<{ name: string; email: string }>): Promise<User> {
      return client.patch<User>(`/directory/users/${encodeURIComponent(id)}`, body);
    },
    // ---- 部门 ----
    async listDepartments() {
      const data = await client.get('/directory/departments');
      return extractList<Department>(data as never);
    },
    async getDepartment(id: Id): Promise<Department> {
      return client.get<Department>(`/directory/departments/${encodeURIComponent(id)}`);
    },
    // ---- 团队 ----
    async listTeams() {
      const data = await client.get('/directory/teams');
      return extractList<Team>(data as never);
    },
    async getTeam(id: Id): Promise<Team> {
      return client.get<Team>(`/directory/teams/${encodeURIComponent(id)}`);
    },
    async listTeamMembers(teamId: Id) {
      const data = await client.get(`/directory/teams/${encodeURIComponent(teamId)}/members`);
      return extractList<User>(data as never);
    },
    async addTeamMember(teamId: Id, userId: Id) {
      return client.post(`/directory/teams/${encodeURIComponent(teamId)}/members`, { user_id: userId });
    },
    async removeTeamMember(teamId: Id, userId: Id) {
      await client.delete(`/directory/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`);
    },
    // ---- 角色/职位/企业 ----
    async listRoles() {
      const data = await client.get('/directory/roles');
      return extractList<Role>(data as never);
    },
    async listPositions() {
      const data = await client.get('/directory/positions');
      return extractList<Position>(data as never);
    },
    async getOrganization(): Promise<Organization> {
      return client.get<Organization>('/directory/organizations');
    },
  };
}

export type DirectoryModule = ReturnType<typeof createDirectoryModule>;

/**
 * 通用 CRUD 模块工厂（L2 sdk 内部工具）。
 *
 * Product/Testhub 大量资源同构（list/get/create/update/remove），用本工厂收敛样板。
 * 有特殊方法的资源（transition / batch-create / link）在各自模块里扩展。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id, type PageParams } from '../types.js';

export interface CrudModule<T> {
  list(params?: PageParams & Record<string, unknown>): Promise<{ values: T[]; total?: number }>;
  get(id: Id): Promise<T>;
  create(body: Record<string, unknown>): Promise<T>;
  update(id: Id, body: Record<string, unknown>): Promise<T>;
  remove(id: Id): Promise<void>;
}

export function createCrud<T>(client: PingCodeClient, basePath: string): CrudModule<T> {
  return {
    async list(params: PageParams & Record<string, unknown> = {}) {
      const { pageIndex, pageSize, ...rest } = params;
      const data = await client.get(basePath, {
        params: { page_index: pageIndex, page_size: pageSize, ...rest },
      });
      return extractList<T>(data as never);
    },
    async get(id: Id): Promise<T> {
      return client.get<T>(`${basePath}/${encodeURIComponent(id)}`);
    },
    async create(body: Record<string, unknown>): Promise<T> {
      return client.post<T>(basePath, body);
    },
    async update(id: Id, body: Record<string, unknown>): Promise<T> {
      return client.patch<T>(`${basePath}/${encodeURIComponent(id)}`, body);
    },
    async remove(id: Id): Promise<void> {
      await client.delete(`${basePath}/${encodeURIComponent(id)}`);
    },
  };
}

/** 只读 list 资源（配置中心/元数据常用） */
export function createListOnly<T>(client: PingCodeClient, basePath: string) {
  return {
    async list(params: Record<string, unknown> = {}) {
      const data = await client.get(basePath, { params });
      return extractList<T>(data as never);
    },
  };
}

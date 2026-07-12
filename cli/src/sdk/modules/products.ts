/**
 * 产品管理 Product 模块（L2 sdk）。
 *
 * product CRUD + 成员/需求模块/需求排期/工单渠道/工单类型/标签 子资源。
 * 路径：`/product/products`（CRUD）+ `/product/products/{id}/<sub>` + 全局元数据。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';
import { extractList, type Id } from '../types.js';

export interface Product {
  id?: Id;
  name?: string;
  identifier?: string;
  [k: string]: unknown;
}

function extract<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : (extractList<T>(data as never).values);
}

export function createProductsModule(client: PingCodeClient) {
  const crud = createCrud<Product>(client, '/product/products');
  const sub = (id: Id, name: string) => `/product/products/${encodeURIComponent(id)}/${name}`;
  return {
    ...crud,
    async members(id: Id) {
      return extract<unknown>(await client.get(sub(id, 'members')));
    },
    async modules(id: Id) {
      return extract<unknown>(await client.get(sub(id, 'modules')));
    },
    async schedule(id: Id) {
      return extract<unknown>(await client.get(sub(id, 'schedules')));
    },
    async ticketChannels() {
      return extract<unknown>(await client.get('/product/ticket_channels'));
    },
    async ticketTypes() {
      return extract<unknown>(await client.get('/product/ticket_types'));
    },
    async tags() {
      return extract<unknown>(await client.get('/product/tags'));
    },
  };
}

export type ProductsModule = ReturnType<typeof createProductsModule>;

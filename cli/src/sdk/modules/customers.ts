/**
 * 客户 Customer + 外部用户 ExternalUser（L2 sdk）。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';
import { extractList, type Id } from '../types.js';

export interface Customer {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface ExternalUser {
  id?: Id;
  name?: string;
  email?: string;
  [k: string]: unknown;
}

export function createCustomersModule(client: PingCodeClient) {
  return {
    ...createCrud<Customer>(client, '/product/customers'),
    externalUser: {
      async list() {
        const data = await client.get('/product/external_users');
        return extractList<ExternalUser>(data as never);
      },
      async create(body: Record<string, unknown>): Promise<ExternalUser> {
        return client.post<ExternalUser>('/product/external_users', body);
      },
      async update(id: Id, body: Record<string, unknown>): Promise<ExternalUser> {
        return client.patch<ExternalUser>(`/product/external_users/${encodeURIComponent(id)}`, body);
      },
      async remove(id: Id): Promise<void> {
        await client.delete(`/product/external_users/${encodeURIComponent(id)}`);
      },
    },
  };
}

export type CustomersModule = ReturnType<typeof createCustomersModule>;

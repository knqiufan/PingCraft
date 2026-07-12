/**
 * 工单 Ticket 模块（L2 sdk）。
 *
 * ticket CRUD + transition；ticket 元数据（type/state/property/channel/priority/solution/tag）。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';
import { extractList, type Id } from '../types.js';

export interface Ticket {
  id?: Id;
  title?: string;
  product_id?: Id;
  [k: string]: unknown;
}

export function createTicketsModule(client: PingCodeClient) {
  const crud = createCrud<Ticket>(client, '/product/tickets');
  const metaList = async (path: string) => extractList<unknown>((await client.get(path)) as never);
  return {
    ...crud,
    async transition(id: Id, stateId: Id) {
      return client.patch(`/product/tickets/${encodeURIComponent(id)}`, { state_id: stateId });
    },
    async types() {
      return metaList('/product/ticket/types');
    },
    async states() {
      return metaList('/product/ticket/states');
    },
    async properties() {
      return metaList('/product/ticket/properties');
    },
    async channels() {
      return metaList('/product/ticket/channels');
    },
    async priorities() {
      return metaList('/product/ticket/priorities');
    },
    async solutions() {
      return metaList('/product/ticket/solutions');
    },
    async tags() {
      return metaList('/product/ticket/tags');
    },
  };
}

export type TicketsModule = ReturnType<typeof createTicketsModule>;

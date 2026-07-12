/**
 * 需求 Requirement 模块（L2 sdk）。
 *
 * requirement CRUD + transition；requirement 元数据（state/property/module/schedule/priority）。
 */
import type { PingCodeClient } from '../client.js';
import { createCrud } from './_crud.js';
import { extractList, type Id } from '../types.js';

export interface Requirement {
  id?: Id;
  title?: string;
  product_id?: Id;
  [k: string]: unknown;
}

export function createRequirementsModule(client: PingCodeClient) {
  const crud = createCrud<Requirement>(client, '/product/requirements');
  const metaList = async (path: string) => extractList<unknown>((await client.get(path)) as never);
  return {
    ...crud,
    async transition(id: Id, stateId: Id) {
      return client.patch(`/product/requirements/${encodeURIComponent(id)}`, { state_id: stateId });
    },
    async states() {
      return metaList('/product/requirement/states');
    },
    async properties() {
      return metaList('/product/requirement/properties');
    },
    async modules() {
      return metaList('/product/requirement/modules');
    },
    async schedules() {
      return metaList('/product/requirement/schedules');
    },
    async priorities() {
      return metaList('/product/requirement/priorities');
    },
  };
}

export type RequirementsModule = ReturnType<typeof createRequirementsModule>;

/**
 * 瀑布 Waterfall 模块（L2 sdk，只读）。
 *
 * 路径：`/project/waterfall/work_item_types` + `/project/waterfall/transitions`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id } from '../types.js';

export interface WaterfallItem {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}

export function createWaterfallModule(client: PingCodeClient) {
  return {
    async workItemTypes(projectId: Id) {
      const data = await client.get('/project/waterfall/work_item_types', { params: { project_id: projectId } });
      return extractList<WaterfallItem>(data as never);
    },
    async transitions(projectId: Id) {
      const data = await client.get('/project/waterfall/transitions', { params: { project_id: projectId } });
      return extractList<WaterfallItem>(data as never);
    },
  };
}

export type WaterfallModule = ReturnType<typeof createWaterfallModule>;

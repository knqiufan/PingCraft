/**
 * 工作项元数据模块（L2 sdk）。
 *
 * 对照后端 getWorkItemTypes/States/Properties/Priorities：
 *  - 类型   GET /project/work_item/types?project_id
 *  - 状态   GET /project/work_item/states?project_id&work_item_type_id
 *  - 属性   GET /project/work_item/properties?project_id&work_item_type_id
 *  - 优先级 GET /project/work_item/priorities?project_id
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id } from '../types.js';

export interface WorkItemType {
  id?: Id;
  name?: string;
  identifier?: string;
  icon?: string;
  [k: string]: unknown;
}

export interface WorkItemState {
  id?: Id;
  name?: string;
  category?: string;
  [k: string]: unknown;
}

export interface WorkItemProperty {
  id?: Id;
  name?: string;
  identifier?: string;
  type?: string;
  [k: string]: unknown;
}

export interface WorkItemPriority {
  id?: Id;
  name?: string;
  level?: number;
  [k: string]: unknown;
}

export function createWorkItemMetaModule(client: PingCodeClient) {
  return {
    /** 工作项类型 */
    async types(projectId: Id) {
      const data = await client.get('/project/work_item/types', { params: { project_id: projectId } });
      return extractList<WorkItemType>(data as never);
    },

    /** 工作项状态 */
    async states(projectId: Id, workItemTypeId: Id) {
      const data = await client.get('/project/work_item/states', {
        params: { project_id: projectId, work_item_type_id: workItemTypeId },
      });
      return extractList<WorkItemState>(data as never);
    },

    /** 工作项属性 */
    async properties(projectId: Id, workItemTypeId: Id) {
      const data = await client.get('/project/work_item/properties', {
        params: { project_id: projectId, work_item_type_id: workItemTypeId },
      });
      return extractList<WorkItemProperty>(data as never);
    },

    /** 工作项优先级 */
    async priorities(projectId: Id) {
      const data = await client.get('/project/work_item/priorities', { params: { project_id: projectId } });
      return extractList<WorkItemPriority>(data as never);
    },
  };
}

export type WorkItemMetaModule = ReturnType<typeof createWorkItemMetaModule>;

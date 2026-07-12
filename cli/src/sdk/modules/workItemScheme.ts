/**
 * 工作项配置中心 scheme（L2 sdk，只读为主）。
 *
 * state/property/type/transition 方案 + link-type。路径：`/project/work_item/scheme/<sub>` 与 `/project/work_item/link_types`。
 */
import type { PingCodeClient } from '../client.js';
import { extractList, type Id } from '../types.js';

export interface SchemeItem {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}
export interface LinkType {
  id?: Id;
  name?: string;
  [k: string]: unknown;
}

export function createWorkItemSchemeModule(client: PingCodeClient) {
  return {
    /** 状态方案 */
    async states(projectId: Id) {
      const data = await client.get('/project/work_item/scheme/states', { params: { project_id: projectId } });
      return extractList<SchemeItem>(data as never);
    },
    /** 属性方案 */
    async properties(projectId: Id) {
      const data = await client.get('/project/work_item/scheme/properties', { params: { project_id: projectId } });
      return extractList<SchemeItem>(data as never);
    },
    /** 类型方案 */
    async types(projectId: Id) {
      const data = await client.get('/project/work_item/scheme/types', { params: { project_id: projectId } });
      return extractList<SchemeItem>(data as never);
    },
    /** 流转方案（按工作项类型） */
    async transitions(projectId: Id, workItemTypeId: Id) {
      const data = await client.get('/project/work_item/scheme/transitions', {
        params: { project_id: projectId, work_item_type_id: workItemTypeId },
      });
      return extractList<SchemeItem>(data as never);
    },
    /** 关联类型（全局） */
    async linkTypes() {
      const data = await client.get('/project/work_item/link_types');
      return extractList<LinkType>(data as never);
    },
  };
}

export type WorkItemSchemeModule = ReturnType<typeof createWorkItemSchemeModule>;

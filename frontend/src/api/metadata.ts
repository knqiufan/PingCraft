import request from './index'
import type {
  ApiResponse,
  WorkItemTypeMeta,
  WorkItemStateMeta,
  WorkItemPropertyMeta,
  WorkItemPriorityMeta,
  SyncedProjectMeta,
  SyncedWorkItemMeta,
  PingCodeUserInfo,
  MetadataOverview,
} from './types'

const base = '/api/metadata'

/** 获取工作项类型列表 */
export function getWorkItemTypes(projectId?: string) {
  const params = projectId ? { project_id: projectId } : {}
  return request.get<any, ApiResponse<WorkItemTypeMeta[]>>(`${base}/types`, { params })
}

/** 获取工作项状态列表 */
export function getWorkItemStates(projectId?: string) {
  const params = projectId ? { project_id: projectId } : {}
  return request.get<any, ApiResponse<WorkItemStateMeta[]>>(`${base}/states`, { params })
}

/** 获取工作项属性列表 */
export function getWorkItemProperties(projectId?: string) {
  const params = projectId ? { project_id: projectId } : {}
  return request.get<any, ApiResponse<WorkItemPropertyMeta[]>>(`${base}/properties`, { params })
}

/** 获取工作项优先级列表 */
export function getWorkItemPriorities(projectId?: string) {
  const params = projectId ? { project_id: projectId } : {}
  return request.get<any, ApiResponse<WorkItemPriorityMeta[]>>(`${base}/priorities`, { params })
}

/** 获取已同步项目列表 */
export function getSyncedProjects() {
  return request.get<any, ApiResponse<SyncedProjectMeta[]>>(`${base}/projects`)
}

/** 获取已同步工作项列表 */
export function getSyncedWorkItems(projectId?: string) {
  const params = projectId ? { project_id: projectId } : {}
  return request.get<any, ApiResponse<SyncedWorkItemMeta[]>>(`${base}/work-items`, { params })
}

/** 获取当前用户 PingCode 信息 */
export function getUserInfo() {
  return request.get<any, ApiResponse<PingCodeUserInfo>>(`${base}/user-info`)
}

/** 获取元数据概览（项目数、工作项数、类型数、状态数） */
export function getMetadataOverview() {
  return request.get<any, ApiResponse<MetadataOverview>>(`${base}/overview`)
}

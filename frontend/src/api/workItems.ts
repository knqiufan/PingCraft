import request from './index'
import type {
  WorkItem,
  ApiResponse,
  SyncData,
  MatchProjectData,
  CheckDuplicatesData,
  ImportResultData,
} from './types'

/** 同步 PingCode 数据 */
export function syncData() {
  return request.post<any, ApiResponse<SyncData>>('/api/sync-data', {})
}

/** 匹配项目 */
export function matchProject(requirements: WorkItem[]) {
  return request.post<any, ApiResponse<MatchProjectData>>('/api/match-project', { requirements })
}

/** 检查重复工作项 */
export function checkDuplicates(items: WorkItem[], projectId: string) {
  return request.post<any, ApiResponse<CheckDuplicatesData>>('/api/check-duplicates', {
    items,
    projectId,
  })
}

/** 批量导入工作项 */
export function importItems(items: WorkItem[], projectId: string) {
  return request.post<any, ApiResponse<ImportResultData>>('/api/import', { items, projectId })
}

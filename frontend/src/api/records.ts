import request from './index'
import type { ApiResponse } from './types'

/** 导入记录 */
export interface ImportRecord {
  id: string
  user_id: string
  file_name: string
  original_file_path?: string
  requirements_count: number
  projects_count: number
  target_project_id?: string
  target_project_name?: string
  imported_count: number
  failed_count: number
  status: 'analyzed' | 'importing' | 'success' | 'partial_success' | 'failed'
  error_message?: string
  createdAt: string
  updatedAt: string
}

/** 导入记录明细（工作项） */
export interface ImportRecordItem {
  id: string
  record_id: string
  title: string
  description?: string
  project_name?: string
  type_id?: string
  priority_id?: string
  pingcode_id?: string
  pingcode_identifier?: string
  status: 'pending' | 'success' | 'failed' | 'skipped'
  error_message?: string
  createdAt: string
  updatedAt: string
}

/** 导入记录列表响应 */
export interface ImportRecordListResponse {
  list: ImportRecord[]
  total: number
  page: number
  pageSize: number
}

/** 导入记录明细列表响应 */
export interface ImportRecordItemListResponse {
  list: ImportRecordItem[]
  total: number
  page: number
  pageSize: number
}

/** 原需求文档内容响应 */
export interface DemandContentResponse {
  content: string
  file_name: string
  file_path: string
}

/** 获取导入记录列表 */
export function getImportRecords(params?: { page?: number; pageSize?: number; status?: string }) {
  return request.get<any, ApiResponse<ImportRecordListResponse>>('/api/records', { params })
}

/** 获取导入记录详情 */
export function getImportRecord(id: string) {
  return request.get<any, ApiResponse<ImportRecord>>(`/api/records/${id}`)
}

/** 创建导入记录 */
export function createImportRecord(data: Partial<ImportRecord>) {
  return request.post<any, ApiResponse<ImportRecord>>('/api/records', data)
}

/** 更新导入记录 */
export function updateImportRecord(id: string, data: Partial<ImportRecord>) {
  return request.put<any, ApiResponse<ImportRecord>>(`/api/records/${id}`, data)
}

/** 删除导入记录 */
export function deleteImportRecord(id: string) {
  return request.delete<any, ApiResponse<null>>(`/api/records/${id}`)
}

/** 获取导入记录的工作项明细列表 */
export function getImportRecordItems(
  recordId: string,
  params?: { page?: number; pageSize?: number; status?: string }
) {
  return request.get<any, ApiResponse<ImportRecordItemListResponse>>(
    `/api/records/${recordId}/items`,
    { params }
  )
}

/** 获取原需求文档内容 */
export function getDemandContent(recordId: string) {
  return request.get<any, ApiResponse<DemandContentResponse>>(
    `/api/records/${recordId}/content`
  )
}

/** 从导入记录恢复分析结果 */
export function restoreFromRecord(recordId: string) {
  return request.get<any, ApiResponse<{
    requirements: any[]
    record_id: string
    file_name: string
    target_project_id?: string
    target_project_name?: string
  }>>(`/api/records/${recordId}/restore`)
}

/**
 * 导出导入记录为 CSV（P3-5.5）。
 * 直接下载文件，不走 axios 响应拦截器。
 */
export function exportRecordAsCsv(recordId: string, fileName?: string) {
  const token = localStorage.getItem('local_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  return fetch(`${baseUrl}/api/records/${recordId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (response) => {
    if (!response.ok) throw new Error('导出失败')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName || 'export'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}

import request from './index'
import type {
  WorkItem,
  ApiResponse,
  SyncData,
  ClearSyncedData,
  MatchProjectData,
  CheckDuplicatesData,
  ImportResultData,
} from './types'

/** 同步 PingCode 数据 */
export function syncData() {
  return request.post<any, ApiResponse<SyncData>>('/api/sync-data', {})
}

/** 清除当前用户从 PingCode 同步到本地的数据 */
export function clearSyncedData() {
  return request.delete<any, ApiResponse<ClearSyncedData>>('/api/sync-data')
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
export function importItems(items: WorkItem[], projectId: string, recordId?: string) {
  return request.post<any, ApiResponse<ImportResultData>>('/api/import', {
    items,
    projectId,
    record_id: recordId,
  })
}

/** SSE 流式导入工作项，返回 EventSource 风格的控制器 */
export function importItemsStream(
  items: WorkItem[],
  projectId: string,
  recordId: string | undefined,
  callbacks: {
    onProgress?: (data: { current: number; total: number; title: string; status: string; error?: string }) => void
    onComplete?: (data: { result: any }) => void
    onError?: (data: { message: string }) => void
    onProjectCreated?: (data: { name: string }) => void
  }
) {
  const token = localStorage.getItem('local_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''

  fetch(`${baseUrl}/api/import-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ items, projectId, record_id: recordId }),
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      // 解析错误响应体，提取后端返回的明确错误信息（如 PingCode 授权过期）
      let errorMsg = '连接失败'
      try {
        const errData = await response.json()
        errorMsg = errData?.error || errorMsg
      } catch {
        // 响应非 JSON，使用默认消息
      }
      callbacks.onError?.({ message: errorMsg })
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ') && currentEvent) {
          try {
            const data = JSON.parse(line.slice(6))
            if (currentEvent === 'progress') callbacks.onProgress?.(data)
            else if (currentEvent === 'complete') callbacks.onComplete?.(data)
            else if (currentEvent === 'error') callbacks.onError?.(data)
            else if (currentEvent === 'project_created') callbacks.onProjectCreated?.(data)
          } catch { /* ignore parse errors */ }
          currentEvent = ''
        }
      }
    }
  }).catch((err) => {
    callbacks.onError?.({ message: err.message || '网络错误' })
  })
}

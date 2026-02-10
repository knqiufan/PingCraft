import request from './index'
import type { AnalyzeResult } from './types'

/** 上传文件并分析需求 */
export function analyzeFile(formData: FormData) {
  return request.post<any, AnalyzeResult>('/api/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 分析可能较慢，超时设为 2 分钟
  })
}

import request from './index'
import type { ApiResponse, ProjectStatsData, AIAnalysisData } from './types'

const base = '/api/stats'

/** 获取项目统计数据 */
export function getProjectStats(projectId: string) {
  return request.get<any, ApiResponse<ProjectStatsData>>(`${base}/${projectId}`)
}

/** AI 统计分析 */
export function getAIAnalysis(projectId: string) {
  return request.post<any, ApiResponse<AIAnalysisData>>(`${base}/ai-analyze`, { projectId })
}

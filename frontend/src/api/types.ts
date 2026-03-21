/**
 * API 请求/响应类型定义
 */

/** 通用响应包装 */
export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

/** 工作项（需求） */
export interface WorkItem {
  id?: string
  project_name: string
  title: string
  description?: string
  priority: string
  estimated_hours: number
  start_at: string
  status?: string
  match?: { id: string; title: string; score?: number } | null
  /** PingCode 工作项类型 ID */
  type_id?: string
  /** PingCode 优先级 ID */
  priority_id?: string
  /** PingCode 状态 ID */
  state_id?: string
  /** 负责人 ID（PingCode 用户 ID） */
  assignee_id?: string
  /** 负责人姓名（从需求文档中识别） */
  assignee_name?: string | null
  /** 解决方案建议 */
  solution_suggestion?: string
  /** 自定义属性 */
  properties?: Record<string, unknown>
}

/** 工作项类型（元数据） */
export interface WorkItemTypeMeta {
  id: string
  project_id: string
  name: string
  group?: string
}

/** 工作项状态（元数据） */
export interface WorkItemStateMeta {
  id: string
  project_id: string
  work_item_type_id?: string
  name: string
  type?: string
  color?: string
}

/** 工作项属性（元数据） */
export interface WorkItemPropertyMeta {
  id: string
  project_id: string
  work_item_type_id?: string
  name: string
  type?: string
  options?: Array<{ _id: string; text: string }> | null
}

/** 工作项优先级（元数据） */
export interface WorkItemPriorityMeta {
  id: string
  project_id: string
  name: string
}

/** 已同步项目 */
export interface SyncedProjectMeta {
  id: string
  name: string
  description?: string
  /** 本地同步入库时间（ISO 字符串），旧数据可能无此字段 */
  createdAt?: string
}

/** 已同步工作项 */
export interface SyncedWorkItemMeta {
  id: string
  project_id: string
  title: string
  identifier?: string
  /** 关联项目名称展示用，可能由后端联表填充 */
  project_name?: string
  /** 本地同步入库时间（ISO 字符串），旧数据可能无此字段 */
  createdAt?: string
}

/** PingCode 用户信息 */
export interface PingCodeUserInfo {
  id: string
  name: string
  display_name: string
  email: string
  avatar: string
}

/** 项目 */
export interface Project {
  id: string
  name: string
  score?: number
  suggestedName?: string
}

/** PingCode OAuth2 grant_type */
export type PingCodeGrantType = 'authorization_code' | 'client_credentials'

/** 配置信息 */
export interface ConfigInfo {
  client_id: string
  has_secret: boolean
  is_connected: boolean
  grant_type: PingCodeGrantType
}

/** 同步结果 */
export interface SyncData {
  projects: number
  workItems: number
  addedProjects?: number
  addedWorkItems?: number
}

/** 元数据概览 */
export interface MetadataOverview {
  projects: number
  workItems: number
  types: number
  states: number
}

/** 项目匹配数据 */
export interface MatchProjectData {
  matches: Project[]
  projectNames?: string[]
}

/** 去重检查数据 */
export interface CheckDuplicatesData {
  items: WorkItem[]
}

/** 导入结果数据 */
export interface ImportResultData {
  result: {
    success: number
    failed: number
    errors: Array<{ item: string; error: string }>
    /** 自动创建的项目列表 */
    createdProjects?: Array<{ id: string; name: string }>
  }
}

/** 分析结果 */
export interface AnalyzeResult {
  success: boolean
  data: WorkItem[]
  /** 导入记录 ID，用于后续更新导入状态 */
  record_id?: string
}

/** 登录响应 */
export interface LoginResponse {
  success: boolean
  token: string
  user: {
    id: string
    username: string
    isAdmin?: boolean
    roles?: string[]
  }
}

/** 认证 URL 响应 */
export interface LoginUrlResponse {
  url: string
}

/** 统计分布项 */
export interface StatsDistributionItem {
  name: string
  value: number
}

/** 状态分布 */
export interface StateDistribution {
  groups: {
    todo: number
    inProgress: number
    done: number
    other: number
  }
  details: Array<{ name: string; type: string; count: number }>
  total: number
  completionRate: number
}

/** 项目统计数据 */
export interface ProjectStatsData {
  project: { id: string; name: string }
  totalItems: number
  totalEstimatedHours: number
  assigneeDistribution: StatsDistributionItem[]
  typeDistribution: StatsDistributionItem[]
  priorityDistribution: StatsDistributionItem[]
  stateDistribution: StateDistribution
  workloadByAssignee: StatsDistributionItem[]
  workloadByType: StatsDistributionItem[]
}

/** AI 分析报告响应 */
export interface AIAnalysisData {
  report: string
  stats: ProjectStatsData
}

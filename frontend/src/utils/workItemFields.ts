/**
 * 工作项字段 enrichment：把 Agent 产出的文本枚举对齐到 PingCode 元数据 ID，
 * 保证列表下拉 / 详情 / 编辑使用同一套字段。
 */
import type { WorkItem, WorkItemPriorityMeta, WorkItemStateMeta, WorkItemTypeMeta } from '@/api/types'

export type WorkItemMetaBundle = {
  types: WorkItemTypeMeta[]
  priorities: WorkItemPriorityMeta[]
  states: WorkItemStateMeta[]
}

const TEXT_PRIORITIES = ['High', 'Medium', 'Low'] as const
type TextPriority = (typeof TEXT_PRIORITIES)[number]

const PRIORITY_ALIAS: Record<string, TextPriority> = {
  high: 'High',
  高: 'High',
  紧急: 'High',
  medium: 'Medium',
  中: 'Medium',
  中等: 'Medium',
  low: 'Low',
  低: 'Low',
}

/** 本地 fallback 状态 id（无 PingCode 元数据时使用） */
export const FALLBACK_STATE_ID = 'new'
const FALLBACK_STATES = ['new', 'in_progress', 'done'] as const

const TODO_NAME_RE = /待办|新建|open|todo|new|未开始|pending/i
const DOING_NAME_RE = /进行中|处理中|doing|in.?progress|active/i
const DONE_NAME_RE = /已完成|完成|done|closed|resolved|关闭/i

export function toTextPriority(raw?: string | null): TextPriority {
  if (!raw) return 'Medium'
  if ((TEXT_PRIORITIES as readonly string[]).includes(raw)) return raw as TextPriority
  return PRIORITY_ALIAS[raw.toLowerCase()] || PRIORITY_ALIAS[raw] || 'Medium'
}

function matchPriorityMeta(text: TextPriority, priorities: WorkItemPriorityMeta[]): WorkItemPriorityMeta | undefined {
  const patterns: Record<TextPriority, RegExp> = {
    High: /高|紧急|critical|high|p0|p1/i,
    Medium: /中|普通|medium|normal|p2/i,
    Low: /低|low|p3|p4/i,
  }
  const exact = priorities.find(
    (p) => p.name === text || p.name.toLowerCase() === text.toLowerCase()
  )
  if (exact) return exact
  return priorities.find((p) => patterns[text].test(p.name))
}

/** 解析列表/导入用的 priority_id（无元数据时回退 High/Medium/Low） */
export function resolvePriorityId(
  priorityId: string | undefined,
  priority: string | undefined,
  priorities: WorkItemPriorityMeta[]
): string {
  if (priorityId && priorities.some((p) => p.id === priorityId)) return priorityId

  const textHint =
    priorityId && (TEXT_PRIORITIES as readonly string[]).includes(priorityId)
      ? priorityId
      : priority
  const text = toTextPriority(textHint)

  if (priorities.length === 0) return text

  const matched = matchPriorityMeta(text, priorities)
  if (matched) return matched.id

  const mid = priorities.find((p) => /中|medium/i.test(p.name))
  return mid?.id || priorities[Math.floor(priorities.length / 2)]?.id || text
}

/** 将 priority_id 同步回 Agent 文本枚举（详情 tag / 批量编辑兼容） */
export function priorityIdToText(
  priorityId: string | undefined,
  priorities: WorkItemPriorityMeta[]
): TextPriority {
  if (!priorityId) return 'Medium'
  if ((TEXT_PRIORITIES as readonly string[]).includes(priorityId)) {
    return priorityId as TextPriority
  }
  const meta = priorities.find((p) => p.id === priorityId)
  if (!meta) return 'Medium'
  if (/高|紧急|critical|high/i.test(meta.name)) return 'High'
  if (/低|low/i.test(meta.name)) return 'Low'
  if (/中|medium|普通|normal/i.test(meta.name)) return 'Medium'
  return 'Medium'
}

const TYPE_PATTERNS: Record<string, RegExp> = {
  story: /故事|story|user.?story/i,
  task: /任务|task/i,
  bug: /缺陷|bug/i,
  feature: /特性|feature/i,
  epic: /史诗|epic/i,
}

/** 将 story/task 等枚举映射为项目内 type UUID */
export function resolveTypeId(typeId: string | undefined, types: WorkItemTypeMeta[]): string {
  if (!typeId) return types[0]?.id || 'story'
  if (types.some((t) => t.id === typeId)) return typeId
  if (types.length === 0) return typeId

  const pattern = TYPE_PATTERNS[typeId]
  if (pattern) {
    const found = types.find((t) => pattern.test(t.name))
    if (found) return found.id
  }
  const byName = types.find((t) => t.name === typeId || t.name.toLowerCase() === typeId.toLowerCase())
  return byName?.id || types[0]?.id || typeId
}

/** 严格按类型过滤状态，绝不回退到其他类型的状态（避免选中无法展示的 UUID） */
function statesForTypeStrict(typeId: string | undefined, states: WorkItemStateMeta[]): WorkItemStateMeta[] {
  if (!typeId) return states
  return states.filter((s) => !s.work_item_type_id || s.work_item_type_id === typeId)
}

function isTodoState(s: WorkItemStateMeta): boolean {
  // PingCode 待办态 type 为 pending；部分环境也可能是 start
  return s.type === 'pending' || s.type === 'start' || TODO_NAME_RE.test(s.name || '')
}

function matchStateByName(name: string, scoped: WorkItemStateMeta[]): WorkItemStateMeta | undefined {
  const trimmed = name.trim()
  if (!trimmed) return undefined
  const exact = scoped.find((s) => s.name === trimmed || s.name?.toLowerCase() === trimmed.toLowerCase())
  if (exact) return exact

  if (TODO_NAME_RE.test(trimmed)) return scoped.find(isTodoState)
  if (DOING_NAME_RE.test(trimmed)) {
    return scoped.find((s) => s.type === 'doing' || DOING_NAME_RE.test(s.name || ''))
  }
  if (DONE_NAME_RE.test(trimmed)) {
    return scoped.find((s) => s.type === 'done' || DONE_NAME_RE.test(s.name || ''))
  }
  return scoped.find((s) => s.name?.includes(trimmed) || trimmed.includes(s.name || ''))
}

/**
 * 解析 state_id。
 * - 文档未标注 / LLM 返回空：默认待办
 * - 有状态名：按名称匹配当前类型下的 PingCode 状态
 * - 无该类型元数据时：回退本地 'new'，禁止误选其他类型 UUID
 */
export function resolveStateId(
  stateId: string | undefined,
  typeId: string | undefined,
  states: WorkItemStateMeta[],
  stateName?: string | null
): string {
  const scoped = statesForTypeStrict(typeId, states)

  if (stateId && scoped.some((s) => s.id === stateId)) return stateId
  if (stateId && states.length === 0 && (FALLBACK_STATES as readonly string[]).includes(stateId)) {
    return stateId
  }

  if (stateName) {
    const byName = matchStateByName(stateName, scoped)
    if (byName) return byName.id
    // 无元数据时，把常见状态名映射到本地 fallback
    if (scoped.length === 0) {
      if (DOING_NAME_RE.test(stateName)) return 'in_progress'
      if (DONE_NAME_RE.test(stateName)) return 'done'
      return FALLBACK_STATE_ID
    }
  }

  if (scoped.length === 0) return FALLBACK_STATE_ID

  const todo = scoped.find(isTodoState)
  return todo?.id || scoped[0]!.id
}

/** 解析可读状态名（详情展示用，避免直接暴露 UUID） */
export function resolveStateLabel(
  stateId: string | undefined,
  stateName: string | null | undefined,
  states: WorkItemStateMeta[]
): string {
  if (stateName && stateName.trim()) return stateName.trim()
  if (!stateId) return '待办'
  if (stateId === 'new') return '待办'
  if (stateId === 'in_progress') return '进行中'
  if (stateId === 'done') return '已完成'
  const meta = states.find((s) => s.id === stateId)
  if (meta?.name) return meta.name
  // 未命中元数据时不展示原始 ID
  return '待办'
}

/** 单条工作项字段对齐 */
export function enrichWorkItem(item: WorkItem, meta: WorkItemMetaBundle): WorkItem {
  const type_id = resolveTypeId(item.type_id, meta.types)
  const priority_id = resolvePriorityId(item.priority_id, item.priority, meta.priorities)
  const priority = priorityIdToText(priority_id, meta.priorities)
  const state_id = resolveStateId(item.state_id, type_id, meta.states, item.state)
  const state = resolveStateLabel(state_id, item.state, meta.states)
  return { ...item, type_id, priority_id, priority, state_id, state }
}

export function enrichWorkItems(items: WorkItem[], meta: WorkItemMetaBundle): WorkItem[] {
  return items.map((item) => enrichWorkItem(item, meta))
}

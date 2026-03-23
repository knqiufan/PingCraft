/**
 * 工作项元数据相关的组合式函数
 * 提供类型、优先级、状态等元数据的获取和格式化方法
 */
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { WorkItemStateMeta, WorkItemPriorityMeta, WorkItemTypeMeta } from '@/api/types'

/** 静态类型选项（当元数据不可用时作为 fallback） */
export const fallbackTypeOptions = [
  { label: '用户故事', value: 'story' },
  { label: '任务', value: 'task' },
  { label: '缺陷', value: 'bug' },
  { label: '特性', value: 'feature' },
  { label: '史诗', value: 'epic' },
]

/** 静态优先级选项（当元数据不可用时作为 fallback） */
export const fallbackPriorityOptions = [
  { label: '高', value: 'High' },
  { label: '中', value: 'Medium' },
  { label: '低', value: 'Low' },
]

/** 静态状态选项（当元数据不可用时作为 fallback） */
const fallbackStateOptions: WorkItemStateMeta[] = [
  { id: 'new', project_id: '', name: '待办' },
  { id: 'in_progress', project_id: '', name: '进行中' },
  { id: 'done', project_id: '', name: '已完成' },
]

/** 类型 fallback 的 { id, name } 格式，供表格下拉使用 */
const fallbackTypesAsMeta: WorkItemTypeMeta[] = fallbackTypeOptions.map((t) => ({
  id: t.value,
  project_id: '',
  name: t.label,
}))

/** 优先级 fallback 的 { id, name } 格式，供表格下拉使用 */
const fallbackPrioritiesAsMeta: WorkItemPriorityMeta[] = fallbackPriorityOptions.map((p) => ({
  id: p.value,
  project_id: '',
  name: p.label,
}))

/** 向后兼容：保留原 typeOptions 导出名 */
export const typeOptions = fallbackTypeOptions

export function useWorkItemMeta() {
  const appStore = useAppStore()

  /** 当前选中项目的类型列表 */
  const typesForProject = computed<WorkItemTypeMeta[]>(() => {
    const pid = appStore.selectedProjectId
    if (!pid || pid.startsWith('new:')) return appStore.workItemTypes
    return appStore.workItemTypes.filter((t) => t.project_id === pid)
  })

  /** 动态类型选项：优先使用项目元数据，无则 fallback 到静态选项 */
  const dynamicTypeOptions = computed(() => {
    if (typesForProject.value.length > 0) {
      return typesForProject.value.map(t => ({ label: t.name, value: t.id }))
    }
    return fallbackTypeOptions
  })

  /** 当前选中项目的优先级列表 */
  const prioritiesForProject = computed<WorkItemPriorityMeta[]>(() => {
    const pid = appStore.selectedProjectId
    if (!pid || pid.startsWith('new:')) return appStore.workItemPriorities
    return appStore.workItemPriorities.filter((p) => p.project_id === pid)
  })

  /** 动态优先级选项：优先使用项目元数据，无则 fallback 到静态选项 */
  const dynamicPriorityOptions = computed(() => {
    if (prioritiesForProject.value.length > 0) {
      return prioritiesForProject.value.map(p => ({ label: p.name, value: p.id }))
    }
    return fallbackPriorityOptions
  })

  /** 根据类型 ID 获取对应的状态列表 */
  function statesForType(typeId: string | undefined): WorkItemStateMeta[] {
    const pid = appStore.selectedProjectId
    // 如果没有选中项目，返回所有状态（按类型过滤）
    if (!pid) {
      return appStore.workItemStates.filter(
        (s) => !typeId || s.work_item_type_id === typeId
      )
    }
    return appStore.workItemStates.filter(
      (s) => s.project_id === pid && (!typeId || s.work_item_type_id === typeId)
    )
  }

  /** 表格下拉用：元数据为空时使用 fallback 的类型列表 */
  const effectiveTypesForProject = computed<WorkItemTypeMeta[]>(() => {
    if (typesForProject.value.length > 0) return typesForProject.value
    return fallbackTypesAsMeta
  })

  /** 表格下拉用：元数据为空时使用 fallback 的优先级列表 */
  const effectivePrioritiesForProject = computed<WorkItemPriorityMeta[]>(() => {
    if (prioritiesForProject.value.length > 0) return prioritiesForProject.value
    return fallbackPrioritiesAsMeta
  })

  /** 表格下拉用：元数据为空时使用 fallback 的状态列表 */
  function effectiveStatesForType(typeId: string | undefined): WorkItemStateMeta[] {
    const states = statesForType(typeId)
    if (states.length > 0) return states
    return fallbackStateOptions
  }

  /** 获取类型标签 */
  function getTypeLabel(typeId?: string): string {
    // 先从静态选项中查找
    const option = typeOptions.find((t) => t.value === typeId)
    if (option) return option.label
    // 再从元数据中查找
    const meta = appStore.workItemTypes.find((t) => t.id === typeId)
    return meta?.name || typeId || '-'
  }

  /** 获取优先级标签 */
  function getPriorityLabel(priority?: string): string {
    const map: Record<string, string> = { High: '高', Medium: '中', Low: '低' }
    const key = priority ?? ''
    const mapped = map[key]
    if (mapped) return mapped
    // 从元数据中查找
    const meta = appStore.workItemPriorities.find((p) => p.id === priority || p.name === priority)
    return meta?.name || priority || '-'
  }

  /** 获取状态标签 */
  function getStateLabel(stateId?: string): string {
    const meta = appStore.workItemStates.find((s) => s.id === stateId)
    return meta?.name || stateId || '-'
  }

  /** 格式化日期 */
  function formatDate(dateStr: string): string {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }

  return {
    typesForProject,
    prioritiesForProject,
    dynamicTypeOptions,
    dynamicPriorityOptions,
    statesForType,
    effectiveTypesForProject,
    effectivePrioritiesForProject,
    effectiveStatesForType,
    getTypeLabel,
    getPriorityLabel,
    getStateLabel,
    formatDate,
    typeOptions: fallbackTypeOptions,
  }
}

/**
 * 工作项元数据相关的组合式函数
 * 提供类型、优先级、状态等元数据的获取和格式化方法
 */
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { WorkItemStateMeta, WorkItemPriorityMeta, WorkItemTypeMeta } from '@/api/types'

/** 类型选项（静态备选） */
export const typeOptions = [
  { label: '用户故事', value: 'story' },
  { label: '任务', value: 'task' },
  { label: '缺陷', value: 'bug' },
  { label: '特性', value: 'feature' },
  { label: '史诗', value: 'epic' },
]

export function useWorkItemMeta() {
  const appStore = useAppStore()

  /** 当前选中项目的类型列表 */
  const typesForProject = computed<WorkItemTypeMeta[]>(() => {
    const pid = appStore.selectedProjectId
    if (!pid) return []
    return appStore.workItemTypes.filter((t) => t.project_id === pid)
  })

  /** 当前选中项目的优先级列表 */
  const prioritiesForProject = computed<WorkItemPriorityMeta[]>(() => {
    const pid = appStore.selectedProjectId
    if (!pid) return []
    return appStore.workItemPriorities.filter((p) => p.project_id === pid)
  })

  /** 根据类型 ID 获取对应的状态列表 */
  function statesForType(typeId: string | undefined): WorkItemStateMeta[] {
    const pid = appStore.selectedProjectId
    if (!pid) return []
    return appStore.workItemStates.filter(
      (s) => s.project_id === pid && (!typeId || s.work_item_type_id === typeId)
    )
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
    if (map[priority || '']) return map[priority || '']
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
    statesForType,
    getTypeLabel,
    getPriorityLabel,
    getStateLabel,
    formatDate,
    typeOptions,
  }
}

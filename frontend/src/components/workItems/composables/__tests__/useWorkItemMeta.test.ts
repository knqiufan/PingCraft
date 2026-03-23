import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkItemMeta, fallbackTypeOptions, fallbackPriorityOptions } from '../useWorkItemMeta'
import { useAppStore } from '@/stores/app'

vi.mock('@/api/workItems', () => ({
  syncData: vi.fn(),
  matchProject: vi.fn(),
  checkDuplicates: vi.fn(),
  importItems: vi.fn(),
  importItemsStream: vi.fn(),
}))

vi.mock('@/api/metadata', () => ({
  getWorkItemTypes: vi.fn().mockResolvedValue({ data: [] }),
  getWorkItemStates: vi.fn().mockResolvedValue({ data: [] }),
  getWorkItemProperties: vi.fn().mockResolvedValue({ data: [] }),
  getWorkItemPriorities: vi.fn().mockResolvedValue({ data: [] }),
  getSyncedProjects: vi.fn().mockResolvedValue({ data: [] }),
  getSyncedWorkItems: vi.fn().mockResolvedValue({ data: [] }),
  getUserInfo: vi.fn().mockResolvedValue({ data: null }),
  getMetadataOverview: vi.fn().mockResolvedValue({ data: null }),
}))

vi.mock('@/api/analyze', () => ({
  analyzeFile: vi.fn(),
}))

vi.mock('@/api/records', () => ({
  restoreFromRecord: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('useWorkItemMeta', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should return fallback type options when no metadata', () => {
    const { dynamicTypeOptions } = useWorkItemMeta()
    expect(dynamicTypeOptions.value).toEqual(fallbackTypeOptions)
  })

  it('should return project types when metadata available', () => {
    const appStore = useAppStore()
    appStore.workItemTypes = [
      { id: 'type-1', project_id: 'p1', name: 'Custom Type' },
    ] as any
    appStore.selectedProjectId = 'p1'

    const { dynamicTypeOptions } = useWorkItemMeta()
    expect(dynamicTypeOptions.value).toEqual([
      { label: 'Custom Type', value: 'type-1' },
    ])
  })

  it('should return fallback priority options when no metadata', () => {
    const { dynamicPriorityOptions } = useWorkItemMeta()
    expect(dynamicPriorityOptions.value).toEqual(fallbackPriorityOptions)
  })

  it('should return project priorities when metadata available', () => {
    const appStore = useAppStore()
    appStore.workItemPriorities = [
      { id: 'prio-1', project_id: 'p1', name: 'Critical' },
    ] as any
    appStore.selectedProjectId = 'p1'

    const { dynamicPriorityOptions } = useWorkItemMeta()
    expect(dynamicPriorityOptions.value).toEqual([
      { label: 'Critical', value: 'prio-1' },
    ])
  })

  it('getTypeLabel should return label from static options', () => {
    const { getTypeLabel } = useWorkItemMeta()
    expect(getTypeLabel('story')).toBe('用户故事')
    expect(getTypeLabel('bug')).toBe('缺陷')
  })

  it('getTypeLabel should fallback to metadata', () => {
    const appStore = useAppStore()
    appStore.workItemTypes = [
      { id: 'custom-id', project_id: 'p1', name: 'Custom' },
    ] as any

    const { getTypeLabel } = useWorkItemMeta()
    expect(getTypeLabel('custom-id')).toBe('Custom')
  })

  it('getPriorityLabel should return Chinese label', () => {
    const { getPriorityLabel } = useWorkItemMeta()
    expect(getPriorityLabel('High')).toBe('高')
    expect(getPriorityLabel('Medium')).toBe('中')
    expect(getPriorityLabel('Low')).toBe('低')
  })

  it('formatDate should format date string', () => {
    const { formatDate } = useWorkItemMeta()
    expect(formatDate('2024-03-15T00:00:00Z')).toMatch(/03-15/)
    expect(formatDate('')).toBe('-')
  })

  it('statesForType should filter by type', () => {
    const appStore = useAppStore()
    appStore.workItemStates = [
      { id: 's1', project_id: 'p1', work_item_type_id: 't1', name: 'Open' },
      { id: 's2', project_id: 'p1', work_item_type_id: 't2', name: 'Closed' },
    ] as any
    appStore.selectedProjectId = 'p1'

    const { statesForType } = useWorkItemMeta()
    const states = statesForType('t1')
    expect(states).toHaveLength(1)
    expect(states[0]?.name).toBe('Open')
  })

  it('effectiveStatesForType should fallback when no states', () => {
    const { effectiveStatesForType } = useWorkItemMeta()
    const states = effectiveStatesForType('nonexistent')
    expect(states.length).toBeGreaterThan(0)
    expect(states[0]?.name).toBe('待办')
  })
})

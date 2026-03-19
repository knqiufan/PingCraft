import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../app'

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

describe('useAppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('removeRequirement()', () => {
    it('should remove item at index', () => {
      const store = useAppStore()
      store.requirements = [
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
        { id: '3', title: 'C' },
      ] as any
      store.removeRequirement(1)
      expect(store.requirements).toHaveLength(2)
      expect(store.requirements[1]?.title).toBe('C')
    })
  })

  describe('updateRequirement()', () => {
    it('should merge patch into requirement', () => {
      const store = useAppStore()
      store.requirements = [
        { id: '1', title: 'A', priority: 'Low' },
      ] as any
      store.updateRequirement(0, { priority: 'High' } as any)
      expect(store.requirements[0]?.priority).toBe('High')
      expect(store.requirements[0]?.title).toBe('A')
    })

    it('should not modify when index is out of range', () => {
      const store = useAppStore()
      store.requirements = [{ id: '1', title: 'A' }] as any
      store.updateRequirement(5, { title: 'X' } as any)
      expect(store.requirements[0]?.title).toBe('A')
    })
  })

  describe('resetAnalysis()', () => {
    it('should reset all analysis state', () => {
      const store = useAppStore()
      store.requirements = [{ id: '1' }] as any
      store.selectedProjectId = 'p1'
      store.projects = [{ id: 'p1' }] as any

      store.resetAnalysis()

      expect(store.requirements).toEqual([])
      expect(store.selectedProjectId).toBe('')
      expect(store.projects).toEqual([])
    })
  })

  describe('uploadAndAnalyze()', () => {
    it('should set requirements from analyzeFile result', async () => {
      const { analyzeFile } = await import('@/api/analyze')
      ;(analyzeFile as any).mockResolvedValue({
        data: [{ id: '1', title: 'Req 1' }],
        record_id: 'rec-1',
      })

      const { matchProject } = await import('@/api/workItems')
      ;(matchProject as any).mockResolvedValue({ data: { matches: [], projectNames: [] } })

      const store = useAppStore()
      const file = new File(['content'], 'test.txt')
      await store.uploadAndAnalyze(file)

      expect(store.requirements).toEqual([{ id: '1', title: 'Req 1' }])
      expect(store.analyzing).toBe(false)
    })
  })

  describe('syncData()', () => {
    it('should toggle syncing state', async () => {
      const { syncData: syncDataApi } = await import('@/api/workItems')
      ;(syncDataApi as any).mockResolvedValue({
        data: { projects: 5, workItems: 10, addedProjects: 1, addedWorkItems: 2 },
      })

      const store = useAppStore()
      await store.syncData()

      expect(store.syncing).toBe(false)
    })
  })
})

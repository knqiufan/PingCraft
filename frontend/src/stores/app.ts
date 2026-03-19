import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  WorkItem,
  Project,
  WorkItemTypeMeta,
  WorkItemStateMeta,
  WorkItemPropertyMeta,
  WorkItemPriorityMeta,
  SyncedProjectMeta,
  SyncedWorkItemMeta,
  PingCodeUserInfo,
  MetadataOverview,
} from '@/api/types'
import { syncData as syncDataApi, matchProject, checkDuplicates, importItemsStream } from '@/api/workItems'
import {
  getWorkItemTypes,
  getWorkItemStates,
  getWorkItemProperties,
  getWorkItemPriorities,
  getSyncedProjects,
  getSyncedWorkItems,
  getUserInfo,
  getMetadataOverview,
} from '@/api/metadata'
import { analyzeFile } from '@/api/analyze'
import { restoreFromRecord } from '@/api/records'
import { ElMessage } from 'element-plus'

export const useAppStore = defineStore('app', () => {
  /* ---- state ---- */
  const requirements = ref<WorkItem[]>([])
  const projects = ref<Project[]>([])
  const selectedProjectId = ref('')
  const analyzing = ref(false)
  const syncing = ref(false)
  const importing = ref(false)
  /** 当前分析产生的导入记录 ID，用于导入完成后更新记录状态 */
  const currentRecordId = ref<string | undefined>(undefined)

  /** 导入进度信息 */
  const importProgress = ref<{ current: number; total: number; lastItem?: string } | null>(null)

  const syncedProjects = ref<SyncedProjectMeta[]>([])
  const syncedWorkItems = ref<SyncedWorkItemMeta[]>([])
  const workItemTypes = ref<WorkItemTypeMeta[]>([])
  const workItemStates = ref<WorkItemStateMeta[]>([])
  const workItemPriorities = ref<WorkItemPriorityMeta[]>([])
  const workItemProperties = ref<WorkItemPropertyMeta[]>([])
  const pingcodeUserInfo = ref<PingCodeUserInfo | null>(null)
  const metadataOverview = ref<MetadataOverview | null>(null)

  /* ---- actions ---- */

  /** 同步 PingCode 数据（增量同步，同步后刷新概览与列表） */
  async function syncData() {
    syncing.value = true
    try {
      const res = await syncDataApi()
      const d = res.data
      const addedP = d?.addedProjects ?? 0
      const addedW = d?.addedWorkItems ?? 0
      ElMessage.success(
        `同步完成：共 ${d?.projects ?? 0} 个项目、${d?.workItems ?? 0} 个工作项` +
          (addedP > 0 || addedW > 0 ? `（本次新增 ${addedP} 个项目、${addedW} 个工作项）` : '')
      )
      await fetchSyncedData()
    } catch {
      // 错误已由拦截器处理
    } finally {
      syncing.value = false
    }
  }

  /** 拉取已同步数据与概览（项目、工作项、概览数字） */
  async function fetchSyncedData() {
    try {
      const [projectsRes, workItemsRes, overviewRes, userRes] = await Promise.all([
        getSyncedProjects(),
        getSyncedWorkItems(),
        getMetadataOverview(),
        getUserInfo(),
      ])
      syncedProjects.value = projectsRes.data ?? []
      syncedWorkItems.value = workItemsRes.data ?? []
      metadataOverview.value = overviewRes.data ?? null
      pingcodeUserInfo.value = userRes.data ?? null
    } catch {
      // 静默失败，如未连接
    }
  }

  /** 按项目拉取元数据（类型、状态、属性、优先级），用于工作项表单 */
  async function fetchMetadata(projectId: string) {
    if (!projectId) return
    try {
      const [typesRes, statesRes, propsRes, prioRes] = await Promise.all([
        getWorkItemTypes(projectId),
        getWorkItemStates(projectId),
        getWorkItemProperties(projectId),
        getWorkItemPriorities(projectId),
      ])
      workItemTypes.value = typesRes.data ?? []
      workItemStates.value = statesRes.data ?? []
      workItemProperties.value = propsRes.data ?? []
      workItemPriorities.value = prioRes.data ?? []
    } catch {
      workItemTypes.value = []
      workItemStates.value = []
      workItemProperties.value = []
      workItemPriorities.value = []
    }
  }

  /** 拉取全部元数据（不按项目筛选），用于元数据管理面板 */
  async function fetchAllMetadata() {
    try {
      const [typesRes, statesRes, propsRes, prioRes] = await Promise.all([
        getWorkItemTypes(),
        getWorkItemStates(),
        getWorkItemProperties(),
        getWorkItemPriorities(),
      ])
      workItemTypes.value = typesRes.data ?? []
      workItemStates.value = statesRes.data ?? []
      workItemProperties.value = propsRes.data ?? []
      workItemPriorities.value = prioRes.data ?? []
    } catch {
      workItemTypes.value = []
      workItemStates.value = []
      workItemProperties.value = []
      workItemPriorities.value = []
    }
  }

  /** 上传文件并分析需求 */
  async function uploadAndAnalyze(file: File) {
    analyzing.value = true
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await analyzeFile(formData)
      requirements.value = res.data || []
      // 保存导入记录 ID，用于后续导入时更新记录状态
      currentRecordId.value = res.record_id
      await autoMatchProject()
    } catch {
      // 错误已由拦截器处理
    } finally {
      analyzing.value = false
    }
  }

  /** 自动匹配项目 */
  async function autoMatchProject() {
    if (!requirements.value.length) return
    try {
      const res = await matchProject(requirements.value)
      const matches = res.data?.matches || []
      const projectNames = res.data?.projectNames || []
      
      if (matches.length) {
        projects.value = matches
        const first = matches[0]
        if (first) {
          selectedProjectId.value = first.id
          await fetchMetadata(first.id)
        }
        await checkDuplicateItems()
      } else if (projectNames.length > 0) {
        // 识别到项目名称但未匹配到 PingCode 项目
        ElMessage.warning(`识别到 ${projectNames.length} 个项目，但未找到匹配的 PingCode 项目，请手动选择`)
      }
    } catch {
      // 错误已由拦截器处理
    }
  }

  /** 检查重复工作项 */
  async function checkDuplicateItems() {
    if (!selectedProjectId.value || !requirements.value.length) return
    try {
      const res = await checkDuplicates(requirements.value, selectedProjectId.value)
      requirements.value = res.data?.items || requirements.value
    } catch {
      // 错误已由拦截器处理
    }
  }

  /** 删除某条需求 */
  function removeRequirement(index: number) {
    requirements.value.splice(index, 1)
  }

  /** 更新某条需求的字段（如 type_id、priority_id、state_id） */
  function updateRequirement(index: number, patch: Partial<WorkItem>) {
    if (index < 0 || index >= requirements.value.length) return
    const current = requirements.value[index]
    requirements.value[index] = { ...current, ...patch } as WorkItem
  }

  /** 批量导入到 PingCode（使用 SSE 实时进度） */
  async function importToPingCode() {
    if (!selectedProjectId.value) return
    importing.value = true
    importProgress.value = { current: 0, total: requirements.value.length }

    const isNewProject = selectedProjectId.value?.startsWith('new:')
    const projectId = isNewProject ? '' : selectedProjectId.value

    return new Promise<void>((resolve) => {
      importItemsStream(
        requirements.value,
        projectId,
        currentRecordId.value,
        {
          onProgress(data) {
            importProgress.value = {
              current: data.current,
              total: data.total,
              lastItem: data.title,
            }
          },
          onProjectCreated(data) {
            ElMessage.info(`自动创建了项目: ${data.name}`)
          },
          onComplete(data) {
            const result = data.result
            ElMessage.success(`成功导入 ${result?.success ?? 0} 个工作项`)
            if (result?.failed && result.failed > 0) {
              ElMessage.warning(`${result.failed} 个工作项导入失败`)
            }
            requirements.value = []
            selectedProjectId.value = ''
            projects.value = []
            currentRecordId.value = undefined
            importProgress.value = null
            importing.value = false
            fetchSyncedData()
            resolve()
          },
          onError(data) {
            ElMessage.error(data.message || '导入失败')
            importProgress.value = null
            importing.value = false
            resolve()
          },
        }
      )
    })
  }

  /** 从导入记录恢复分析结果 */
  async function restoreAnalysis(recordId: string) {
    analyzing.value = true
    try {
      const res = await restoreFromRecord(recordId)
      const data = res.data
      if (!data?.requirements?.length) {
        ElMessage.warning('该记录没有可恢复的工作项')
        return
      }
      requirements.value = data.requirements
      currentRecordId.value = data.record_id

      if (data.target_project_id) {
        selectedProjectId.value = data.target_project_id
        await fetchMetadata(data.target_project_id)
      }

      ElMessage.success(`已恢复 ${data.requirements.length} 个工作项`)
    } catch {
      // 错误已由拦截器处理
    } finally {
      analyzing.value = false
    }
  }

  /** 重置分析结果 */
  function resetAnalysis() {
    requirements.value = []
    selectedProjectId.value = ''
    projects.value = []
    currentRecordId.value = undefined
  }

  return {
    requirements,
    projects,
    selectedProjectId,
    analyzing,
    syncing,
    importing,
    importProgress,
    syncedProjects,
    syncedWorkItems,
    workItemTypes,
    workItemStates,
    workItemPriorities,
    workItemProperties,
    pingcodeUserInfo,
    metadataOverview,
    syncData,
    fetchSyncedData,
    fetchMetadata,
    fetchAllMetadata,
    uploadAndAnalyze,
    autoMatchProject,
    checkDuplicateItems,
    removeRequirement,
    updateRequirement,
    importToPingCode,
    restoreAnalysis,
    resetAnalysis,
  }
})

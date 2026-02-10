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
import { syncData as syncDataApi, matchProject, checkDuplicates, importItems } from '@/api/workItems'
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
import { ElMessage } from 'element-plus'

export const useAppStore = defineStore('app', () => {
  /* ---- state ---- */
  const requirements = ref<WorkItem[]>([])
  const projects = ref<Project[]>([])
  const selectedProjectId = ref('')
  const analyzing = ref(false)
  const syncing = ref(false)
  const importing = ref(false)

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

  /** 批量导入到 PingCode */
  async function importToPingCode() {
    if (!selectedProjectId.value) return
    importing.value = true
    try {
      const res = await importItems(requirements.value, selectedProjectId.value)
      const result = res.data?.result
      
      // 提示自动创建的项目
      if (result?.createdProjects && result.createdProjects.length > 0) {
        const names = result.createdProjects.map((p) => p.name).join('、')
        ElMessage.info(`自动创建了项目: ${names}`)
      }
      
      ElMessage.success(`成功导入 ${result?.success ?? 0} 个工作项`)
      if (result?.failed && result.failed > 0) {
        ElMessage.warning(`${result.failed} 个工作项导入失败`)
      }
      requirements.value = []
      selectedProjectId.value = ''
      projects.value = []
      
      // 刷新同步数据以显示新创建的项目
      await fetchSyncedData()
    } catch {
      // 错误已由拦截器处理
    } finally {
      importing.value = false
    }
  }

  /** 重置分析结果 */
  function resetAnalysis() {
    requirements.value = []
    selectedProjectId.value = ''
    projects.value = []
  }

  return {
    requirements,
    projects,
    selectedProjectId,
    analyzing,
    syncing,
    importing,
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
    resetAnalysis,
  }
})

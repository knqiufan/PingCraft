<template>
  <el-card class="work-item-card">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <span class="card-title">
            <el-icon><List /></el-icon>
            工作项列表（{{ appStore.requirements.length }} 条）
          </span>
          <el-button-group size="small" class="view-toggle">
            <el-button :type="groupByProject ? '' : 'primary'" @click="groupByProject = false">
              列表视图
            </el-button>
            <el-button :type="groupByProject ? 'primary' : ''" @click="groupByProject = true">
              项目分组
            </el-button>
          </el-button-group>
        </div>
        <div class="header-right">
          <el-button
            text
            type="warning"
            :icon="EditPen"
            :disabled="!appStore.requirements.length"
            @click="batchDialogVisible = true"
          >
            批量编辑
          </el-button>
          <el-button
            text
            type="primary"
            :icon="Plus"
            @click="addDialogVisible = true"
          >
            手动添加
          </el-button>
          <el-button
            type="primary"
            :icon="Upload"
            :loading="appStore.importing"
            :disabled="!appStore.selectedProjectId || !appStore.requirements.length"
            @click="appStore.importToPingCode"
          >
            导入到 PingCode
          </el-button>
        </div>
      </div>
    </template>

    <!-- 导入进度条 -->
    <div v-if="appStore.importProgress" class="import-progress">
      <el-progress
        :percentage="progressPercent"
        :format="progressFormat"
        :stroke-width="20"
        text-inside
      />
      <p class="progress-hint">
        正在导入: {{ appStore.importProgress.lastItem || '...' }}
        （{{ appStore.importProgress.current }} / {{ appStore.importProgress.total }}）
      </p>
    </div>

    <!-- 分组视图 -->
    <WorkItemGroupView
      v-if="groupByProject"
      :items="appStore.requirements"
      :default-assignee="appStore.pingcodeUserInfo?.display_name"
      @detail="openDetailDrawer"
      @edit="openEditDialog"
      @remove="removeItem"
      @update-row="handleUpdateRow"
    />

    <!-- 列表视图 -->
    <WorkItemListView
      v-else
      :items="appStore.requirements"
      :default-assignee="appStore.pingcodeUserInfo?.display_name"
      @detail="openDetailDrawer"
      @edit="openEditDialog"
      @remove="removeItem"
      @update="handleUpdateByIndex"
    />

    <!-- 解决方案建议对话框 -->
    <el-dialog
      v-model="solutionDialogVisible"
      title="解决方案建议"
      width="600px"
      class="solution-dialog"
    >
      <div v-if="currentSolution" class="solution-content">
        <h4 class="solution-title">{{ currentSolution.title }}</h4>
        <div class="solution-text">{{ currentSolution.suggestion }}</div>
      </div>
      <template #footer>
        <el-button type="primary" @click="solutionDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 手动添加需求对话框 -->
    <WorkItemAddDialog
      v-model:visible="addDialogVisible"
      :default-project-name="defaultProjectName"
      @add="handleAddItem"
    />

    <!-- 编辑工作项对话框 -->
    <WorkItemEditDialog
      v-model:visible="editDialogVisible"
      :item="editItem"
      @save="handleSaveEdit"
    />

    <!-- 工作项详情抽屉 -->
    <WorkItemDetailDrawer
      v-model:visible="detailDrawerVisible"
      :item="detailItem"
      :default-assignee="appStore.pingcodeUserInfo?.display_name"
      @edit="handleDetailEdit"
    />

    <!-- 批量编辑对话框（P3-5.3） -->
    <el-dialog v-model="batchDialogVisible" title="批量编辑工作项" width="500px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        将以下设置应用到全部 {{ appStore.requirements.length }} 个工作项。留空/不选的字段不会被修改。
      </el-alert>
      <el-form label-width="90px">
        <el-form-item label="工作项类型">
          <el-select v-model="batchForm.type_id" clearable placeholder="不修改" style="width: 100%">
            <el-option
              v-for="t in appStore.workItemTypes"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="batchForm.priority" clearable placeholder="不修改" style="width: 100%">
            <el-option label="High" value="High" />
            <el-option label="Medium" value="Medium" />
            <el-option label="Low" value="Low" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="batchForm.assignee_name" clearable placeholder="不修改" />
        </el-form-item>
        <el-form-item label="项目名称">
          <el-input v-model="batchForm.project_name" clearable placeholder="不修改" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="applyBatchEdit">应用</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { List, Upload, Plus, EditPen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import type { WorkItem } from '@/api/types'

// 子组件
import WorkItemListView from './WorkItemListView.vue'
import WorkItemGroupView from './WorkItemGroupView.vue'
import WorkItemAddDialog from './WorkItemAddDialog.vue'
import WorkItemEditDialog from './WorkItemEditDialog.vue'
import WorkItemDetailDrawer from './WorkItemDetailDrawer.vue'

const appStore = useAppStore()

// 视图切换
const groupByProject = ref(false)

// 解决方案对话框
const solutionDialogVisible = ref(false)
const currentSolution = ref<{ title: string; suggestion: string } | null>(null)

// 添加对话框
const addDialogVisible = ref(false)

// 编辑对话框
const editDialogVisible = ref(false)
const editItem = ref<WorkItem | null>(null)
const editingIndex = ref(-1)

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailItem = ref<WorkItem | null>(null)

const progressPercent = computed(() => {
  const p = appStore.importProgress
  if (!p || !p.total) return 0
  return Math.round((p.current / p.total) * 100)
})

function progressFormat(percentage: number) {
  return `${percentage}%`
}

/** 默认项目名称（用于添加对话框） */
const defaultProjectName = computed(() => {
  return appStore.requirements[0]?.project_name || ''
})

/** 删除工作项 */
function removeItem(id?: string) {
  const index = appStore.requirements.findIndex((item) => item.id === id)
  if (index !== -1) {
    appStore.removeRequirement(index)
  }
}

/** 打开编辑对话框 */
function openEditDialog(item: WorkItem) {
  editingIndex.value = appStore.requirements.findIndex((r) => r.id === item.id)
  if (editingIndex.value === -1) return
  editItem.value = { ...item }
  editDialogVisible.value = true
}

/** 保存编辑 */
function handleSaveEdit(item: WorkItem) {
  if (editingIndex.value !== -1) {
    appStore.updateRequirement(editingIndex.value, {
      project_name: item.project_name,
      title: item.title,
      description: item.description,
      type_id: item.type_id,
      priority: item.priority,
      assignee_name: item.assignee_name,
      estimated_hours: item.estimated_hours,
      start_at: item.start_at,
      solution_suggestion: item.solution_suggestion,
    })
    ElMessage.success('保存成功')
  }
}

/** 打开详情抽屉 */
function openDetailDrawer(item: WorkItem) {
  detailItem.value = item
  detailDrawerVisible.value = true
}

/** 从详情抽屉触发编辑 */
function handleDetailEdit(item: WorkItem) {
  openEditDialog(item)
}

/** 添加新工作项 */
function handleAddItem(item: WorkItem) {
  appStore.requirements.push(item)
  ElMessage.success('添加成功')
}

/** 通过索引更新字段（列表视图使用） */
function handleUpdateByIndex(index: number, field: string, value: string) {
  appStore.updateRequirement(index, { [field]: value })
}

/** 通过行数据更新字段（分组视图使用） */
function handleUpdateRow(row: WorkItem, field: keyof WorkItem, value: string) {
  const index = appStore.requirements.findIndex((item) => item.id === row.id)
  if (index !== -1) {
    appStore.updateRequirement(index, { [field]: value })
  }
}

/** 批量编辑（P3-5.3） */
const batchDialogVisible = ref(false)
const batchForm = reactive<{ type_id: string; priority: string; assignee_name: string; project_name: string }>({
  type_id: '',
  priority: '',
  assignee_name: '',
  project_name: '',
})

function applyBatchEdit() {
  const patch: Partial<WorkItem> = {}
  if (batchForm.type_id) patch.type_id = batchForm.type_id
  if (batchForm.priority) patch.priority = batchForm.priority
  if (batchForm.assignee_name) patch.assignee_name = batchForm.assignee_name
  if (batchForm.project_name) patch.project_name = batchForm.project_name

  if (Object.keys(patch).length === 0) {
    ElMessage.warning('请至少填写一个要修改的字段')
    return
  }

  appStore.requirements.forEach((_, index) => {
    appStore.updateRequirement(index, patch)
  })

  ElMessage.success(`已批量更新 ${appStore.requirements.length} 个工作项`)
  // 重置表单
  batchForm.type_id = ''
  batchForm.priority = ''
  batchForm.assignee_name = ''
  batchForm.project_name = ''
  batchDialogVisible.value = false
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.work-item-card {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.view-toggle {
  margin-left: $spacing-sm;
}

.import-progress {
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  background-color: $bg-section;
  border-radius: 8px;

  .progress-hint {
    margin-top: 8px;
    font-size: $font-size-sm;
    color: $text-secondary;
    text-align: center;
  }
}

.solution-dialog {
  .solution-content {
    padding: $spacing-md 0;
  }

  .solution-title {
    font-size: $font-size-lg;
    font-weight: 600;
    color: $text-primary;
    margin-bottom: $spacing-md;
  }

  .solution-text {
    font-size: $font-size-base;
    color: $text-secondary;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>

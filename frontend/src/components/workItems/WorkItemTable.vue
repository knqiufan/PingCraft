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
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { List, Upload, Plus } from '@element-plus/icons-vue'
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

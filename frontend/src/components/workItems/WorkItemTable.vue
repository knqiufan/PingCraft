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
    </template>

    <!-- 分组视图 -->
    <div v-if="groupByProject" class="grouped-view">
      <div v-for="(items, projectName) in groupedRequirements" :key="projectName" class="project-group">
        <div class="group-header">
          <el-tag type="info" size="large">{{ projectName }}</el-tag>
          <span class="group-count">{{ items.length }} 个工作项</span>
        </div>
        <el-table :data="items" stripe class="item-table">
          <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column label="类型" width="110" align="center">
            <template #default="{ row }">
              <el-select
                :model-value="row.type_id"
                placeholder="类型"
                size="small"
                clearable
                class="cell-select"
                @change="(v: string) => updateRowField(row, 'type_id', v)"
              >
                <el-option
                  v-for="t in typesForProject"
                  :key="t.id"
                  :label="t.name"
                  :value="t.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="优先级" width="110" align="center">
            <template #default="{ row }">
              <el-select
                :model-value="row.priority_id"
                placeholder="优先级"
                size="small"
                clearable
                class="cell-select"
                @change="(v: string) => updateRowField(row, 'priority_id', v)"
              >
                <el-option
                  v-for="p in prioritiesForProject"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-select
                :model-value="row.state_id"
                placeholder="状态"
                size="small"
                clearable
                class="cell-select"
                @change="(v: string) => updateRowField(row, 'state_id', v)"
              >
                <el-option
                  v-for="s in statesForType(row.type_id)"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="负责人" width="100" align="center">
            <template #default>
              <span class="assignee-text">{{ appStore.pingcodeUserInfo?.display_name || appStore.pingcodeUserInfo?.name || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="预估工时" width="100" align="center">
            <template #default="{ row }">{{ row.estimated_hours }}h</template>
          </el-table-column>
          <el-table-column label="开始时间" width="110" align="center">
            <template #default="{ row }">{{ formatDate(row.start_at) }}</template>
          </el-table-column>
          <el-table-column label="匹配状态" width="180">
            <template #default="{ row }">
              <el-tag v-if="row.match" type="warning" size="small">
                相似: {{ row.match.title }}
              </el-tag>
              <el-tag v-else type="success" size="small">新需求</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ row }">
              <el-button
                text
                type="danger"
                size="small"
                @click="removeItem(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 列表视图 -->
    <el-table
      v-else
      :data="appStore.requirements"
      stripe
      class="item-table"
    >
      <el-table-column prop="project_name" label="项目" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tag type="info" size="small" effect="plain">
            {{ row.project_name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="类型" width="110" align="center">
        <template #default="{ row, $index }">
          <el-select
            :model-value="row.type_id"
            placeholder="类型"
            size="small"
            clearable
            class="cell-select"
            @change="(v: string) => appStore.updateRequirement($index, { type_id: v })"
          >
            <el-option
              v-for="t in typesForProject"
              :key="t.id"
              :label="t.name"
              :value="t.id"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="优先级" width="110" align="center">
        <template #default="{ row, $index }">
          <el-select
            :model-value="row.priority_id"
            placeholder="优先级"
            size="small"
            clearable
            class="cell-select"
            @change="(v: string) => appStore.updateRequirement($index, { priority_id: v })"
          >
            <el-option
              v-for="p in prioritiesForProject"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row, $index }">
          <el-select
            :model-value="row.state_id"
            placeholder="状态"
            size="small"
            clearable
            class="cell-select"
            @change="(v: string) => appStore.updateRequirement($index, { state_id: v })"
          >
            <el-option
              v-for="s in statesForType(row.type_id)"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="负责人" width="100" align="center">
        <template #default>
          <span class="assignee-text">{{ appStore.pingcodeUserInfo?.display_name || appStore.pingcodeUserInfo?.name || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="预估工时" width="100" align="center">
        <template #default="{ row }">
          {{ row.estimated_hours }}h
        </template>
      </el-table-column>
      <el-table-column label="开始时间" width="110" align="center">
        <template #default="{ row }">
          {{ formatDate(row.start_at) }}
        </template>
      </el-table-column>
      <el-table-column label="匹配状态" width="180">
        <template #default="{ row }">
          <el-tag v-if="row.match" type="warning" size="small">
            相似: {{ row.match.title }}
          </el-tag>
          <el-tag v-else type="success" size="small">
            新需求
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" align="center" fixed="right">
        <template #default="{ row, $index }">
          <el-button
            text
            type="danger"
            size="small"
            @click="removeItem(row.id)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { List, Upload } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { WorkItem } from '@/api/types'
import type { WorkItemPriorityMeta, WorkItemStateMeta } from '@/api/types'

const appStore = useAppStore()
const groupByProject = ref(false)

const groupedRequirements = computed(() => {
  const groups: Record<string, WorkItem[]> = {}
  appStore.requirements.forEach(item => {
    const projectName = item.project_name || '未分类'
    if (!groups[projectName]) {
      groups[projectName] = []
    }
    groups[projectName].push(item)
  })
  return groups
})

const typesForProject = computed(() => {
  const pid = appStore.selectedProjectId
  if (!pid) return []
  return appStore.workItemTypes.filter((t: { project_id: string }) => t.project_id === pid)
})

const prioritiesForProject = computed(() => {
  const pid = appStore.selectedProjectId
  if (!pid) return []
  return appStore.workItemPriorities.filter((p: WorkItemPriorityMeta) => p.project_id === pid)
})

function statesForType(typeId: string | undefined): WorkItemStateMeta[] {
  const pid = appStore.selectedProjectId
  if (!pid) return []
  const list = appStore.workItemStates.filter(
    (s: WorkItemStateMeta) => s.project_id === pid && (!typeId || s.work_item_type_id === typeId)
  )
  return list
}

function updateRowField(row: WorkItem, field: keyof WorkItem, value: string) {
  const index = appStore.requirements.findIndex(item => item.id === row.id)
  if (index !== -1) {
    appStore.updateRequirement(index, { [field]: value })
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

function removeItem(id?: string) {
  const index = appStore.requirements.findIndex(item => item.id === id)
  if (index !== -1) {
    appStore.removeRequirement(index)
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

.item-table {
  width: 100%;
}

.grouped-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.project-group {
  border: 1px solid $border-color;
  border-radius: 4px;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  background-color: $bg-section;
  border-bottom: 1px solid $border-color;
}

.group-count {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.cell-select {
  width: 100%;
}

.assignee-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}
</style>

<template>
  <div class="grouped-view">
    <div v-for="(items, projectName) in groupedItems" :key="projectName" class="project-group">
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
              @change="(v: string) => handleRowFieldChange(row, 'type_id', v)"
            >
              <el-option
                v-for="t in effectiveTypesForProject"
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
              @change="(v: string) => handleRowFieldChange(row, 'priority_id', v)"
            >
              <el-option
                v-for="p in effectivePrioritiesForProject"
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
              @change="(v: string) => handleRowFieldChange(row, 'state_id', v)"
            >
              <el-option
                v-for="s in effectiveStatesForType(row.type_id)"
                :key="s.id"
                :label="s.name"
                :value="s.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="100" align="center">
          <template #default="{ row }">
            <span class="assignee-text">{{ row.assignee_name || defaultAssignee || '-' }}</span>
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
            <MatchStatusTag :match="row.match" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="$emit('detail', row)">
              详情
            </el-button>
            <el-button text type="warning" size="small" @click="$emit('edit', row)">
              编辑
            </el-button>
            <el-button text type="danger" size="small" @click="$emit('remove', row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkItem } from '@/api/types'
import { useWorkItemMeta } from './composables/useWorkItemMeta'
import MatchStatusTag from './MatchStatusTag.vue'

const props = defineProps<{
  items: WorkItem[]
  defaultAssignee?: string
}>()

const emit = defineEmits<{
  (e: 'detail', item: WorkItem): void
  (e: 'edit', item: WorkItem): void
  (e: 'remove', id: string): void
  (e: 'updateRow', row: WorkItem, field: keyof WorkItem, value: string): void
}>()

const {
  effectiveTypesForProject,
  effectivePrioritiesForProject,
  effectiveStatesForType,
  formatDate,
} = useWorkItemMeta()

/** 按项目名称分组 */
const groupedItems = computed(() => {
  const groups: Record<string, WorkItem[]> = {}
  props.items.forEach((item) => {
    const projectName = item.project_name || '未分类'
    if (!groups[projectName]) {
      groups[projectName] = []
    }
    groups[projectName].push(item)
  })
  return groups
})

function handleRowFieldChange(row: WorkItem, field: keyof WorkItem, value: string) {
  emit('updateRow', row, field, value)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.grouped-view {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.project-group {
  border: 1px solid $border-color;
  border-radius: $border-radius;
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

.item-table {
  width: 100%;
}

.cell-select {
  width: 100%;
}

.assignee-text {
  font-size: $font-size-sm;
  color: $text-secondary;
}
</style>

<template>
  <el-table :data="items" stripe class="item-table">
    <el-table-column prop="project_name" label="项目" width="200" show-overflow-tooltip>
      <template #default="{ row }">
        <el-tag type="info" size="small" effect="plain">
          {{ row.project_name }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
    <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
    <el-table-column label="类型" width="110" align="center">
      <template #default="{ row, $index }">
        <el-select
          :model-value="row.type_id"
          placeholder="类型"
          size="small"
          clearable
          class="cell-select"
          @change="(v: string) => handleFieldChange($index, 'type_id', v)"
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
      <template #default="{ row, $index }">
        <el-select
          :model-value="row.priority_id"
          placeholder="优先级"
          size="small"
          clearable
          class="cell-select"
          @change="(v: string) => handleFieldChange($index, 'priority_id', v)"
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
      <template #default="{ row, $index }">
        <el-select
          :model-value="row.state_id"
          placeholder="状态"
          size="small"
          clearable
          class="cell-select"
          @change="(v: string) => handleFieldChange($index, 'state_id', v)"
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
</template>

<script setup lang="ts">
import type { WorkItem } from '@/api/types'
import { useWorkItemMeta } from './composables/useWorkItemMeta'
import MatchStatusTag from './MatchStatusTag.vue'

defineProps<{
  items: WorkItem[]
  defaultAssignee?: string
}>()

const emit = defineEmits<{
  (e: 'detail', item: WorkItem): void
  (e: 'edit', item: WorkItem): void
  (e: 'remove', id: string): void
  (e: 'update', index: number, field: string, value: string): void
}>()

const {
  effectiveTypesForProject,
  effectivePrioritiesForProject,
  effectiveStatesForType,
  formatDate,
} = useWorkItemMeta()

function handleFieldChange(index: number, field: string, value: string) {
  emit('update', index, field, value)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

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

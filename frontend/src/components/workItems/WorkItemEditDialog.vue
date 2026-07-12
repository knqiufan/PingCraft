<template>
  <el-dialog
    :model-value="visible"
    title="编辑工作项"
    width="700px"
    class="edit-dialog"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form v-if="formData" :model="formData" label-width="100px" class="edit-form">
      <el-form-item label="项目名称">
        <el-input v-model="formData.project_name" placeholder="项目名称" />
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="formData.title" placeholder="工作项标题" />
      </el-form-item>
      <el-form-item label="详细描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="详细描述"
        />
      </el-form-item>
      <el-form-item label="类型">
        <el-select
          v-model="formData.type_id"
          placeholder="请选择类型"
          style="width: 100%"
          @change="handleTypeChange"
        >
          <el-option
            v-for="t in dynamicTypeOptions"
            :key="t.value"
            :label="t.label"
            :value="t.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级">
        <el-select v-model="formData.priority_id" placeholder="请选择优先级" style="width: 100%">
          <el-option
            v-for="p in dynamicPriorityOptions"
            :key="p.value"
            :label="p.label"
            :value="p.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="formData.state_id" placeholder="请选择状态" style="width: 100%">
          <el-option
            v-for="s in stateOptions"
            :key="s.id"
            :label="s.name"
            :value="s.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="负责人">
        <el-input v-model="formData.assignee_name" placeholder="负责人姓名" />
      </el-form-item>
      <el-form-item label="预估工时">
        <el-input-number
          v-model="formData.estimated_hours"
          :min="0"
          :step="1"
          placeholder="小时"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="开始时间">
        <el-date-picker
          v-model="formData.start_at"
          type="date"
          placeholder="选择日期"
          value-format="YYYY-MM-DDTHH:mm:ss.sssZ"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="解决方案建议">
        <el-input
          v-model="formData.solution_suggestion"
          type="textarea"
          :rows="3"
          placeholder="解决方案建议"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { WorkItem } from '@/api/types'
import { useWorkItemMeta } from './composables/useWorkItemMeta'
import { priorityIdToText, resolveStateId, resolveStateLabel } from '@/utils/workItemFields'
import { useAppStore } from '@/stores/app'

const { dynamicTypeOptions, dynamicPriorityOptions, effectiveStatesForType } = useWorkItemMeta()
const appStore = useAppStore()

const props = defineProps<{
  visible: boolean
  item: WorkItem | null
  defaultAssignee?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', item: WorkItem): void
}>()

const formData = ref<WorkItem | null>(null)

const stateOptions = computed(() => effectiveStatesForType(formData.value?.type_id))

function buildFormData(item: WorkItem): WorkItem {
  return {
    ...item,
    priority_id: item.priority_id || item.priority,
    assignee_name: item.assignee_name || props.defaultAssignee || null,
    state_id:
      item.state_id ||
      resolveStateId(undefined, item.type_id, appStore.workItemStates, item.state),
  }
}

watch(
  () => props.item,
  (newItem) => {
    formData.value = newItem ? buildFormData(newItem) : null
  },
  { immediate: true }
)

function handleTypeChange(typeId: string) {
  if (!formData.value) return
  formData.value.state_id = resolveStateId(undefined, typeId, appStore.workItemStates, formData.value.state)
}

function handleClose() {
  emit('update:visible', false)
}

function handleSave() {
  if (!formData.value) return
  if (!formData.value.title) {
    ElMessage.warning('标题不能为空')
    return
  }
  const priority_id = formData.value.priority_id
  formData.value.priority = priorityIdToText(priority_id, appStore.workItemPriorities)
  formData.value.state = resolveStateLabel(
    formData.value.state_id,
    null,
    appStore.workItemStates
  )
  emit('save', formData.value)
  handleClose()
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.edit-dialog {
  .edit-form {
    padding: $spacing-sm 0;
  }
}
</style>

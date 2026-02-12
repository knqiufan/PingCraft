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
        <el-select v-model="formData.type_id" placeholder="请选择类型" style="width: 100%">
          <el-option
            v-for="t in typeOptions"
            :key="t.value"
            :label="t.label"
            :value="t.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="优先级">
        <el-select v-model="formData.priority" placeholder="请选择优先级" style="width: 100%">
          <el-option label="高" value="High" />
          <el-option label="中" value="Medium" />
          <el-option label="低" value="Low" />
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
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { WorkItem } from '@/api/types'
import { typeOptions } from './composables/useWorkItemMeta'

const props = defineProps<{
  visible: boolean
  item: WorkItem | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save', item: WorkItem): void
}>()

const formData = ref<WorkItem | null>(null)

// 监听 item 变化，深拷贝数据
watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      formData.value = { ...newItem }
    } else {
      formData.value = null
    }
  },
  { immediate: true }
)

function handleClose() {
  emit('update:visible', false)
}

function handleSave() {
  if (!formData.value) return
  if (!formData.value.title) {
    ElMessage.warning('标题不能为空')
    return
  }
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

<template>
  <el-dialog
    :model-value="visible"
    title="手动添加需求"
    width="700px"
    class="add-dialog"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form :model="formData" label-width="100px" class="add-form">
      <el-form-item label="项目名称" required>
        <el-input
          v-model="formData.project_name"
          placeholder="请输入项目名称"
        />
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input
          v-model="formData.title"
          placeholder="请输入工作项标题"
        />
      </el-form-item>
      <el-form-item label="详细描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="4"
          placeholder="请输入详细描述"
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
      <el-form-item label="预估工时">
        <el-input-number
          v-model="formData.estimated_hours"
          :min="0"
          :step="1"
          placeholder="小时"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleAdd">确定</el-button>
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
  defaultProjectName?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'add', item: WorkItem): void
}>()

/** 创建默认表单数据 */
function createDefaultFormData(): WorkItem {
  return {
    project_name: props.defaultProjectName || '',
    title: '',
    description: '',
    priority: 'Medium',
    estimated_hours: 8,
    start_at: new Date().toISOString(),
    type_id: 'story',
    status: 'new',
  }
}

const formData = ref<WorkItem>(createDefaultFormData())

// 监听 visible 变化，重置表单
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible) {
      formData.value = createDefaultFormData()
    }
  }
)

function handleClose() {
  emit('update:visible', false)
}

function handleAdd() {
  if (!formData.value.title || !formData.value.project_name) {
    ElMessage.warning('请填写项目名称和标题')
    return
  }

  const newItem: WorkItem = {
    ...formData.value,
    id: crypto.randomUUID(),
    match: null,
  }

  emit('add', newItem)
  handleClose()
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.add-dialog {
  .add-form {
    padding: $spacing-sm 0;
  }
}
</style>

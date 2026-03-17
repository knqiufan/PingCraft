<template>
  <el-card class="model-management">
    <template #header>
      <div class="card-header">
        <span>LLM 模型配置</span>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          新增配置
        </el-button>
      </div>
    </template>

    <el-table :data="configs" stripe style="width: 100%" v-loading="loading">
      <el-table-column prop="name" label="配置名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="provider" label="提供商" width="120">
        <template #default="{ row }">
          <el-tag :type="row.provider === 'openai' ? 'success' : 'warning'" size="small">
            {{ row.provider === 'openai' ? 'OpenAI' : 'Anthropic' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="model" label="模型" width="150" show-overflow-tooltip />
      <el-table-column prop="base_url" label="API 地址" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.base_url || '默认' }}
        </template>
      </el-table-column>
      <el-table-column prop="temperature" label="温度" width="80" align="center">
        <template #default="{ row }">{{ row.temperature ?? 0 }}</template>
      </el-table-column>
      <el-table-column prop="is_default" label="默认" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_default" type="primary" size="small">是</el-tag>
          <el-tag type="info" v-else>否</el-tag >
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            text
            type="info"
            size="small"
            :loading="testingId === row.id"
            @click="testConnection(row)"
          >
            测试连接
          </el-button>
          <el-button text type="primary" size="small" @click="editConfig(row)">
            编辑
          </el-button>
          <el-button
            v-if="!row.is_default"
            text
            type="success"
            size="small"
            @click="setDefault(row)"
          >
            设为默认
          </el-button>
          <el-button text type="danger" size="small" @click="deleteConfig(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="!configs.length && !loading" class="empty-tip">
      暂无模型配置，请点击「新增配置」添加
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑模型配置' : '新增模型配置'"
      width="600px"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="配置名称" prop="name">
          <el-input v-model="formData.name" placeholder="如: DeepSeek Chat" />
        </el-form-item>
        <el-form-item label="提供商" prop="provider">
          <el-select v-model="formData.provider" placeholder="请选择" style="width: 100%">
            <el-option label="OpenAI 兼容" value="openai" />
            <el-option label="Anthropic" value="anthropic" />
          </el-select>
        </el-form-item>
        <el-form-item label="API 密钥" prop="api_key">
          <el-input v-model="formData.api_key" type="password" show-password placeholder="请输入 API 密钥" />
        </el-form-item>
        <el-form-item label="API 地址" prop="base_url">
          <el-input v-model="formData.base_url" placeholder="留空使用默认地址" />
        </el-form-item>
        <el-form-item label="模型名称" prop="model">
          <el-input v-model="formData.model" placeholder="如: deepseek-chat, gpt-4" />
        </el-form-item>
        <el-form-item label="温度">
          <el-slider v-model="formData.temperature" :min="0" :max="2" :step="0.1" show-input />
        </el-form-item>
        <el-form-item label="最大 Tokens">
          <el-input-number v-model="formData.max_tokens" :min="1" placeholder="留空使用默认值" style="width: 100%" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="formData.is_default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          :loading="testingInDialog"
          :disabled="!formData.api_key || !formData.model"
          @click="testConnectionInDialog"
        >
          测试连接
        </el-button>
        <el-button type="primary" :loading="saving" @click="saveConfig">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  getModelConfigs,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig as deleteModelConfigApi,
  testModelConfig,
  testModelConfigByBody,
  type ModelConfig,
  type ModelConfigRequest,
} from '@/api/models'

const loading = ref(false)
const configs = ref<ModelConfig[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const testingId = ref<string | null>(null)
const testingInDialog = ref(false)
const formRef = ref<FormInstance>()

const formData = reactive<ModelConfigRequest>({
  name: '',
  provider: 'openai',
  api_key: '',
  base_url: '',
  model: '',
  temperature: 0,
  max_tokens: undefined,
  is_default: false,
})

const rules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  api_key: [{ required: true, message: '请输入 API 密钥', trigger: 'blur' }],
  model: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
}

async function loadConfigs() {
  loading.value = true
  try {
    const res = await getModelConfigs()
    configs.value = res.data || []
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEdit.value = false
  currentEditId.value = undefined
  Object.assign(formData, {
    name: '',
    provider: 'openai',
    api_key: '',
    base_url: '',
    model: '',
    temperature: 0,
    max_tokens: undefined,
    is_default: false,
  })
  dialogVisible.value = true
}

function editConfig(config: ModelConfig) {
  isEdit.value = true
  currentEditId.value = config.id
  Object.assign(formData, {
    name: config.name,
    provider: config.provider,
    api_key: config.api_key,
    base_url: config.base_url || '',
    model: config.model,
    temperature: config.temperature ?? 0,
    max_tokens: config.max_tokens ?? undefined,
    is_default: config.is_default,
  })
  dialogVisible.value = true
}

async function saveConfig() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value && currentEditId.value) {
      await updateModelConfig(currentEditId.value, formData)
      ElMessage.success('更新成功')
    } else {
      await createModelConfig(formData)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await loadConfigs()
  } finally {
    saving.value = false
  }
}

async function testConnection(config: ModelConfig) {
  testingId.value = config.id
  try {
    await testModelConfig(config.id)
    ElMessage.success('连接成功')
  } catch {
    // Error handled by interceptor
  } finally {
    testingId.value = null
  }
}

async function testConnectionInDialog() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  testingInDialog.value = true
  try {
    await testModelConfigByBody({
      provider: formData.provider,
      api_key: formData.api_key,
      base_url: formData.base_url || undefined,
      model: formData.model,
    })
    ElMessage.success('连接成功')
  } catch {
    // Error handled by interceptor
  } finally {
    testingInDialog.value = false
  }
}

async function setDefault(config: ModelConfig) {
  try {
    await updateModelConfig(config.id, { is_default: true })
    ElMessage.success('已设为默认配置')
    await loadConfigs()
  } catch (err) {
    // Error handled by interceptor
  }
}

async function deleteConfig(config: ModelConfig) {
  try {
    await ElMessageBox.confirm(`确定删除配置"${config.name}"吗？`, '确认删除', {
      type: 'warning',
    })
    await deleteModelConfigApi(config.id)
    ElMessage.success('删除成功')
    await loadConfigs()
  } catch (err) {
    // User cancelled or error handled
  }
}

const currentEditId = ref<string>()

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.model-management {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-tip {
  padding: $spacing-lg;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>

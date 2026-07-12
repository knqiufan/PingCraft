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
        <template #default="{ row }">{{ row.temperature ?? 0.7 }}</template>
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
          <el-input
            v-model="formData.api_key"
            type="password"
            show-password
            :placeholder="isEdit ? '留空则不修改（出于安全，密钥不回显）' : '请输入 API 密钥'"
          />
        </el-form-item>
        <el-form-item label="API 地址" prop="base_url">
          <el-input v-model="formData.base_url" placeholder="留空使用默认地址" />
        </el-form-item>
        <el-form-item label="模型名称" prop="model">
          <el-input v-model="formData.model" placeholder="如: deepseek-chat, gpt-4" />
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="formData.is_default" />
        </el-form-item>
        <div class="advanced-config">
          <button type="button" class="advanced-toggle" @click="showAdvanced = !showAdvanced">
            <el-icon :class="{ 'is-expanded': showAdvanced }"><ArrowRight /></el-icon>
            <span>高级配置</span>
          </button>
          <div v-show="showAdvanced" class="advanced-body">
            <el-form-item label="温度">
              <el-slider v-model="formData.temperature" :min="0" :max="2" :step="0.1" show-input />
            </el-form-item>
            <el-form-item label="最大 Tokens">
              <el-radio-group v-model="formData.max_tokens" class="max-tokens-group">
                <el-radio-button
                  v-for="opt in MAX_TOKEN_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          :loading="testingInDialog"
          :disabled="(!isEdit && !formData.api_key) || !formData.model"
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
import { ref, onMounted, reactive, watch } from 'vue'
import { Plus, ArrowRight } from '@element-plus/icons-vue'
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

/** 最大 Tokens 预设选项（展示标签 → LangChain 数值） */
const MAX_TOKEN_OPTIONS = [
  { label: '64k', value: 64000 },
  { label: '200k', value: 200000 },
  { label: '272k', value: 272000 },
  { label: '300k', value: 300000 },
  { label: '1M', value: 1000000 },
] as const

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 272000

const MAX_TOKEN_VALUES = new Set<number>(MAX_TOKEN_OPTIONS.map((o) => o.value))

/** 将已存 max_tokens 映射到预设；不在选项内则回落默认 272k */
function resolveMaxTokens(value?: number | null): number {
  if (value != null && MAX_TOKEN_VALUES.has(value)) {
    return value
  }
  return DEFAULT_MAX_TOKENS
}

const loading = ref(false)
const configs = ref<ModelConfig[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const testingId = ref<string | null>(null)
const testingInDialog = ref(false)
const showAdvanced = ref(false)
const formRef = ref<FormInstance>()

const formData = reactive<ModelConfigRequest>({
  name: '',
  provider: 'openai',
  api_key: '',
  base_url: '',
  model: '',
  temperature: DEFAULT_TEMPERATURE,
  max_tokens: DEFAULT_MAX_TOKENS,
  is_default: false,
})

watch(dialogVisible, (visible) => {
  if (!visible) showAdvanced.value = false
})

const rules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  provider: [{ required: true, message: '请选择提供商', trigger: 'change' }],
  api_key: [
    {
      validator: (_rule: unknown, value: string, callback: (e?: Error) => void) => {
        // 编辑模式下允许留空（不修改密钥）；新建模式必须填写
        if (!isEdit.value && !value) {
          return callback(new Error('请输入 API 密钥'))
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
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
  showAdvanced.value = false
  Object.assign(formData, {
    name: '',
    provider: 'openai',
    api_key: '',
    base_url: '',
    model: '',
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
    is_default: false,
  })
  dialogVisible.value = true
}

function editConfig(config: ModelConfig) {
  isEdit.value = true
  currentEditId.value = config.id
  showAdvanced.value = false
  Object.assign(formData, {
    name: config.name,
    provider: config.provider,
    // 编辑时不清回显密钥（后端仅返回脱敏值），留空表示不修改
    api_key: '',
    base_url: config.base_url || '',
    model: config.model,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: resolveMaxTokens(config.max_tokens),
    is_default: config.is_default,
  })
  // 清除可能残留的校验错误
  formRef.value?.clearValidate()
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
  // 编辑模式且未输入新密钥时，使用已保存的配置测试（后端持有真实密钥）
  if (isEdit.value && !formData.api_key) {
    if (!currentEditId.value) return
    testingInDialog.value = true
    try {
      await testModelConfig(currentEditId.value)
      ElMessage.success('连接成功')
    } catch {
      // Error handled by interceptor
    } finally {
      testingInDialog.value = false
    }
    return
  }

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

.advanced-config {
  margin-top: $spacing-sm;
  padding-top: $spacing-sm;
  border-top: 1px solid var(--el-border-color-lighter);
}

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: $font-size-sm;
  cursor: pointer;
  line-height: 1.5;

  .el-icon {
    transition: transform 0.2s ease;

    &.is-expanded {
      transform: rotate(90deg);
    }
  }

  &:hover {
    opacity: 0.85;
  }
}

.advanced-body {
  margin-top: $spacing-md;
}

.max-tokens-group {
  display: flex;
  flex-wrap: wrap;
}
</style>

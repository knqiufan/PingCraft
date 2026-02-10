<template>
  <el-dialog
    :model-value="visible"
    title="PingCode 配置"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <p class="settings-desc">输入您的 PingCode 应用凭证以启用集成功能。</p>

    <el-form :model="form" label-position="top" class="settings-form">
      <el-form-item label="Client ID">
        <el-input v-model="form.client_id" placeholder="请输入 PingCode Client ID" />
      </el-form-item>
      <el-form-item label="Client Secret">
        <el-input
          v-model="form.client_secret"
          type="password"
          show-password
          placeholder="请输入 PingCode Client Secret"
        />
      </el-form-item>
    </el-form>

    <!-- 连接状态 -->
    <div v-if="isConnected" class="status-connected">
      <el-icon color="#52c41a"><CircleCheckFilled /></el-icon>
      <span>PingCode 已连接</span>
    </div>
    <div v-else class="status-disconnected">
      <el-alert title="尚未连接" type="warning" :closable="false" show-icon>
        请先保存配置，然后点击"连接 PingCode"按钮进行授权。
      </el-alert>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="!isConnected"
          type="success"
          :disabled="!canConnect"
          @click="handleConnect"
        >
          连接 PingCode
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled } from '@element-plus/icons-vue'
import { getConfig, saveConfig } from '@/api/config'
import { getLoginUrl } from '@/api/auth'

const props = defineProps<{
  visible: boolean
}>()

defineEmits<{
  'update:visible': [val: boolean]
}>()

const form = reactive({ client_id: '', client_secret: '' })
const isConnected = ref(false)
const saving = ref(false)
/** 上次保存时的表单快照，用于判断是否有未保存修改 */
const savedSnapshot = ref({ client_id: '', client_secret: '' })

const hasUnsavedChanges = computed(() => {
  return form.client_id !== savedSnapshot.value.client_id ||
    form.client_secret !== savedSnapshot.value.client_secret
})

/** 连接按钮可用：已填写凭证且已保存 */
const canConnect = computed(() => {
  return !!form.client_id && !!form.client_secret && !hasUnsavedChanges.value
})

async function loadConfig() {
  try {
    const res = await getConfig()
    form.client_id = res.client_id || ''
    form.client_secret = '' // 接口不返回 secret
    isConnected.value = res.is_connected
    savedSnapshot.value = { client_id: form.client_id, client_secret: form.client_secret }
  } catch {
    // 拦截器已处理
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveConfig({ client_id: form.client_id, client_secret: form.client_secret })
    ElMessage.success('配置已保存')
    savedSnapshot.value = { client_id: form.client_id, client_secret: form.client_secret }
    // 保存后不重新 loadConfig，避免清空 client_secret，以便用户可立即点击连接
    isConnected.value = false
  } catch {
    // 拦截器已处理
  } finally {
    saving.value = false
  }
}

async function handleConnect() {
  try {
    const res = await getLoginUrl()
    window.location.href = res.url
  } catch {
    // 拦截器已处理
  }
}

watch(() => props.visible, (val) => {
  if (val) loadConfig()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-desc {
  margin-bottom: $spacing-md;
  font-size: $font-size-base;
  color: $text-secondary;
}

.settings-form {
  :deep(.el-form-item__label) {
    color: $text-secondary;
  }
}

.status-connected {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: $spacing-md;
  color: $success-color;
  font-size: $font-size-base;
}

.status-disconnected {
  margin-top: $spacing-md;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}
</style>

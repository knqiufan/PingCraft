<template>
  <el-dialog
    :model-value="visible"
    title="PingCode 配置"
    width="520px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <p class="settings-desc">输入您的 PingCode 应用凭证以启用集成功能。</p>

    <el-form :model="form" label-position="top" class="settings-form">
      <el-form-item label="授权方式">
        <el-radio-group v-model="form.grant_type" class="grant-radio-group">
          <el-radio label="authorization_code">用户授权</el-radio>
          <el-radio label="client_credentials">企业授权</el-radio>
        </el-radio-group>
        <p v-if="form.grant_type === 'client_credentials'" class="grant-hint">
          企业令牌具备系统管理员权限，可访问全局数据；请妥善保管 Client Secret。
        </p>
      </el-form-item>
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
        {{ connectHint }}
      </el-alert>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="!isConnected"
          type="success"
          :disabled="!canConnect"
          :loading="connecting"
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
import { getLoginUrl, connectEnterprisePingcode } from '@/api/auth'
import type { PingCodeGrantType } from '@/api/types'

const props = defineProps<{
  visible: boolean
}>()

defineEmits<{
  'update:visible': [val: boolean]
}>()

const form = reactive({
  client_id: '',
  client_secret: '',
  grant_type: 'authorization_code' as PingCodeGrantType,
})
const isConnected = ref(false)
const saving = ref(false)
const connecting = ref(false)

/** 上次保存时的表单快照，用于判断是否有未保存修改 */
const savedSnapshot = ref({
  client_id: '',
  client_secret: '',
  grant_type: 'authorization_code' as PingCodeGrantType,
})

const hasUnsavedChanges = computed(() => {
  return (
    form.client_id !== savedSnapshot.value.client_id ||
    form.client_secret !== savedSnapshot.value.client_secret ||
    form.grant_type !== savedSnapshot.value.grant_type
  )
})

const connectHint = computed(() => {
  if (form.grant_type === 'client_credentials') {
    return '请先保存配置，再点击「连接 PingCode」通过客户端凭据获取企业令牌。'
  }
  return '请先保存配置，再点击「连接 PingCode」跳转至 PingCode 完成用户授权。'
})

/** 连接按钮可用：已填写凭证且已保存 */
const canConnect = computed(() => {
  return !!form.client_id && !!form.client_secret && !hasUnsavedChanges.value
})

async function loadConfig() {
  try {
    const res = await getConfig()
    form.client_id = res.client_id || ''
    form.client_secret = ''
    form.grant_type = res.grant_type || 'authorization_code'
    isConnected.value = res.is_connected
    savedSnapshot.value = {
      client_id: form.client_id,
      client_secret: form.client_secret,
      grant_type: form.grant_type,
    }
  } catch {
    // 拦截器已处理
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveConfig({
      client_id: form.client_id,
      client_secret: form.client_secret,
      grant_type: form.grant_type,
    })
    ElMessage.success('配置已保存')
    savedSnapshot.value = {
      client_id: form.client_id,
      client_secret: form.client_secret,
      grant_type: form.grant_type,
    }
    isConnected.value = false
  } catch {
    // 拦截器已处理
  } finally {
    saving.value = false
  }
}

async function handleConnect() {
  if (form.grant_type === 'client_credentials') {
    connecting.value = true
    try {
      await connectEnterprisePingcode()
      ElMessage.success('企业令牌已获取')
      await loadConfig()
    } catch {
      // 拦截器已处理
    } finally {
      connecting.value = false
    }
    return
  }

  try {
    const res = await getLoginUrl()
    window.location.href = res.url
  } catch {
    // 拦截器已处理
  }
}

watch(
  () => props.visible,
  (val) => {
    if (val) loadConfig()
  },
  { immediate: true }
)
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

.grant-radio-group {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-md;
}

.grant-hint {
  margin: $spacing-sm 0 0;
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
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

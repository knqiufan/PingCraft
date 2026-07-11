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
        <el-radio-group
          v-model="form.grant_type"
          class="grant-radio-group"
          :disabled="settingsLoading"
        >
          <el-radio label="authorization_code">用户授权</el-radio>
          <el-radio label="client_credentials">企业授权</el-radio>
        </el-radio-group>
        <p v-if="form.grant_type === 'client_credentials'" class="grant-hint">
          企业令牌具备系统管理员权限，可访问全局数据；请妥善保管 Client Secret。
        </p>
      </el-form-item>
      <el-form-item label="Client ID">
        <el-input
          v-model="form.client_id"
          placeholder="请输入 PingCode Client ID"
          :disabled="settingsLoading"
        />
      </el-form-item>
      <el-form-item label="Client Secret">
        <el-input
          v-model="form.client_secret"
          type="password"
          show-password
          placeholder="请输入 PingCode Client Secret"
          :disabled="settingsLoading"
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

    <el-divider content-position="left">数据管理</el-divider>
    <p class="danger-zone-desc">
      清除本账号从 PingCode 同步到本地的项目、工作项、元数据与向量索引；不会删除 PingCode
      云端数据，也不会删除本系统的需求导入记录。操作不可恢复。
    </p>
    <el-button
      type="danger"
      plain
      :loading="clearing"
      :disabled="settingsLoading"
      @click="handleClearSyncedData"
    >
      清除同步数据
    </el-button>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          v-if="!isConnected"
          type="success"
          :disabled="!canConnect || settingsLoading"
          :loading="connecting"
          @click="handleConnect"
        >
          连接 PingCode
        </el-button>
        <el-button type="primary" :loading="saving" :disabled="settingsLoading" @click="handleSave">
          保存配置
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheckFilled } from '@element-plus/icons-vue'
import { getConfig, saveConfig } from '@/api/config'
import { getLoginUrl, connectEnterprisePingcode } from '@/api/auth'
import { clearSyncedData } from '@/api/workItems'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import type { ConfigInfo, PingCodeGrantType } from '@/api/types'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
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
/** 弹窗打开后首次拉取配置完成前为 true，避免异步覆盖表单导致误走 OAuth */
const settingsLoading = ref(false)
const clearing = ref(false)
/** 每次打开弹窗递增，丢弃过期的 getConfig 响应 */
const configLoadSeq = ref(0)

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

function applyConfigPayload(res: ConfigInfo) {
  form.client_id = res.client_id || ''
  form.client_secret = ''
  form.grant_type = res.grant_type || 'authorization_code'
  isConnected.value = res.is_connected
  savedSnapshot.value = {
    client_id: form.client_id,
    client_secret: form.client_secret,
    grant_type: form.grant_type,
  }
}

/** 按序号拉取配置；序号不匹配则丢弃（防止晚到的响应覆盖用户已选授权方式） */
async function loadConfigForOpenSeq(seq: number) {
  try {
    const res = await getConfig()
    if (seq !== configLoadSeq.value) return
    applyConfigPayload(res)
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

async function handleClearSyncedData() {
  try {
    await ElMessageBox.confirm(
      '将删除本账号在本系统中从 PingCode 同步的项目、工作项、元数据及向量索引数据。不会删除 PingCode 云端数据，也不会删除本系统的需求导入记录。此操作不可恢复，是否继续？',
      '清除同步数据',
      {
        confirmButtonText: '确认清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      }
    )
  } catch {
    return
  }

  clearing.value = true
  try {
    const res = await clearSyncedData()
    const d = res.data
    ElMessage.success(
      `已清除：项目 ${d?.projects ?? 0}、工作项 ${d?.workItems ?? 0} 及关联元数据`
    )
    await appStore.fetchSyncedData()
  } catch {
    // 拦截器已处理
  } finally {
    clearing.value = false
  }
}

async function handleConnect() {
  connecting.value = true
  try {
    // 以服务端已保存的 grant_type 为准，避免表单被异步 load 覆盖后误跳浏览器授权
    const cfg = await getConfig()
    if (cfg.grant_type === 'client_credentials') {
      await connectEnterprisePingcode()
      ElMessage.success('企业令牌已获取')
      await userStore.checkConnection()
      const latest = await getConfig()
      applyConfigPayload(latest)
      emit('update:visible', false)
      window.location.assign(router.resolve({ path: '/dashboard', query: { after_enterprise: '1' } }).href)
      return
    }

    const res = await getLoginUrl()
    if (!res?.success || !res.url) {
      ElMessage.error(res?.error || '获取授权 URL 失败')
      return
    }
    window.location.href = res.url
  } catch {
    // 拦截器已处理
  } finally {
    connecting.value = false
  }
}

watch(
  () => props.visible,
  async (val) => {
    if (!val) {
      configLoadSeq.value += 1
      settingsLoading.value = false
      return
    }
    configLoadSeq.value += 1
    const seq = configLoadSeq.value
    settingsLoading.value = true
    try {
      await loadConfigForOpenSeq(seq)
    } finally {
      if (seq === configLoadSeq.value) {
        settingsLoading.value = false
      }
    }
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

.danger-zone-desc {
  margin: 0 0 $spacing-md;
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}
</style>

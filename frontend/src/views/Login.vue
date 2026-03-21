<template>
  <div class="login-page">
    <div class="login-card">
      <!-- 顶部标识 -->
      <div class="login-header">
        <el-icon :size="28" color="#1890ff"><Monitor /></el-icon>
        <h1 class="login-title">PingCraft</h1>
        <p class="login-subtitle">需求智能分析与导入</p>
      </div>

      <!-- 表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="login-form"
        @keyup.enter="handleSubmit"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item class="login-actions">
          <el-button
            type="primary"
            :loading="loading"
            class="login-btn"
            @click="handleSubmit"
          >
            {{ isRegister ? '注册' : '登录' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 底部切换 -->
      <div class="login-footer">
        <span class="toggle-text" @click="toggleMode">
          {{ isRegister ? '已有账号？点击登录' : '没有账号？点击注册' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Monitor } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { register } from '@/api/auth'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const loading = ref(false)
const isRegister = ref(false)

const form = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度 2-32 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6-64 个字符', trigger: 'blur' },
  ],
}

function toggleMode() {
  isRegister.value = !isRegister.value
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    if (isRegister.value) {
      await register({ username: form.username, password: form.password })
      ElMessage.success('注册成功，请登录')
      isRegister.value = false
    } else {
      await userStore.login({ username: form.username, password: form.password })
      ElMessage.success('登录成功')
      router.push('/dashboard')
    }
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
      (err as Error)?.message ||
      '登录失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  userStore.restoreUserInfo()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100vh;
  background-color: $bg-base;
}

.login-card {
  width: 400px;
  padding: $spacing-xl;
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  box-shadow: $shadow-base;
}

.login-header {
  text-align: center;
  margin-bottom: $spacing-lg;
}

.login-title {
  margin: $spacing-sm 0 $spacing-xs;
  font-size: $font-size-xxl;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: 1px;
}

.login-subtitle {
  font-size: $font-size-sm;
  color: $text-tertiary;
  letter-spacing: 2px;
}

.login-form {
  :deep(.el-form-item__label) {
    color: $text-secondary;
    font-size: $font-size-base;
    padding-bottom: 4px;
  }
}

.login-actions {
  margin-top: $spacing-md;
}

.login-btn {
  width: 100%;
  height: 40px;
  font-size: $font-size-base;
}

.login-footer {
  text-align: center;
  margin-top: $spacing-md;
}

.toggle-text {
  color: $primary-color;
  font-size: $font-size-sm;
  cursor: pointer;
}
</style>

<template>
  <header class="page-header">
    <div class="header-left">
      <el-icon :size="22" color="#1890ff"><Monitor /></el-icon>
      <span class="header-title">PingCraft</span>
    </div>
    <div class="header-right">
      <span class="header-user">
        <el-icon><UserFilled /></el-icon>
        {{ username }}
      </span>
      <el-button
        :icon="Setting"
        @click="$emit('openSettings')"
      >
        设置
      </el-button>
      <el-button
        :icon="Refresh"
        :loading="syncing"
        :disabled="!isConnected"
        @click="$emit('sync')"
      >
        同步数据
      </el-button>
      <el-button
        :icon="SwitchButton"
        @click="$emit('logout')"
      >
        退出
      </el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Setting, Refresh, SwitchButton, Monitor, UserFilled } from '@element-plus/icons-vue'

defineProps<{
  username: string
  syncing: boolean
  isConnected: boolean
}>()

defineEmits<{
  openSettings: []
  sync: []
  logout: []
}>()
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $header-height;
  padding: 0 $spacing-lg;
  background: $bg-card;
  border-bottom: 1px solid $border-color-light;
  box-shadow: $shadow-sm;
}

.header-left {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.header-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
}

.header-right {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: $spacing-sm;
  font-size: $font-size-base;
  color: $text-secondary;
}
</style>

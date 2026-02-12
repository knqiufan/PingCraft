<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="560px"
    class="detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="item">
      <!-- 自定义头部 -->
      <div class="drawer-header">
        <div class="header-content">
          <el-tag type="info" size="small" class="project-tag">
            {{ item.project_name }}
          </el-tag>
          <h2 class="drawer-title">{{ item.title }}</h2>
        </div>
        <el-button
          class="close-btn"
          :icon="Close"
          circle
          size="small"
          @click="$emit('update:visible', false)"
        />
      </div>

      <!-- 主要内容区域 -->
      <div class="drawer-body">
        <!-- 基本信息卡片 -->
        <div class="info-card">
          <div class="card-title">基本信息</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">类型</span>
              <span class="info-value">
                <el-tag size="small" effect="plain">{{ getTypeLabel(item.type_id) }}</el-tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">优先级</span>
              <span class="info-value">
                <el-tag :type="getPriorityType(item.priority)" size="small" effect="plain">
                  {{ getPriorityLabel(item.priority) }}
                </el-tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">负责人</span>
              <span class="info-value user-value">
                <el-avatar :size="20" class="user-avatar">
                  {{ (item.assignee_name || defaultAssignee || '?').charAt(0) }}
                </el-avatar>
                {{ item.assignee_name || defaultAssignee || '-' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">预估工时</span>
              <span class="info-value">{{ item.estimated_hours }}h</span>
            </div>
            <div class="info-item">
              <span class="info-label">开始时间</span>
              <span class="info-value">{{ formatDate(item.start_at) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">匹配状态</span>
              <span class="info-value">
                <MatchStatusTag :match="item.match" />
              </span>
            </div>
          </div>
        </div>

        <!-- 描述卡片 -->
        <div class="info-card">
          <div class="card-title">详细描述</div>
          <div class="description-content">
            {{ item.description || '暂无描述' }}
          </div>
        </div>

        <!-- 解决方案卡片 -->
        <div v-if="item.solution_suggestion" class="info-card solution-card">
          <div class="card-title">
            <el-icon class="title-icon"><Promotion /></el-icon>
            解决方案建议
          </div>
          <div class="solution-content">
            {{ item.solution_suggestion }}
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="drawer-footer">
        <el-button @click="$emit('update:visible', false)">关闭</el-button>
        <el-button type="primary" @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { Close, Edit, Promotion } from '@element-plus/icons-vue'
import type { WorkItem } from '@/api/types'
import { useWorkItemMeta } from './composables/useWorkItemMeta'
import MatchStatusTag from './MatchStatusTag.vue'

const props = defineProps<{
  visible: boolean
  item: WorkItem | null
  defaultAssignee?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'edit', item: WorkItem): void
}>()

const { getTypeLabel, getPriorityLabel, formatDate } = useWorkItemMeta()

/** 根据优先级返回对应的 tag 类型 */
function getPriorityType(priority?: string): '' | 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    High: 'danger',
    Medium: 'warning',
    Low: 'info',
  }
  return map[priority || ''] || ''
}

function handleEdit() {
  if (!props.item) return
  const itemToEdit = props.item
  emit('update:visible', false)
  // 延迟触发编辑事件，确保抽屉关闭动画完成
  setTimeout(() => {
    emit('edit', itemToEdit)
  }, 100)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.detail-drawer {
  :deep(.el-drawer__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: $spacing-lg;
  border-bottom: 1px solid $border-color-light;
  background-color: $bg-section;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.project-tag {
  margin-bottom: $spacing-sm;
}

.drawer-title {
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
}

.close-btn {
  flex-shrink: 0;
  margin-left: $spacing-md;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.info-card {
  background-color: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: $spacing-md;
}

.card-title {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
  margin-bottom: $spacing-md;
  padding-bottom: $spacing-sm;
  border-bottom: 1px solid $border-color-light;
}

.title-icon {
  color: $primary-color;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md $spacing-lg;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.info-label {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.info-value {
  font-size: $font-size-base;
  color: $text-primary;
}

.user-value {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.user-avatar {
  background-color: $primary-light;
  color: $primary-color;
  font-size: $font-size-sm;
}

.description-content {
  font-size: $font-size-base;
  color: $text-secondary;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.solution-card {
  background-color: $primary-light;
  border-color: transparent;
}

.solution-card .card-title {
  color: $primary-dark;
  border-bottom-color: rgba($primary-color, 0.2);
}

.solution-content {
  font-size: $font-size-base;
  color: $text-secondary;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  border-top: 1px solid $border-color-light;
  background-color: $bg-card;
}
</style>

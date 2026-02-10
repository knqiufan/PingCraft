<template>
  <el-card class="project-card">
    <template #header>
      <div class="card-header">
        <span class="card-title">
          <el-icon><FolderOpened /></el-icon>
          目标项目
        </span>
        <el-button text type="primary" @click="appStore.resetAnalysis">
          重新分析
        </el-button>
      </div>
    </template>
    <div class="selector-body">
      <div class="selector-main">
        <el-select
          :model-value="appStore.selectedProjectId"
          placeholder="选择目标项目"
          filterable
          class="project-select"
          @change="handleChange"
        >
          <el-option
            v-for="item in appStore.projects"
            :key="item.id"
            :label="formatLabel(item)"
            :value="item.id"
          />
        </el-select>
        <span v-if="appStore.projects.length" class="match-hint">
          <el-icon color="#52c41a"><CircleCheckFilled /></el-icon>
          已自动匹配最佳项目
        </span>
      </div>
      <div v-if="projectSummary.length" class="project-summary">
        <span class="summary-label">识别到的项目：</span>
        <el-tag
          v-for="(name, idx) in projectSummary"
          :key="idx"
          size="small"
          type="info"
          effect="plain"
        >
          {{ name }}
        </el-tag>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpened, CircleCheckFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { Project } from '@/api/types'

const appStore = useAppStore()

const projectSummary = computed(() => {
  const names = [...new Set(appStore.requirements.map(r => r.project_name))]
  return names
})

function formatLabel(item: Project): string {
  if (item.score != null) {
    return `${item.name}（匹配度: ${item.score.toFixed(2)}）`
  }
  return item.name
}

function handleChange(val: string) {
  appStore.selectedProjectId = val
  appStore.fetchMetadata(val)
  appStore.checkDuplicateItems()
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.project-card {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.selector-body {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.selector-main {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.project-select {
  width: 360px;
}

.match-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: $font-size-sm;
  color: $success-color;
}

.project-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: $spacing-xs;
  background-color: $bg-section;
  border-radius: 4px;
}

.summary-label {
  font-size: $font-size-sm;
  color: $text-secondary;
  font-weight: 500;
}
</style>

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
          placeholder="选择目标项目或创建新项目"
          filterable
          class="project-select"
          @change="handleChange"
        >
          <!-- 已存在的 PingCode 项目 -->
          <el-option
            v-for="item in appStore.projects"
            :key="item.id"
            :label="formatLabel(item)"
            :value="item.id"
          />
          <!-- 识别到但未匹配的项目，可作为新项目创建 -->
          <el-option
            v-for="name in unmatchedProjectNames"
            :key="`new-${name}`"
            :label="`${name} (新建项目)`"
            :value="`new:${name}`"
          >
            <div class="new-project-option">
              <span>{{ name }}</span>
              <el-tag size="small" type="success" effect="plain">新建</el-tag>
            </div>
          </el-option>
        </el-select>
        <span v-if="appStore.projects.length" class="match-hint">
          <el-icon color="#52c41a"><CircleCheckFilled /></el-icon>
          已自动匹配最佳项目
        </span>
        <span v-else-if="unmatchedProjectNames.length" class="match-hint warning">
          <el-icon color="#faad14"><WarningFilled /></el-icon>
          未匹配到现有项目，可选择创建新项目
        </span>
      </div>
      <div v-if="projectSummary.length" class="project-summary">
        <span class="summary-label">识别到的项目：</span>
        <el-tag
          v-for="(name, idx) in projectSummary"
          :key="idx"
          size="small"
          :type="isMatchedProject(name) ? 'success' : 'warning'"
          effect="plain"
        >
          {{ name }}{{ isMatchedProject(name) ? '' : ' (待创建)' }}
        </el-tag>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpened, CircleCheckFilled, WarningFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { Project } from '@/api/types'

const appStore = useAppStore()

const projectSummary = computed(() => {
  const names = [...new Set(appStore.requirements.map(r => r.project_name))]
  return names
})

// 已匹配的项目名称集合
const matchedProjectNames = computed(() => new Set(appStore.projects.map(p => p.name)))

// 未匹配的项目名称（需要创建的新项目）
const unmatchedProjectNames = computed(() => {
  return projectSummary.value.filter(name => !matchedProjectNames.value.has(name))
})

function formatLabel(item: Project): string {
  if (item.score != null) {
    return `${item.name}（匹配度: ${item.score.toFixed(2)}）`
  }
  return item.name
}

function isMatchedProject(name: string): boolean {
  return matchedProjectNames.value.has(name)
}

function handleChange(val: string) {
  appStore.selectedProjectId = val
  if (!val?.startsWith('new:')) {
    appStore.fetchMetadata(val)
    appStore.checkDuplicateItems()
  }
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
  width: 400px;
}

.match-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: $font-size-sm;
  color: $success-color;

  &.warning {
    color: #faad14;
  }
}

.new-project-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
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

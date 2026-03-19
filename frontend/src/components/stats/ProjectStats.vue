<template>
  <div class="project-stats">
    <div class="stats-toolbar">
      <el-select
        v-model="selectedProjectId"
        placeholder="选择要统计的项目"
        filterable
        clearable
        class="project-select"
      >
        <el-option
          v-for="p in appStore.syncedProjects"
          :key="p.id"
          :label="p.name"
          :value="p.id"
        />
      </el-select>

      <el-button type="primary" :loading="statsLoading" :disabled="!selectedProjectId" @click="fetchStats">
        统计
      </el-button>
      <el-button
        type="success"
        :loading="aiLoading"
        :disabled="!statsData"
        @click="fetchAIReport"
      >
        AI 分析
      </el-button>
      <el-button
        :loading="downloading"
        :disabled="!statsData"
        @click="handleDownloadPDF"
      >
        下载报告
      </el-button>
    </div>

    <template v-if="statsLoading && !statsData">
      <div class="stats-loading">
        <el-icon :size="32" class="spin-icon"><Loading /></el-icon>
        <p>正在加载统计数据...</p>
      </div>
    </template>

    <template v-else-if="statsData">
      <div ref="reportContainer" class="report-container">
        <div class="stats-summary">
          <div class="summary-card">
            <span class="summary-label">工作项总数</span>
            <span class="summary-value">{{ statsData.totalItems }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">预估总工时</span>
            <span class="summary-value">{{ statsData.totalEstimatedHours }}h</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">完成率</span>
            <span class="summary-value">{{ statsData.stateDistribution.completionRate }}%</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">参与人数</span>
            <span class="summary-value">{{ statsData.assigneeDistribution.length }}</span>
          </div>
        </div>

        <StatsCharts :data="statsData" />

        <div v-if="aiReport || aiLoading" class="ai-section">
          <h3 class="section-title">AI 智能分析报告</h3>
          <AIAnalysisReport :content="aiReport" :loading="aiLoading" />
        </div>
      </div>
    </template>

    <div v-else class="stats-empty">
      <p>请选择一个项目并点击「统计」按钮查看统计数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { getProjectStats, getAIAnalysis } from '@/api/stats'
import type { ProjectStatsData } from '@/api/types'
import StatsCharts from './StatsCharts.vue'
import AIAnalysisReport from './AIAnalysisReport.vue'
import { useReportDownload } from '@/composables/useReportDownload'

const appStore = useAppStore()
const selectedProjectId = ref('')
const statsData = ref<ProjectStatsData | null>(null)
const statsLoading = ref(false)
const aiReport = ref('')
const aiLoading = ref(false)
const reportContainer = ref<HTMLElement | null>(null)

const { downloading, downloadPDF } = useReportDownload()

async function fetchStats() {
  if (!selectedProjectId.value) return
  statsLoading.value = true
  aiReport.value = ''
  try {
    const res = await getProjectStats(selectedProjectId.value)
    statsData.value = res.data ?? null
  } catch {
    statsData.value = null
  } finally {
    statsLoading.value = false
  }
}

async function fetchAIReport() {
  if (!selectedProjectId.value || !statsData.value) return
  aiLoading.value = true
  try {
    const res = await getAIAnalysis(selectedProjectId.value)
    aiReport.value = res.data?.report ?? ''
  } catch {
    aiReport.value = ''
  } finally {
    aiLoading.value = false
  }
}

function handleDownloadPDF() {
  if (!reportContainer.value || !statsData.value) return
  const projectName = statsData.value.project.name
  downloadPDF(reportContainer.value, projectName)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.stats-toolbar {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
  flex-wrap: wrap;
}

.project-select {
  width: 280px;
}

.stats-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
  color: $text-tertiary;

  p {
    margin-top: $spacing-md;
    font-size: $font-size-lg;
    color: $text-secondary;
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
}

.summary-card {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: $spacing-md $spacing-lg;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.summary-label {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.summary-value {
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
}

.ai-section {
  margin-top: $spacing-lg;
}

.section-title {
  font-size: $font-size-lg;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 $spacing-md 0;
}

.stats-empty {
  text-align: center;
  padding: 100px 0;
  color: $text-tertiary;
  font-size: $font-size-base;
}

.report-container {
  /* 供 PDF 截图使用 */
}

@media (max-width: 768px) {
  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .project-select {
    width: 100%;
  }
}
</style>

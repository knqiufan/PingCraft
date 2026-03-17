<template>
  <div class="stats-charts">
    <div class="charts-grid">
      <div class="chart-card">
        <h4 class="chart-title">完成进度</h4>
        <v-chart :option="completionOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <h4 class="chart-title">人员分布</h4>
        <v-chart :option="assigneeOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <h4 class="chart-title">类型分布</h4>
        <v-chart :option="typeOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <h4 class="chart-title">优先级分布</h4>
        <v-chart :option="priorityOption" autoresize class="chart" />
      </div>
      <div class="chart-card chart-card--wide">
        <h4 class="chart-title">工时排名（按人员）</h4>
        <v-chart :option="workloadRankOption" autoresize class="chart" />
      </div>
      <div class="chart-card chart-card--wide">
        <h4 class="chart-title">工时分布（按类型）</h4>
        <v-chart :option="workloadTypeOption" autoresize class="chart" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { ProjectStatsData } from '@/api/types'

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const props = defineProps<{
  data: ProjectStatsData
}>()

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16']

const completionOption = computed(() => {
  const g = props.data.stateDistribution.groups
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '45%'],
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 },
      data: [
        { value: g.todo, name: '待办', itemStyle: { color: '#d9d9d9' } },
        { value: g.inProgress, name: '进行中', itemStyle: { color: '#1890ff' } },
        { value: g.done, name: '已完成', itemStyle: { color: '#52c41a' } },
        ...(g.other > 0 ? [{ value: g.other, name: '其他', itemStyle: { color: '#faad14' } }] : []),
      ].filter(d => d.value > 0),
    }],
  }
})

const assigneeOption = computed(() => buildPieOption(props.data.assigneeDistribution))
const typeOption = computed(() => buildPieOption(props.data.typeDistribution))
const priorityOption = computed(() => buildPieOption(props.data.priorityDistribution))

function buildPieOption(items: Array<{ name: string; value: number }>) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 12 } },
    color: COLORS,
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '45%'],
      label: { show: items.length <= 6, formatter: '{b}\n{d}%', fontSize: 12 },
      data: items.map(i => ({ name: i.name, value: i.value })),
    }],
  }
}

const workloadRankOption = computed(() => {
  const items = props.data.workloadByAssignee.slice(0, 15)
  const reversed = [...items].reverse()
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'value', name: '工时(h)' },
    yAxis: { type: 'category', data: reversed.map(i => i.name) },
    series: [{
      type: 'bar',
      data: reversed.map(i => i.value),
      itemStyle: { color: '#1890ff' },
      barMaxWidth: 24,
      label: { show: true, position: 'right', formatter: '{c}h', fontSize: 12 },
    }],
  }
})

const workloadTypeOption = computed(() => {
  const items = props.data.workloadByType
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 40, top: 10, bottom: 40 },
    xAxis: { type: 'category', data: items.map(i => i.name), axisLabel: { rotate: items.length > 5 ? 30 : 0 } },
    yAxis: { type: 'value', name: '工时(h)' },
    color: COLORS,
    series: [{
      type: 'bar',
      data: items.map((i, idx) => ({ value: i.value, itemStyle: { color: COLORS[idx % COLORS.length] } })),
      barMaxWidth: 40,
      label: { show: true, position: 'top', formatter: '{c}h', fontSize: 12 },
    }],
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md;
}

.chart-card {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: $spacing-md;
  box-shadow: $shadow-sm;
}

.chart-card--wide {
  grid-column: span 1;
}

.chart-title {
  margin: 0 0 $spacing-sm 0;
  font-size: $font-size-base;
  font-weight: 600;
  color: $text-primary;
}

.chart {
  width: 100%;
  height: 280px;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>

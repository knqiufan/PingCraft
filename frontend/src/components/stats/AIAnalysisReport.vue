<template>
  <div class="ai-report">
    <div v-if="loading" class="report-loading">
      <el-icon :size="24" class="spin-icon"><Loading /></el-icon>
      <span class="loading-text">AI 正在分析项目数据，请稍候...</span>
    </div>
    <div v-else-if="content" class="report-content markdown-body" v-html="renderedHtml" />
    <div v-else class="report-empty">
      <span>点击「AI 分析」按钮生成智能分析报告</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  content: string
  loading: boolean
}>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})

const renderedHtml = computed(() => {
  if (!props.content) return ''
  return md.render(props.content)
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ai-report {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: $spacing-lg;
  box-shadow: $shadow-sm;
}

.report-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-sm;
  padding: 60px 0;
  color: $text-tertiary;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: $font-size-base;
}

.report-empty {
  text-align: center;
  padding: 40px 0;
  color: $text-tertiary;
  font-size: $font-size-base;
}

.report-content {
  line-height: 1.8;
  color: $text-primary;
  font-size: $font-size-base;
}
</style>

<style lang="scss">
@use '@/styles/variables.scss' as *;

.markdown-body {
  h1, h2, h3, h4, h5, h6 {
    margin-top: 20px;
    margin-bottom: 10px;
    font-weight: 600;
    color: $text-primary;
  }

  h1 { font-size: 22px; }
  h2 { font-size: 18px; border-bottom: 1px solid $border-color-light; padding-bottom: 6px; }
  h3 { font-size: 16px; }
  h4 { font-size: 14px; }

  p {
    margin: 8px 0;
    line-height: 1.8;
  }

  ul, ol {
    padding-left: 24px;
    margin: 8px 0;
  }

  li {
    margin: 4px 0;
    line-height: 1.7;
  }

  strong {
    font-weight: 600;
    color: $text-primary;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }

  th, td {
    border: 1px solid $border-color-light;
    padding: 8px 12px;
    text-align: left;
    font-size: $font-size-sm;
  }

  th {
    background: $bg-section;
    font-weight: 600;
  }

  code {
    background: $bg-section;
    padding: 2px 6px;
    border-radius: $border-radius-sm;
    font-size: $font-size-sm;
  }

  pre {
    background: $bg-section;
    padding: 12px;
    border-radius: $border-radius;
    overflow-x: auto;
    margin: 12px 0;

    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 3px solid $primary-color;
    padding-left: 12px;
    margin: 12px 0;
    color: $text-secondary;
  }

  hr {
    border: none;
    border-top: 1px solid $border-color-light;
    margin: 16px 0;
  }
}
</style>

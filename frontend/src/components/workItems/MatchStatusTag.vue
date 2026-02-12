<template>
  <el-tag v-if="match && match.score && match.score >= 0.6" type="warning" size="small">
    相似: {{ match.title }} ({{ (match.score * 100).toFixed(0) }}%)
  </el-tag>
  <el-tag v-else-if="match && match.score && match.score < 0.6" type="info" size="small">
    没有相似项目
  </el-tag>
  <el-tag v-else-if="match" type="warning" size="small">
    相似: {{ match.title }}
  </el-tag>
  <el-tag v-else type="success" size="small">新需求</el-tag>
</template>

<script setup lang="ts">
defineProps<{
  match?: { id: string; title: string; score?: number } | null
}>()
</script>

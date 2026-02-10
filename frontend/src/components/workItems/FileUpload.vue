<template>
  <div class="upload-section">
    <el-upload
      drag
      action=""
      :http-request="handleUpload"
      :show-file-list="false"
      accept=".md,.txt,.docx"
      class="file-uploader"
    >
      <div class="upload-inner">
        <el-icon :size="48" color="#1890ff"><UploadFilled /></el-icon>
        <p class="upload-main-text">拖拽文件到此处或 <em>点击上传</em></p>
        <p class="upload-hint">支持 .md, .txt, .docx 格式，文件大小不超过 10MB</p>
      </div>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

function handleUpload(options: { file: File }) {
  const file = options.file
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 10MB')
    return
  }
  appStore.uploadAndAnalyze(file)
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.upload-section {
  max-width: 640px;
  margin: 80px auto 0;
}

.file-uploader {
  width: 100%;
}

.upload-inner {
  padding: $spacing-xl 0;
  text-align: center;
}

.upload-main-text {
  margin-top: $spacing-md;
  font-size: $font-size-lg;
  color: $text-primary;

  em {
    color: $primary-color;
    font-style: normal;
  }
}

.upload-hint {
  margin-top: $spacing-sm;
  font-size: $font-size-sm;
  color: $text-tertiary;
}

:deep(.el-upload) {
  width: 100%;
}
:deep(.el-upload-dragger) {
  width: 100%;
  padding: $spacing-xl;
  border-color: $border-color;
}
</style>

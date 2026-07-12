<template>
  <el-card class="synced-project-list">
    <template #header>
      <div class="card-header">
        <span>已同步项目</span>
        <el-button text type="primary" size="small" @click="refresh">刷新</el-button>
      </div>
    </template>
    <el-table
      :data="filteredList"
      stripe
      style="width: 100%"
      max-height="400"
    >
      <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="同步时间" min-width="160">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            text
            type="primary"
            size="small"
            @click="showProjectDetail(row)"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!list.length" class="empty-tip">暂无同步数据，请先点击「同步数据」</div>

    <!-- 项目详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="项目详情"
      width="600px"
      class="project-detail-dialog"
    >
      <div v-if="selectedProject" class="project-detail">
        <div class="detail-row">
          <span class="detail-label">项目 ID：</span>
          <span class="detail-value">{{ selectedProject.id }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">项目名称：</span>
          <span class="detail-value">{{ selectedProject.name }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">描述：</span>
          <span class="detail-value">{{ selectedProject.description || '无' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">同步时间：</span>
          <span class="detail-value">{{ formatDate(selectedProject.createdAt) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { SyncedProjectMeta } from '@/api/types'

const appStore = useAppStore()
const search = ref('')
const detailVisible = ref(false)
const selectedProject = ref<SyncedProjectMeta | null>(null)

const list = computed(() => appStore.syncedProjects)

const filteredList = computed(() => {
  const s = search.value?.trim().toLowerCase()
  if (!s) return list.value
  return list.value.filter(
    (p) =>
      p.name?.toLowerCase().includes(s) ||
      p.id?.toLowerCase().includes(s) ||
      p.description?.toLowerCase().includes(s)
  )
})

async function refresh() {
  await appStore.fetchSyncedData()
}

function showProjectDetail(project: SyncedProjectMeta) {
  selectedProject.value = project
  detailVisible.value = true
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  if (appStore.syncedProjects.length === 0) {
    refresh()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.synced-project-list {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty-tip {
  padding: $spacing-lg;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-sm;
}

.project-detail-dialog {
  .project-detail {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-sm 0;
  }

  .detail-row {
    display: flex;
    align-items: flex-start;
    gap: $spacing-sm;
  }

  .detail-label {
    min-width: 100px;
    font-weight: 500;
    color: $text-secondary;
  }

  .detail-value {
    color: $text-primary;
    word-break: break-word;
  }
}
</style>

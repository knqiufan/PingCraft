<template>
  <el-card class="synced-work-item-list">
    <template #header>
      <div class="card-header">
        <div class="header-left">
          <span>已同步工作项</span>
          <el-select
            v-model="filterProjectId"
            clearable
            placeholder="按项目筛选"
            size="small"
            class="project-select"
          >
            <el-option
              v-for="p in appStore.syncedProjects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
          <el-input
            v-model="searchKeyword"
            clearable
            placeholder="搜索标题/编号"
            size="small"
            class="search-input"
          />
        </div>
        <el-button text type="primary" size="small" @click="refresh">刷新</el-button>
      </div>
    </template>
    <el-table
      :data="pagedList"
      stripe
      style="width: 100%"
      max-height="400"
    >
      <el-table-column prop="identifier" label="编号" width="120" show-overflow-tooltip />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="project_name" label="项目名称" width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            text
            type="primary"
            size="small"
            @click="showWorkItemDetail(row)"
          >
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="!filteredList.length" class="empty-tip">
      {{ filterProjectId || searchKeyword ? '没有匹配的工作项' : '暂无同步数据，请先点击「同步数据」' }}
    </div>
    <!-- 分页（P3-5.6） -->
    <div v-if="filteredList.length > pageSize" class="pagination-row">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredList.length"
        layout="prev, pager, next, total"
        size="small"
      />
    </div>

    <!-- 工作项详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="工作项详情"
      width="600px"
      class="work-item-detail-dialog"
    >
      <div v-if="selectedItem" class="work-item-detail">
        <div class="detail-row">
          <span class="detail-label">编号：</span>
          <span class="detail-value">{{ selectedItem.identifier || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">标题：</span>
          <span class="detail-value">{{ selectedItem.title }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">项目：</span>
          <span class="detail-value">{{ selectedItem.project_name || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">同步时间：</span>
          <span class="detail-value">{{ formatDate(selectedItem.createdAt) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import type { SyncedWorkItemMeta } from '@/api/types'

const appStore = useAppStore()
const filterProjectId = ref('')
const searchKeyword = ref('')
const detailVisible = ref(false)
const selectedItem = ref<SyncedWorkItemMeta | null>(null)
const workItems = ref<SyncedWorkItemMeta[]>([])
const currentPage = ref(1)
const pageSize = 20

/** 按项目 + 关键词过滤后的列表 */
const filteredList = computed(() => {
  let list = workItems.value
  if (filterProjectId.value) {
    list = list.filter((w) => w.project_id === filterProjectId.value)
  }
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (w) =>
        (w.title || '').toLowerCase().includes(kw) ||
        (w.identifier || '').toLowerCase().includes(kw)
    )
  }
  return list
})

/** 当前页数据 */
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredList.value.slice(start, start + pageSize)
})

async function refresh() {
  await appStore.fetchSyncedData()
  workItems.value = appStore.syncedWorkItems
}

function showWorkItemDetail(item: SyncedWorkItemMeta) {
  selectedItem.value = item
  detailVisible.value = true
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

watch(
  () => appStore.syncedWorkItems,
  (v) => {
    workItems.value = v ?? []
  },
  { immediate: true }
)

onMounted(() => {
  if (appStore.syncedWorkItems.length === 0) {
    refresh()
  } else {
    workItems.value = appStore.syncedWorkItems
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.synced-work-item-list {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.project-select {
  width: 200px;
}

.search-input {
  width: 200px;
}

.pagination-row {
  display: flex;
  justify-content: flex-end;
  margin-top: $spacing-md;
}

.empty-tip {
  padding: $spacing-lg;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-sm;
}

.work-item-detail-dialog {
  .work-item-detail {
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
    min-width: 80px;
    font-weight: 500;
    color: $text-secondary;
  }

  .detail-value {
    color: $text-primary;
    word-break: break-word;
  }
}
</style>

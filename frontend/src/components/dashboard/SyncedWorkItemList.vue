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
        </div>
        <el-button text type="primary" size="small" @click="refresh">刷新</el-button>
      </div>
    </template>
    <el-table
      :data="displayList"
      stripe
      style="width: 100%"
      max-height="400"
    >
      <el-table-column prop="identifier" label="编号" width="120" show-overflow-tooltip />
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="project_id" label="项目 ID" width="220" show-overflow-tooltip />
    </el-table>
    <div v-if="!displayList.length" class="empty-tip">
      {{ filterProjectId ? '该项目暂无工作项' : '暂无同步数据，请先点击「同步数据」' }}
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const filterProjectId = ref('')
const workItems = ref<Array<{ id: string; project_id: string; title: string; identifier?: string }>>([])

const displayList = computed(() => {
  if (!filterProjectId.value) return workItems.value
  return workItems.value.filter((w) => w.project_id === filterProjectId.value)
})

async function refresh() {
  await appStore.fetchSyncedData()
  workItems.value = appStore.syncedWorkItems
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

.empty-tip {
  padding: $spacing-lg;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-sm;
}
</style>

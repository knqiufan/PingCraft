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
      <el-table-column prop="id" label="项目 ID" width="220" show-overflow-tooltip />
      <el-table-column prop="name" label="项目名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
    </el-table>
    <div v-if="!list.length" class="empty-tip">暂无同步数据，请先点击「同步数据」</div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const search = ref('')

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
</style>

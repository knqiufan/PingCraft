<template>
  <el-card class="metadata-panel">
    <template #header>
      <div class="card-header">
        <span>元数据管理</span>
        <el-button text type="primary" size="small" @click="refresh">刷新</el-button>
      </div>
    </template>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="工作项类型" name="types">
        <el-table :data="appStore.workItemTypes" stripe max-height="360" class="meta-table">
          <el-table-column prop="project_name" label="项目名称" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
          <el-table-column prop="group" label="分组" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="工作项状态" name="states">
        <el-table :data="appStore.workItemStates" stripe max-height="360" class="meta-table">
          <el-table-column prop="project_name" label="项目名称" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
          <el-table-column prop="type" label="类型" show-overflow-tooltip />
          <el-table-column label="颜色">
            <template #default="{ row }">
              <span
                v-if="row.color"
                class="color-dot"
                :style="{ backgroundColor: row.color }"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="工作项属性" name="properties">
        <el-table :data="appStore.workItemProperties" stripe max-height="360" class="meta-table">
          <el-table-column prop="project_name" label="项目名称" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
          <el-table-column prop="type" label="类型" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="工作项优先级" name="priorities">
        <el-table :data="appStore.workItemPriorities" stripe max-height="360" class="meta-table">
          <el-table-column prop="project_name" label="项目名称" show-overflow-tooltip />
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <p class="tip">元数据在首次「同步数据」时从 PingCode 拉取并入库，此处仅展示。</p>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const activeTab = ref('types')

async function refresh() {
  await appStore.fetchSyncedData()
  await appStore.fetchAllMetadata()
}

onMounted(() => {
  if (appStore.workItemTypes.length === 0) {
    appStore.fetchAllMetadata()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.metadata-panel {
  margin-bottom: $spacing-md;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-table {
  width: auto;
  max-width: 100%;
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 2px;
  vertical-align: middle;
}

.tip {
  margin-top: $spacing-md;
  font-size: $font-size-sm;
  color: $text-tertiary;
}
</style>

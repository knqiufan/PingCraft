<template>
  <div class="dashboard-page">
    <PageHeader
      :username="userStore.username"
      :syncing="appStore.syncing"
      :is-connected="userStore.isConnected"
      @open-settings="settingsVisible = true"
      @sync="appStore.syncData"
      @logout="handleLogout"
    />

    <main class="dashboard-main">
      <div class="dashboard-content">
        <el-alert
          v-if="!userStore.isConnected"
          title="PingCode 尚未连接"
          description="请点击右上角「设置」按钮，配置 PingCode 凭证并完成授权。"
          type="warning"
          show-icon
          :closable="false"
          class="connect-alert"
        />

        <template v-else>
          <DataOverview />

          <el-tabs v-model="activeTab" class="main-tabs">
            <el-tab-pane label="数据同步" name="sync">
              <div v-if="appStore.analyzing" class="analyzing-state">
                <el-icon :size="32" class="spin-icon"><Loading /></el-icon>
                <p class="analyzing-text">正在分析需求文档，请稍候...</p>
              </div>
              <FileUpload v-else-if="!appStore.requirements.length" />
              <template v-else>
                <ProjectSelector />
                <WorkItemTable />
              </template>
            </el-tab-pane>
            <el-tab-pane label="项目列表" name="projects">
              <SyncedProjectList />
            </el-tab-pane>
            <el-tab-pane label="工作项列表" name="work-items">
              <SyncedWorkItemList />
            </el-tab-pane>
            <el-tab-pane label="元数据管理" name="metadata">
              <MetadataPanel />
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </main>

    <SettingsDialog v-model:visible="settingsVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import PageHeader from '@/components/common/PageHeader.vue'
import DataOverview from '@/components/dashboard/DataOverview.vue'
import FileUpload from '@/components/workItems/FileUpload.vue'
import ProjectSelector from '@/components/workItems/ProjectSelector.vue'
import WorkItemTable from '@/components/workItems/WorkItemTable.vue'
import SyncedProjectList from '@/components/dashboard/SyncedProjectList.vue'
import SyncedWorkItemList from '@/components/dashboard/SyncedWorkItemList.vue'
import MetadataPanel from '@/components/dashboard/MetadataPanel.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const appStore = useAppStore()
const settingsVisible = ref(false)
const activeTab = ref('sync')

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

onMounted(async () => {
  if (route.query.connected === 'true') {
    userStore.markConnected()
    router.replace('/dashboard')
    return
  }
  await userStore.checkConnection()
  if (userStore.isConnected) {
    await appStore.fetchSyncedData()
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.dashboard-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background-color: $bg-base;
}

.dashboard-main {
  flex: 1;
  overflow: auto;
  padding: $spacing-lg;
}

.dashboard-content {
  max-width: $content-max-width;
  margin: 0 auto;
}

.connect-alert {
  margin-bottom: $spacing-md;
}

.main-tabs {
  margin-top: $spacing-md;
}

.analyzing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;
  color: $text-tertiary;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analyzing-text {
  margin-top: $spacing-md;
  font-size: $font-size-lg;
  color: $text-secondary;
}
</style>

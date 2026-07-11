<template>
  <el-drawer
    v-model="visible"
    :title="`导入明细 - ${record?.file_name || ''}`"
    size="60%"
    direction="rtl"
    @close="handleClose"
  >
    <div class="detail-content">
      <!-- 统计信息 -->
      <div class="stats-row" v-if="record">
        <el-tag type="info">总计: {{ record.requirements_count }}</el-tag>
        <el-tag type="success">成功: {{ record.imported_count }}</el-tag>
        <el-tag type="danger">失败: {{ record.failed_count }}</el-tag>
        <el-tag>待导入: {{ pendingCount }}</el-tag>
      </div>

      <!-- 筛选 -->
      <div class="filter-row">
        <el-select
          v-model="statusFilter"
          placeholder="筛选状态"
          clearable
          style="width: 150px"
          @change="handleFilterChange"
        >
          <el-option label="全部" value="" />
          <el-option label="待导入" value="pending" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="跳过" value="skipped" />
        </el-select>
        <el-button text type="primary" @click="refresh">刷新</el-button>
        <el-button
          text
          type="success"
          :icon="Download"
          :loading="exporting"
          @click="handleExport"
        >
          导出 CSV
        </el-button>
      </div>

      <!-- 明细列表 -->
      <el-table :data="items" stripe v-loading="loading" style="width: 100%">
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="project_name" label="项目" width="120" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="pingcode_identifier" label="PingCode ID" width="120" align="center">
          <template #default="{ row }">
            <span v-if="row.pingcode_identifier">{{ row.pingcode_identifier }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="错误信息" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.error_message" class="error-text">{{ row.error_message }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div v-if="total > 0" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="!items.length && !loading" class="empty-tip">暂无明细数据</div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getImportRecordItems,
  exportRecordAsCsv,
  type ImportRecord,
  type ImportRecordItem,
} from '@/api/records'

const props = defineProps<{
  modelValue: boolean
  record: ImportRecord | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const loading = ref(false)
const items = ref<ImportRecordItem[]>([])
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const statusFilter = ref('')

const pendingCount = computed(() => {
  if (!props.record) return 0
  return props.record.requirements_count - props.record.imported_count - props.record.failed_count
})

watch(
  () => props.modelValue,
  (val) => {
    if (val && props.record) {
      currentPage.value = 1
      statusFilter.value = ''
      loadItems()
    }
  }
)

async function loadItems() {
  if (!props.record) return
  
  loading.value = true
  try {
    const res = await getImportRecordItems(props.record.id, {
      page: currentPage.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
    })
    items.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch {
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadItems()
}

const exporting = ref(false)
async function handleExport() {
  if (!props.record) return
  exporting.value = true
  try {
    await exportRecordAsCsv(props.record.id, props.record.file_name)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadItems()
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadItems()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadItems()
}

function handleClose() {
  items.value = []
  total.value = 0
}

function getStatusType(status: string) {
  const map: Record<string, string> = {
    pending: 'info',
    success: 'success',
    failed: 'danger',
    skipped: 'warning',
  }
  return map[status] || ''
}

function getStatusText(status: string) {
  const map: Record<string, string> = {
    pending: '待导入',
    success: '成功',
    failed: '失败',
    skipped: '跳过',
  }
  return map[status] || status
}
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.detail-content {
  padding: 0 $spacing-md;
}

.stats-row {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
  flex-wrap: wrap;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-md;
}

.pagination {
  margin-top: $spacing-md;
  display: flex;
  justify-content: center;
}

.empty-tip {
  padding: $spacing-lg;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-size-sm;
}

.text-muted {
  color: $text-tertiary;
}

.error-text {
  color: $error-color;
  font-size: $font-size-sm;
}
</style>

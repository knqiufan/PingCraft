<template>
  <div class="data-overview">
    <div class="overview-cards">
      <div class="card">
        <span class="label">项目数</span>
        <span class="value">{{ overview?.projects ?? 0 }}</span>
      </div>
      <div class="card">
        <span class="label">工作项数</span>
        <span class="value">{{ overview?.workItems ?? 0 }}</span>
      </div>
      <div class="card">
        <span class="label">类型数</span>
        <span class="value">{{ overview?.types ?? 0 }}</span>
      </div>
      <div class="card">
        <span class="label">状态数</span>
        <span class="value">{{ overview?.states ?? 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const overview = computed(() => appStore.metadataOverview)
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.data-overview {
  margin-bottom: $spacing-lg;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
}

.card {
  background: $bg-card;
  border: 1px solid $border-color-light;
  border-radius: $border-radius;
  padding: $spacing-md $spacing-lg;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;
}

.label {
  font-size: $font-size-sm;
  color: $text-tertiary;
}

.value {
  font-size: $font-size-xl;
  font-weight: 600;
  color: $text-primary;
}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

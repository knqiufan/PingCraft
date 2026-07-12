import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    // Phase 0 不设硬阈值（骨架文件占多数）。
    // Phase 1 起开启：coverage.thresholds.lines = 80
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/meta.ts', 'bin/**']
    }
  }
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/sdk/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/meta.ts', 'src/**/types.ts', 'bin/**'],
      // core/sdk 覆盖率门槛：lines/stmts 85%、functions 80%（Phase 2 每模块目标）、branches 75%
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 75,
      },
    },
  },
});

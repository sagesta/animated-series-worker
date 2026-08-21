import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@studio/contracts': resolve(process.cwd(), 'packages/contracts/src/index.ts'),
      '@studio/domain': resolve(process.cwd(), 'packages/domain/src/index.ts'),
      '@studio/project-store': resolve(process.cwd(), 'packages/project-store/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'html']
    }
  }
})

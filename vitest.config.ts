import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@studio/contracts': resolve(process.cwd(), 'packages/contracts/src/index.ts'),
      '@studio/creative-writing': resolve(process.cwd(), 'packages/creative-writing/src/index.ts'),
      '@studio/cloud-setup': resolve(process.cwd(), 'packages/cloud-setup/src/index.ts'),
      '@studio/credential-vault': resolve(process.cwd(), 'packages/credential-vault/src/index.ts'),
      '@studio/domain': resolve(process.cwd(), 'packages/domain/src/index.ts'),
      '@studio/project-store': resolve(process.cwd(), 'packages/project-store/src/index.ts'),
      '@studio/provider-anthropic': resolve(
        process.cwd(),
        'packages/provider-anthropic/src/index.ts'
      ),
      '@studio/provider-openai': resolve(process.cwd(), 'packages/provider-openai/src/index.ts'),
      '@studio/provider-runpod': resolve(process.cwd(), 'packages/provider-runpod/src/index.ts'),
      '@studio/support-diagnostics': resolve(
        process.cwd(),
        'packages/support-diagnostics/src/index.ts'
      )
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

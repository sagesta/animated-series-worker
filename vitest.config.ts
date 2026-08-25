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
      '@studio/local-media': resolve(process.cwd(), 'packages/local-media/src/index.ts'),
      '@studio/local-production': resolve(process.cwd(), 'packages/local-production/src/index.ts'),
      '@studio/project-store': resolve(process.cwd(), 'packages/project-store/src/index.ts'),
      '@studio/provider-anthropic': resolve(
        process.cwd(),
        'packages/provider-anthropic/src/index.ts'
      ),
      '@studio/provider-gemini': resolve(process.cwd(), 'packages/provider-gemini/src/index.ts'),
      '@studio/provider-openai': resolve(process.cwd(), 'packages/provider-openai/src/index.ts'),
      '@studio/provider-runpod': resolve(process.cwd(), 'packages/provider-runpod/src/index.ts'),
      '@studio/release-store': resolve(process.cwd(), 'packages/release-store/src/index.ts'),
      '@studio/production-store': resolve(process.cwd(), 'packages/production-store/src/index.ts'),
      '@studio/production-orchestrator': resolve(
        process.cwd(),
        'packages/production-orchestrator/src/index.ts'
      ),
      '@studio/production-readiness': resolve(
        process.cwd(),
        'packages/production-readiness/src/index.ts'
      ),
      '@studio/skill-runtime': resolve(process.cwd(), 'packages/skill-runtime/src/index.ts'),
      '@studio/support-diagnostics': resolve(
        process.cwd(),
        'packages/support-diagnostics/src/index.ts'
      ),
      '@studio/upstream-adapter': resolve(process.cwd(), 'packages/upstream-adapter/src/index.ts'),
      '@studio/worker-client': resolve(process.cwd(), 'packages/worker-client/src/index.ts'),
      '@studio/workflow-registry': resolve(process.cwd(), 'packages/workflow-registry/src/index.ts')
    }
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**', 'out/**', 'dist/**'],
    environment: 'node',
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 10_000,
    coverage: {
      reporter: ['text', 'html']
    }
  }
})

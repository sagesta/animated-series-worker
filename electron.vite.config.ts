import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const rootDirectory = process.cwd()
const aliases = {
  '@studio/contracts': resolve(rootDirectory, 'packages/contracts/src/index.ts'),
  '@studio/creative-writing': resolve(rootDirectory, 'packages/creative-writing/src/index.ts'),
  '@studio/cloud-setup': resolve(rootDirectory, 'packages/cloud-setup/src/index.ts'),
  '@studio/credential-vault': resolve(rootDirectory, 'packages/credential-vault/src/index.ts'),
  '@studio/domain': resolve(rootDirectory, 'packages/domain/src/index.ts'),
  '@studio/local-media': resolve(rootDirectory, 'packages/local-media/src/index.ts'),
  '@studio/local-production': resolve(rootDirectory, 'packages/local-production/src/index.ts'),
  '@studio/project-store': resolve(rootDirectory, 'packages/project-store/src/index.ts'),
  '@studio/provider-anthropic': resolve(rootDirectory, 'packages/provider-anthropic/src/index.ts'),
  '@studio/provider-gemini': resolve(rootDirectory, 'packages/provider-gemini/src/index.ts'),
  '@studio/provider-openai': resolve(rootDirectory, 'packages/provider-openai/src/index.ts'),
  '@studio/provider-runpod': resolve(rootDirectory, 'packages/provider-runpod/src/index.ts'),
  '@studio/release-store': resolve(rootDirectory, 'packages/release-store/src/index.ts'),
  '@studio/production-store': resolve(rootDirectory, 'packages/production-store/src/index.ts'),
  '@studio/production-orchestrator': resolve(
    rootDirectory,
    'packages/production-orchestrator/src/index.ts'
  ),
  '@studio/production-readiness': resolve(
    rootDirectory,
    'packages/production-readiness/src/index.ts'
  ),
  '@studio/skill-runtime': resolve(rootDirectory, 'packages/skill-runtime/src/index.ts'),
  '@studio/support-diagnostics': resolve(
    rootDirectory,
    'packages/support-diagnostics/src/index.ts'
  ),
  '@studio/upstream-adapter': resolve(rootDirectory, 'packages/upstream-adapter/src/index.ts'),
  '@studio/worker-client': resolve(rootDirectory, 'packages/worker-client/src/index.ts'),
  '@studio/workflow-registry': resolve(rootDirectory, 'packages/workflow-registry/src/index.ts')
}

export default defineConfig({
  main: {
    resolve: { alias: aliases },
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: resolve(rootDirectory, 'apps/desktop/src/main/index.ts')
      }
    }
  },
  preload: {
    resolve: { alias: aliases },
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: resolve(rootDirectory, 'apps/desktop/src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(rootDirectory, 'apps/desktop/src/renderer'),
    base: './',
    resolve: { alias: aliases },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(rootDirectory, 'apps/desktop/src/renderer/index.html')
      }
    }
  }
})

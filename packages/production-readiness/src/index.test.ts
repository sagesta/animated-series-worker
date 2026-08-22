import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyProductionReadiness } from './index'

const roots: string[] = []
const digest = 'a'.repeat(64)
const modelHash = 'b'.repeat(64)

function fixture(): { packPath: string; receiptPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'studio-readiness-'))
  roots.push(root)
  const packPath = join(root, 'workflow-pack.production.json')
  const receiptPath = join(root, 'production-readiness.json')
  writeFileSync(
    packPath,
    JSON.stringify({
      schemaVersion: 1,
      packId: 'test-production',
      packVersion: '1.0.0',
      comfyUiCommit: 'c'.repeat(40),
      workerImage: 'registry.example/studio/worker:1.0.0',
      workerImageDigest: digest,
      workflows: [
        {
          workflowId: 'verified-workflow',
          version: '1.0.0',
          label: 'Verified workflow',
          jobKind: 'qwen-image',
          engine: 'comfyui',
          qualificationState: 'qualified',
          minimumVramGb: 24,
          expectedRuntimeMinutes: 2,
          maximumRuntimeMinutes: 10,
          outputKind: 'image',
          templatePath: 'workflows/verified.json',
          templateSha256: modelHash,
          allowedNodeTypes: ['SaveImage'],
          requiredModels: [
            {
              modelId: 'test/model',
              relativePath: 'models/test.safetensors',
              sha256: modelHash,
              licenseReview: 'accepted'
            }
          ],
          parameters: [],
          notes: []
        }
      ]
    })
  )
  const workflowPackSha256 = createHash('sha256').update(readFileSync(packPath)).digest('hex')
  writeFileSync(
    receiptPath,
    JSON.stringify({
      schemaVersion: 1,
      qualificationId: 'qualification-test',
      provider: 'runpod',
      workflowPackSha256,
      workerImageDigest: digest,
      modelStorage: {
        verified: true,
        method: 'worker-image',
        modelHashesVerified: 1
      },
      workerImage: {
        pulledByDigest: true,
        preflightPassed: true,
        smokeWorkflowPassed: true
      },
      automaticShutdown: {
        idleExitPassed: true,
        hardDeadlineExitPassed: true,
        providerTerminationPassed: true
      },
      testedAt: '2026-08-22T12:00:00.000Z',
      notes: []
    })
  )
  return { packPath, receiptPath }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('production readiness receipt', () => {
  it('unlocks only an unchanged qualified pack with complete shutdown evidence', () => {
    const { packPath, receiptPath } = fixture()
    expect(verifyProductionReadiness(packPath, receiptPath)).toMatchObject({
      modelStorageReady: true,
      workerImageReady: true,
      automaticShutdownTested: true,
      blockers: []
    })
  })

  it('relocks when the qualified pack changes after the controlled test', () => {
    const { packPath, receiptPath } = fixture()
    writeFileSync(packPath, `${readFileSync(packPath, 'utf8')}\n`)
    expect(verifyProductionReadiness(packPath, receiptPath)).toMatchObject({
      workerImageReady: false
    })
  })
})

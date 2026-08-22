import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { WorkflowRegistry, WorkflowRegistryError, idempotencyKey } from './index'

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function fixture(qualificationState: 'candidate' | 'qualified' = 'qualified'): {
  registry: WorkflowRegistry
  templateSha: string
} {
  const root = mkdtempSync(join(tmpdir(), 'studio-workflow-'))
  mkdirSync(join(root, 'workflows'))
  const template = JSON.stringify({
    '1': { class_type: 'StudioTextNode', inputs: { text: '$PARAM:prompt', steps: '$PARAM:steps' } },
    '2': { class_type: 'StudioSaveImage', inputs: { images: ['1', 0] } }
  })
  const templateSha = sha(template)
  writeFileSync(join(root, 'workflows', 'image.json'), template)
  writeFileSync(
    join(root, 'pack.json'),
    JSON.stringify({
      schemaVersion: 1,
      packId: 'fixture',
      packVersion: '1.0.0',
      comfyUiCommit: 'a'.repeat(40),
      workerImage: 'studio/worker:fixture',
      workerImageDigest: 'b'.repeat(64),
      workflows: [
        {
          workflowId: 'image-board',
          version: '1.0.0',
          label: 'Image board',
          jobKind: 'qwen-image',
          engine: 'comfyui',
          qualificationState,
          minimumVramGb: 24,
          expectedRuntimeMinutes: 2,
          maximumRuntimeMinutes: 6,
          outputKind: 'image',
          templatePath: 'workflows/image.json',
          templateSha256: templateSha,
          allowedNodeTypes: ['StudioTextNode', 'StudioSaveImage'],
          requiredModels: [
            {
              modelId: 'qwen-image',
              relativePath: 'models/qwen-image.safetensors',
              sha256: 'c'.repeat(64),
              licenseReview: 'accepted'
            }
          ],
          parameters: [
            { key: 'prompt', label: 'Prompt', type: 'string', required: true, maximumLength: 100 },
            {
              key: 'steps',
              label: 'Steps',
              type: 'integer',
              required: false,
              minimum: 1,
              maximum: 50,
              defaultValue: 20
            }
          ],
          notes: []
        }
      ]
    })
  )
  return { registry: new WorkflowRegistry(join(root, 'pack.json')), templateSha }
}

describe('locked workflow registry', () => {
  it('compiles only declared values into a hash-stable allowlisted graph', () => {
    const { registry } = fixture()
    const one = registry.compile('image-board', '1.0.0', { prompt: 'A consistent hero' })
    const two = registry.compile('image-board', '1.0.0', { steps: 20, prompt: 'A consistent hero' })
    expect(one.prompt).toMatchObject({ '1': { inputs: { text: 'A consistent hero', steps: 20 } } })
    expect(one.workflowSha256).toBe(two.workflowSha256)
    expect(idempotencyKey(one)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('refuses candidate workflows and unknown parameters before spend', () => {
    const { registry } = fixture('candidate')
    expect(() => registry.compile('image-board', '1.0.0', { prompt: 'Hero' })).toThrowError(
      WorkflowRegistryError
    )
    const qualified = fixture().registry
    expect(() =>
      qualified.compile('image-board', '1.0.0', { prompt: 'Hero', installNode: true })
    ).toThrow('Unknown workflow setting')
  })

  it('reports every capability blocker instead of partially qualifying a worker', () => {
    const { registry, templateSha } = fixture()
    const result = registry.qualify('image-board', '1.0.0', {
      schemaVersion: 1,
      workerRelease: 'fixture',
      workerImageDigest: 'd'.repeat(64),
      workflowPackFingerprint: registry.fingerprint(),
      comfyUiCommit: 'e'.repeat(40),
      gpuName: 'RTX 4090',
      vramGb: 16,
      freeDiskGb: 20,
      pythonVersion: '3.12',
      cudaVersion: '12.8',
      installedNodeTypes: ['StudioTextNode'],
      modelHashes: {},
      workflowHashes: { 'image-board@1.0.0': templateSha },
      smokeTestPassed: false,
      checkedAt: '2026-08-22T12:00:00.000Z'
    })
    expect(result.ready).toBe(false)
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'The worker image does not match the approved digest.',
        'ComfyUI does not match the approved commit.',
        'This workflow needs at least 24 GB of GPU memory.',
        'The worker smoke test has not passed.',
        'Required worker node is missing: StudioSaveImage.',
        'Model is missing or unverified: qwen-image.'
      ])
    )
  })

  it('explains expected and worst-case GPU cost without starting work', () => {
    const { registry } = fixture()
    const estimate = registry.estimate(
      'image-board',
      '1.0.0',
      2,
      2,
      120,
      new Date('2026-08-22T12:00:00Z')
    )
    expect(estimate.expectedTotalUsd).toBeCloseTo(0.1333, 3)
    expect(estimate.maximumTotalUsd).toBeCloseTo(0.4, 3)
    expect(estimate.gpuCount).toBe(2)
  })
})

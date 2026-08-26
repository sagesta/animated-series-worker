import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
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
      gpuClassVramGb: 16,
      freeDiskGb: 20,
      pythonVersion: '3.12',
      cudaVersion: '12.8',
      nvidiaDriverVersion: '595.45.01',
      latentsyncPythonVersion: 'Python 3.10.20',
      ltxTrainerPythonVersion: 'Python 3.12.3',
      ltxTrainerTorchVersion: '2.13.0+cu132',
      ltxTrainerCudaVersion: '13.2',
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

  it('loads advanced definitions and hash-locks every implemented graph and runner contract', () => {
    const registry = new WorkflowRegistry(
      resolve(process.cwd(), 'config', 'workflow-pack.candidate.json')
    )
    const expected = [
      'ltx2-audio-driven-dialogue',
      'qwen-image-controlled-board',
      'ltx2-controlled-shot',
      'rights-aware-foley-generation',
      'ltx25-project-lora-adaptation'
    ]
    const expectedTemplates: Record<string, string> = {
      'ltx2-audio-driven-dialogue': 'workflows/candidate/ltx2-audio-driven-dialogue.api.json',
      'qwen-image-controlled-board': 'workflows/candidate/qwen-image-controlled-board.api.json',
      'ltx2-controlled-shot': 'workflows/candidate/ltx2-controlled-shot.api.json',
      'rights-aware-foley-generation':
        'workflows/candidate/rights-aware-foley-generation.contract.json',
      'ltx25-project-lora-adaptation':
        'workflows/candidate/ltx25-project-lora-adaptation.contract.json'
    }
    for (const workflowId of expected) {
      const workflow = registry.get(workflowId, '1.0.0')
      expect(workflow.qualificationState).toBe('candidate')
      expect(workflow.qualificationTier).toBe('advanced')
      expect(workflow.templatePath).toBe(expectedTemplates[workflowId])
      expect(workflow.templateSha256).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('hash-locks and compiles the reviewed core image and LTX candidate graphs', () => {
    const registry = new WorkflowRegistry(
      resolve(process.cwd(), 'config', 'workflow-pack.candidate.json')
    )
    const image = registry.compile(
      'qwen-image-character-board',
      '1.0.0',
      {
        prompt: 'Approved hero turnaround board',
        negativePrompt: '',
        seed: 12,
        width: 1024,
        height: 1024
      },
      { allowCandidate: true }
    )
    expect(image.prompt['10']).toMatchObject({ class_type: 'SaveImage' })
    expect(image.prompt['4']).toMatchObject({
      inputs: { text: 'Approved hero turnaround board' }
    })

    const motion = registry.compile(
      'ltx2-image-to-video-draft',
      '1.0.0',
      {
        motionPrompt: 'The hero turns toward camera while the camera slowly pushes in.',
        durationSeconds: 5,
        seed: 42,
        framesPerSecond: 24
      },
      { allowCandidate: true }
    )
    expect(motion.prompt['11']).toMatchObject({
      class_type: 'ComfyMathExpression',
      inputs: { 'values.a': 5, 'values.b': 24 }
    })
    expect(motion.prompt['27']).toMatchObject({ class_type: 'SaveVideo' })
  })

  it('compiles the advanced A2V and control graphs without prompt-network nodes', () => {
    const registry = new WorkflowRegistry(
      resolve(process.cwd(), 'config', 'workflow-pack.candidate.json')
    )
    const sourceManifest = JSON.stringify({ direction: 'reviewed', assets: [{ order: 1 }] })
    const a2v = registry.compile(
      'ltx2-audio-driven-dialogue',
      '1.0.0',
      {
        motionPrompt: 'The approved character performs the supplied dialogue with subtle motion.',
        preserveApprovedAudio: true,
        seed: 44
      },
      { allowCandidate: true }
    )
    expect(JSON.stringify(a2v.prompt)).not.toMatch(/GemmaAPITextEncode|TextGenerateLTX2Prompt/)
    expect(
      Object.values(a2v.prompt).find(
        (node) =>
          (node as { _meta?: { title?: string } })._meta?.title ===
          'CLIP Text Encode (Positive Prompt)'
      )
    ).toMatchObject({ inputs: { text: expect.stringContaining('approved character') } })
    expect(
      Object.values(a2v.prompt)
        .filter((node) => (node as { class_type?: string }).class_type === 'RandomNoise')
        .every((node) => (node as { inputs: { noise_seed: number } }).inputs.noise_seed === 44)
    ).toBe(true)

    const qwen = registry.compile(
      'qwen-image-controlled-board',
      '1.0.0',
      {
        prompt: 'Keep the approved identity and follow the supplied pose reference.',
        controlManifestJson: sourceManifest,
        seed: 45
      },
      { allowCandidate: true }
    )
    expect(
      Object.values(qwen.prompt).find(
        (node) => (node as { class_type?: string }).class_type === 'TextEncodeQwenImageEditPlus'
      )
    ).toMatchObject({ inputs: { prompt: expect.stringContaining('approved identity') } })

    const controlled = registry.compile(
      'ltx2-controlled-shot',
      '1.0.0',
      {
        motionPrompt: 'Use the approved reference sheet while the character crosses the room.',
        controlManifestJson: sourceManifest,
        durationSeconds: 6,
        seed: 46
      },
      { allowCandidate: true }
    )
    expect(JSON.stringify(controlled.prompt)).not.toContain('GemmaAPITextEncode')
    expect(
      Object.values(controlled.prompt).find(
        (node) => (node as { class_type?: string }).class_type === 'ComfyMathExpression'
      )
    ).toMatchObject({ inputs: { 'values.b': 6 } })
  })
})

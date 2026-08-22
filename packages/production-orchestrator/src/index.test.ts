import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectStore } from '@studio/project-store'
import { ProductionStore } from '@studio/production-store'
import { WorkflowRegistry } from '@studio/workflow-registry'
import { ProductionOrchestrator } from './index'

const roots: string[] = []
const now = new Date('2026-08-22T12:00:00.000Z')

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'studio-orchestrator-'))
  roots.push(value)
  return value
}

function projectInput() {
  return {
    title: 'The Lantern Keepers',
    type: 'series' as const,
    language: 'English',
    targetDurationMinutes: 25,
    visualDirection: '2d' as const,
    sourceMode: 'original' as const,
    pilotBrief: 'Two young keepers protect a floating city.',
    creativeDirection: {
      targetAudience: 'Families who enjoy adventurous fantasy stories.',
      ageBand: 'all-ages' as const,
      primaryNiche: 'African folklore fantasy',
      genres: ['fantasy'],
      toneKeywords: ['warm'],
      coreThemes: ['belonging'],
      storyPromise: 'Every episode resolves a community mystery.',
      culturalSetting: 'A fictional coastal kingdom.',
      contentBoundaries: ['No graphic violence'],
      episodeFormat: 'A recurring 25-minute episode.',
      youtubePositioning: '',
      visualStyleNotes: 'Painted 2D shapes.',
      comparableTitles: [],
      differentiation: 'Community mysteries inspired by coastal folklore.'
    }
  }
}

function cloudStatus(ready = false) {
  return {
    provider: 'runpod' as const,
    connectionState: 'connected' as const,
    credentialStored: true,
    guardrails: {
      maxSessionCostUsd: 10,
      maxRuntimeMinutes: 120,
      idleTimeoutMinutes: 10,
      maxConcurrentGpus: 3
    },
    guardrailsSaved: true,
    account: {
      checkedAt: now.toISOString(),
      totalPods: 0,
      activePods: 0,
      activeHourlyCostUsd: 0
    },
    gpuCatalogCheckedAt: now.toISOString(),
    gpuOptions: [
      {
        id: 'NVIDIA A100-SXM4-80GB',
        name: 'A100 SXM',
        memoryGb: 80,
        secureHourlyUsd: 2,
        communityHourlyUsd: 1.5,
        ltxCompatibility: 'meets-baseline' as const
      }
    ],
    catalogMessage: null,
    validationCostUsd: 0 as const,
    setupChecklist: {
      accountConnected: true,
      guardrailsSaved: true,
      modelStorageReady: ready,
      workerImageReady: ready,
      automaticShutdownTested: ready
    },
    generationState: ready ? ('ready' as const) : ('locked' as const),
    generationReason: ready
      ? 'Production checks are complete.'
      : 'Production qualification remains required.'
  }
}

function qualifiedRegistry(directory: string): WorkflowRegistry {
  const packPath = join(directory, 'qualified-pack.json')
  writeFileSync(
    packPath,
    JSON.stringify({
      schemaVersion: 1,
      packId: 'qualified-fixture',
      packVersion: '1.0.0',
      comfyUiCommit: 'a'.repeat(40),
      workerImage: 'registry.example/studio-worker:1.0.0',
      workerImageDigest: 'b'.repeat(64),
      workflows: [
        {
          workflowId: 'qwen3-tts-voice-design',
          version: '1.0.0',
          label: 'Original voice design',
          jobKind: 'qwen3-tts',
          engine: 'worker-python',
          qualificationState: 'qualified',
          minimumVramGb: 16,
          expectedRuntimeMinutes: 2,
          maximumRuntimeMinutes: 8,
          outputKind: 'audio',
          templatePath: null,
          templateSha256: null,
          allowedNodeTypes: [],
          requiredModels: [],
          parameters: [
            { key: 'text', label: 'Line', type: 'string', required: true, maximumLength: 200 }
          ],
          notes: []
        }
      ]
    })
  )
  return new WorkflowRegistry(packPath)
}

afterEach(() => {
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('production orchestration safety', () => {
  it('shows candidate stages and calculates an estimate without creating a Pod', async () => {
    const directory = root()
    const projects = new ProjectStore({ workspaceRoot: join(directory, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({ projectStore: projects, now: () => now })
    const runPod = {
      createPod: vi.fn(),
      getPod: vi.fn(),
      findPodByLease: vi.fn(),
      terminatePod: vi.fn()
    }
    const orchestrator = new ProductionOrchestrator({
      workflowRegistry: new WorkflowRegistry(
        join(process.cwd(), 'config', 'workflow-pack.candidate.json')
      ),
      productionStore: production,
      cloud: {
        getStatus: vi.fn().mockResolvedValue(cloudStatus()),
        refresh: vi.fn().mockResolvedValue(cloudStatus())
      },
      runPodCredential: { readSecret: vi.fn().mockResolvedValue('runpod-secret') },
      leaseTokenVault: { storeSecret: vi.fn(), readSecret: vi.fn(), removeSecret: vi.fn() },
      runPod,
      now: () => now
    })
    const image = orchestrator
      .listWorkflows()
      .find((workflow) => workflow.workflowId === 'qwen-image-character-board')
    expect(image).toMatchObject({ readyForPaidWork: false, requiresGpu: true })
    expect(image?.blockers).not.toHaveLength(0)
    const estimate = await orchestrator.estimateWorkflow({
      projectId: project.manifest.id,
      workflowId: 'qwen-image-character-board',
      workflowVersion: '1.0.0',
      gpuTypeId: 'NVIDIA A100-SXM4-80GB',
      priceTier: 'secure',
      gpuCount: 1
    })
    expect(estimate).toMatchObject({ ok: true, estimate: { hourlyRateUsdPerGpu: 2 } })
    expect(runPod.createPod).not.toHaveBeenCalled()
    projects.close()
  })

  it('reserves one protected lease and sends only the token hash to a qualified worker', async () => {
    const directory = root()
    const projects = new ProjectStore({ workspaceRoot: join(directory, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({
      projectStore: projects,
      now: () => now,
      maxSessionCostUsd: () => 10
    })
    const registry = qualifiedRegistry(directory)
    const estimate = registry.estimate('qwen3-tts-voice-design', '1.0.0', 2, 1, 120, now)
    const planned = production.planJob({
      projectId: project.manifest.id,
      kind: 'qwen3-tts',
      label: 'Ayo voice calibration',
      workflowId: 'qwen3-tts-voice-design',
      workflowVersion: '1.0.0',
      inputAssetIds: [],
      canonIds: [],
      parameters: {
        text: 'The eastern lantern is awake.',
        studioGpuTypeId: 'NVIDIA A100-SXM4-80GB',
        studioPriceTier: 'secure',
        studioOutputKind: 'voice-line'
      },
      idempotencyKey: 'c'.repeat(64),
      estimate
    })
    if (!planned.ok) throw new Error('plan fixture failed')
    const approved = production.approveJob({
      projectId: project.manifest.id,
      jobId: planned.details.job.jobId,
      expectedEstimateId: estimate.estimateId,
      acceptedMaximumUsd: estimate.maximumTotalUsd,
      confirmation: true
    })
    if (!approved.ok) throw new Error('approval fixture failed')
    const tokenVault = { storeSecret: vi.fn(), readSecret: vi.fn(), removeSecret: vi.fn() }
    const runPod = {
      createPod: vi.fn().mockResolvedValue({ id: 'pod-one' }),
      getPod: vi.fn(),
      findPodByLease: vi.fn(),
      terminatePod: vi.fn()
    }
    const orchestrator = new ProductionOrchestrator({
      workflowRegistry: registry,
      productionStore: production,
      cloud: {
        getStatus: vi.fn().mockResolvedValue(cloudStatus(true)),
        refresh: vi.fn().mockResolvedValue(cloudStatus(true))
      },
      runPodCredential: { readSecret: vi.fn().mockResolvedValue('runpod-secret') },
      leaseTokenVault: tokenVault,
      runPod,
      now: () => now
    })
    const queued = await orchestrator.queueApprovedJob({
      projectId: project.manifest.id,
      jobId: approved.details.job.jobId,
      expectedEstimateId: estimate.estimateId,
      confirmation: true
    })
    expect(queued).toMatchObject({
      ok: true,
      details: { job: { state: 'provisioning', workerPodId: 'pod-one' } }
    })
    const storedToken = tokenVault.storeSecret.mock.calls[0]?.[1]
    const createInput = runPod.createPod.mock.calls[0]?.[1]
    expect(storedToken).toHaveLength(43)
    expect(createInput.environment.STUDIO_GATEWAY_TOKEN_HASH).toMatch(/^[a-f0-9]{64}$/)
    expect(createInput.environment.STUDIO_GATEWAY_TOKEN_HASH).not.toBe(storedToken)
    expect(createInput.environment.STUDIO_MODEL_BOOTSTRAP_MODE).toBe('production')
    expect(createInput.environment.STUDIO_REQUIRED_MODEL_IDS).toBe('')
    expect(createInput.ports).toEqual(['8000/http'])
    expect(JSON.stringify(createInput)).not.toContain(storedToken)
    projects.close()
  })
})

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const temporaryRoots: string[] = []

function sha(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('GPU worker promotion', () => {
  it('promotes only the complete core workflow set and leaves advanced candidates locked', () => {
    const candidatePackPath = resolve(projectRoot, 'config', 'workflow-pack.candidate.json')
    const candidateManifestPath = resolve(
      projectRoot,
      'config',
      'model-install-manifest.candidate.json'
    )
    const evidenceTemplate = JSON.parse(
      readFileSync(
        resolve(projectRoot, 'config', 'gpu-qualification-evidence.template.json'),
        'utf8'
      )
    )
    const candidatePack = JSON.parse(readFileSync(candidatePackPath, 'utf8'))
    const candidateManifest = JSON.parse(readFileSync(candidateManifestPath, 'utf8'))
    const promotionPolicy = JSON.parse(
      readFileSync(resolve(projectRoot, 'config', 'core-promotion-policy.json'), 'utf8')
    )
    const excludedWorkflowIds = new Set<string>(promotionPolicy.excludedWorkflowIds)
    const root = mkdtempSync(resolve(tmpdir(), 'studio-promotion-'))
    temporaryRoots.push(root)

    const coreWorkflows = candidatePack.workflows.filter(
      (workflow: { qualificationTier?: string; workflowId: string }) =>
        workflow.qualificationTier !== 'advanced' &&
        !excludedWorkflowIds.has(workflow.workflowId)
    )
    const coreModelIds = new Set(
      coreWorkflows.flatMap((workflow: { requiredModels?: Array<{ modelId: string }> }) =>
        (workflow.requiredModels ?? []).map((model) => model.modelId)
      )
    )
    const coreModels = candidateManifest.models.filter((model: { modelId: string }) =>
      coreModelIds.has(model.modelId)
    )
    const modelHashes = Object.fromEntries(
      coreModels.map((model: { modelId: string }) => [model.modelId, sha(model.modelId)])
    )
    const workflowHashes: Record<string, string> = {}
    const installedNodeTypes = new Set<string>()
    for (const workflow of candidatePack.workflows) {
      for (const node of workflow.allowedNodeTypes ?? []) installedNodeTypes.add(node)
      if (workflow.templatePath) {
        workflowHashes[`${workflow.workflowId}@${workflow.version}`] = sha(
          readFileSync(resolve(dirname(candidatePackPath), workflow.templatePath))
        )
      }
    }

    const imageDigest = sha('controlled worker image')
    const testedAt = '2026-08-25T12:00:00.000Z'
    const modelReceiptPath = resolve(root, 'models.json')
    const capabilityPath = resolve(root, 'capability.json')
    const evidencePath = resolve(root, 'evidence.json')
    const productionPackPath = resolve(root, 'workflow-pack.production.json')
    const productionManifestPath = resolve(root, 'model-install-manifest.production.json')
    const readinessPath = resolve(root, 'production-readiness.json')
    writeJson(modelReceiptPath, {
      schemaVersion: 1,
      qualificationMode: true,
      models: coreModels.map(
        (model: {
          modelId: string
          repository: string
          revision: string
          destination: string
        }) => ({
          modelId: model.modelId,
          repository: model.repository,
          revision: model.revision,
          destination: model.destination,
          sha256: modelHashes[model.modelId]
        })
      )
    })
    writeJson(capabilityPath, {
      schemaVersion: 1,
      smokeTestPassed: true,
      workerImageDigest: imageDigest,
      workflowPackFingerprint: sha(
        stableJson({ ...candidatePack, workerImageDigest: null })
      ),
      comfyUiCommit: candidatePack.comfyUiCommit,
      vramGb: 48,
      nvidiaDriverVersion: '572.83',
      ltxTrainerCudaVersion: 'unavailable',
      installedNodeTypes: [...installedNodeTypes],
      modelHashes,
      workflowHashes
    })
    const passingEvidence = {
      ...evidenceTemplate,
      qualificationId: 'controlled-fixture',
      workerImage: 'registry.example/studio-worker:0.10.1',
      workerImageDigest: imageDigest,
      testedAt,
      reviewer: 'Fixture reviewer',
      licenseApprovals: coreModels.map((model: { modelId: string }) => ({
        modelId: model.modelId,
        decision: 'accepted',
        reviewer: 'Fixture reviewer',
        reviewedAt: testedAt
      })),
      tests: evidenceTemplate.tests.map((test: { testId: string }) => ({
        testId: test.testId,
        passed: !test.testId.startsWith('BENCH-LIP-'),
        evidence: test.testId.startsWith('BENCH-LIP-')
          ? 'deferred by the accepted core promotion policy'
          : 'controlled fixture evidence'
      }))
    }

    const promotionArguments = [
      resolve(projectRoot, 'scripts', 'Promote-GpuWorker.mjs'),
      '--model-receipt',
      modelReceiptPath,
      '--capability-report',
      capabilityPath,
      '--evidence',
      evidencePath,
      '--candidate-pack',
      candidatePackPath,
      '--candidate-manifest',
      candidateManifestPath,
      '--production-pack',
      productionPackPath,
      '--production-manifest',
      productionManifestPath,
      '--readiness',
      readinessPath
    ]
    writeJson(evidencePath, {
      ...passingEvidence,
      tests: passingEvidence.tests.map((test: { testId: string }) =>
        test.testId === 'BENCH-LTX-FINAL' ? { ...test, passed: false } : test
      )
    })
    expect(() =>
      execFileSync(process.execPath, promotionArguments, {
        cwd: projectRoot,
        stdio: 'pipe'
      })
    ).toThrow()
    expect(existsSync(productionPackPath)).toBe(false)

    writeJson(evidencePath, passingEvidence)
    execFileSync(process.execPath, promotionArguments, { cwd: projectRoot })

    const productionPack = JSON.parse(readFileSync(productionPackPath, 'utf8'))
    expect(productionPack.workflows).toHaveLength(coreWorkflows.length)
    expect(productionPack.workflows.every((workflow: { qualificationState: string }) =>
      workflow.qualificationState === 'qualified'
    )).toBe(true)
    expect(productionPack.workflows.some(
      (workflow: { qualificationTier?: string }) => workflow.qualificationTier === 'advanced'
    )).toBe(false)
    expect(productionPack.workflows.some(
      (workflow: { workflowId: string }) => workflow.workflowId === 'ltx25-project-lora-adaptation'
    )).toBe(false)
    expect(productionPack.workflows.some(
      (workflow: { workflowId: string }) => workflow.workflowId === 'latentsync-lip-repair'
    )).toBe(false)
    const productionManifest = JSON.parse(readFileSync(productionManifestPath, 'utf8'))
    expect(productionManifest.models).toHaveLength(coreModels.length)
    expect(productionManifest.models.some(
      (model: { modelId: string }) => model.modelId === 'Lightricks/LTX-2.5/dev-transformer-bf16'
    )).toBe(false)
    expect(productionManifest.models.some(
      (model: { modelId: string }) => model.modelId === 'ByteDance/LatentSync-1.6'
    )).toBe(false)
    expect(productionManifest.models.some(
      (model: { modelId: string }) => model.modelId === 'stabilityai/sd-vae-ft-mse'
    )).toBe(false)
    const readiness = JSON.parse(readFileSync(readinessPath, 'utf8'))
    expect(readiness.promotionPolicy).toEqual({
      version: promotionPolicy.policyVersion,
      excludedCandidateWorkflows: ['latentsync-lip-repair']
    })
  })
})

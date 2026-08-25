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
  it('promotes every core, advanced, and local workflow only from complete evidence', () => {
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
    const root = mkdtempSync(resolve(tmpdir(), 'studio-promotion-'))
    temporaryRoots.push(root)

    const modelHashes = Object.fromEntries(
      candidateManifest.models.map((model: { modelId: string }) => [model.modelId, sha(model.modelId)])
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
      models: candidateManifest.models.map(
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
      vramGb: 80,
      nvidiaDriverVersion: '595.45.01',
      ltxTrainerCudaVersion: '13.2',
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
      licenseApprovals: candidateManifest.models.map((model: { modelId: string }) => ({
        modelId: model.modelId,
        decision: 'accepted',
        reviewer: 'Fixture reviewer',
        reviewedAt: testedAt
      })),
      tests: evidenceTemplate.tests.map((test: { testId: string }) => ({
        testId: test.testId,
        passed: true,
        evidence: 'controlled fixture evidence'
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
        test.testId === 'BENCH-ADAPTATION' ? { ...test, passed: false } : test
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
    expect(productionPack.workflows).toHaveLength(candidatePack.workflows.length)
    expect(productionPack.workflows.every((workflow: { qualificationState: string }) =>
      workflow.qualificationState === 'qualified'
    )).toBe(true)
    expect(
      productionPack.workflows.filter(
        (workflow: { qualificationTier?: string }) => workflow.qualificationTier === 'advanced'
      )
    ).toHaveLength(5)
  })
})

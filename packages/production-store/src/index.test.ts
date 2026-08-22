import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WritingDraftRecordSchema, type ProductionJobInput } from '@studio/contracts'
import { ProjectStore } from '@studio/project-store'
import { ProductionStore, hashJson } from './index'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studio-production-store-'))
  roots.push(root)
  return root
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
      genres: ['fantasy', 'family adventure'],
      toneKeywords: ['warm', 'mysterious'],
      coreThemes: ['belonging'],
      storyPromise: 'Every episode resolves a magical community mystery with hope.',
      culturalSetting: 'A fictional coastal kingdom.',
      contentBoundaries: ['No graphic violence'],
      episodeFormat: 'A recurring 25-minute episode.',
      youtubePositioning: '',
      visualStyleNotes: 'Painted 2D shapes and expressive silhouettes.',
      comparableTitles: [],
      differentiation: 'Community mysteries inspired by coastal folklore.'
    }
  }
}

function writingDraft(projectId: string, profileId: string, draftId: string) {
  return WritingDraftRecordSchema.parse({
    schemaVersion: 2,
    draftId,
    projectId,
    taskKind: 'develop_character',
    status: 'proposal',
    provider: 'openai',
    model: 'gpt-5.2',
    profile: 'balanced',
    createdAt: '2026-08-22T10:00:00.000Z',
    instruction: 'Develop a dependable lead character for the pilot episode.',
    contextSnapshotSha256: 'a'.repeat(64),
    output: {
      title: 'Ayo, Keeper of the Eastern Lantern',
      summary: 'A careful young keeper who learns to trust her instincts.',
      sections: [
        { heading: 'Identity', body: 'Ayo is twelve, observant, patient, and quietly funny.' },
        {
          heading: 'Visual anchors',
          body: 'Indigo coat, brass lantern, crescent-shaped braid pin.'
        }
      ],
      continuityQuestions: ['Which hand always carries the lantern?'],
      suggestedNextSteps: ['Create front, side, and expression reference boards.']
    },
    usage: {
      inputTokens: 500,
      outputTokens: 700,
      totalTokens: 1200,
      cachedInputTokens: 0
    },
    cost: {
      currency: 'USD',
      estimatedUsd: null,
      actualUsd: null,
      state: 'not-calculated'
    },
    providerRequestId: 'request-1',
    contextSelection: {
      includeProjectBrief: true,
      includeProductionSettings: true,
      includeCreativeDirection: true
    },
    sourceVersions: [
      {
        kind: 'creative-direction',
        id: profileId,
        schemaVersion: 1,
        revision: 1,
        updatedAt: '2026-08-22T10:00:00.000Z',
        sha256: 'b'.repeat(64)
      }
    ],
    skillsPlanned: [],
    skillsUsed: []
  })
}

function estimate() {
  return {
    estimateId: '01K37Q0Z000000000000000010',
    currency: 'USD' as const,
    gpuCount: 1,
    hourlyRateUsdPerGpu: 2,
    expectedRuntimeMinutes: 5,
    maximumRuntimeMinutes: 15,
    expectedComputeUsd: 0.17,
    maximumComputeUsd: 0.5,
    storageUsd: 0,
    providerExtrasUsd: 0,
    expectedTotalUsd: 0.17,
    maximumTotalUsd: 0.5,
    explanation: ['One five-minute image pass on one temporary GPU.'],
    priceSource: 'Saved planning fixture',
    pricedAt: '2026-08-22T10:00:00.000Z',
    expiresAt: '2026-08-22T12:00:00.000Z'
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('production truth store', () => {
  it('promotes an exact reviewed proposal into immutable versioned canon once', () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const draft = writingDraft(
      project.manifest.id,
      project.creativeDirection!.profileId,
      '01K37Q0Z000000000000000001'
    )
    projects.saveWritingDraft(draft)
    const production = new ProductionStore({ projectStore: projects })

    const stale = production.promoteWritingDraft({
      projectId: project.manifest.id,
      draftId: draft.draftId,
      expectedDraftSha256: '0'.repeat(64),
      kind: 'character',
      label: 'Ayo',
      reason: 'The identity and visual anchors have been reviewed for the pilot.',
      confirmation: true
    })
    expect(stale).toMatchObject({ ok: false, error: { code: 'stale-data' } })

    const approved = production.promoteWritingDraft({
      projectId: project.manifest.id,
      draftId: draft.draftId,
      expectedDraftSha256: hashJson(draft),
      kind: 'character',
      label: 'Ayo',
      reason: 'The identity and visual anchors have been reviewed for the pilot.',
      confirmation: true
    })
    expect(approved).toMatchObject({
      ok: true,
      canon: { kind: 'character', label: 'Ayo', revision: 1, state: 'active' }
    })
    expect(production.getWorkspace(project.manifest.id).draftFingerprints).toEqual([
      { draftId: draft.draftId, sha256: hashJson(draft), alreadyPromoted: true }
    ])

    const duplicate = production.promoteWritingDraft({
      projectId: project.manifest.id,
      draftId: draft.draftId,
      expectedDraftSha256: hashJson(draft),
      kind: 'character',
      label: 'Ayo',
      reason: 'The identity and visual anchors have been reviewed for the pilot.',
      confirmation: true
    })
    expect(duplicate).toMatchObject({ ok: false, error: { code: 'invalid-state' } })
    projects.close()
  })

  it('copies imported media into one project and requires a recorded human decision', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const source = join(root, 'reference.png')
    writeFileSync(source, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
    const production = new ProductionStore({ projectStore: projects })

    const imported = await production.importMedia({
      projectId: project.manifest.id,
      kind: 'reference-image',
      label: 'Ayo face reference',
      sourcePath: source,
      origin: 'imported',
      parentAssetIds: []
    })
    if (!imported.ok) throw new Error(JSON.stringify(imported.error))
    expect(imported.asset).toMatchObject({ state: 'candidate', mimeType: 'image/png' })
    expect(production.resolveMediaPath(project.manifest.id, imported.asset.assetId).path).not.toBe(
      source
    )

    const approved = production.reviewMedia({
      projectId: project.manifest.id,
      assetId: imported.asset.assetId,
      expectedSha256: imported.asset.sha256,
      decision: 'approved',
      reason: 'The face, colours, and proportions match the approved character direction.',
      confirmation: true
    })
    expect(approved).toMatchObject({ ok: true, asset: { state: 'approved' } })
    projects.close()
  })

  it('refuses unapproved inputs and separates estimating from cost approval and execution', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const source = join(root, 'reference.png')
    writeFileSync(source, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
    const production = new ProductionStore({
      projectStore: projects,
      now: () => new Date('2026-08-22T11:00:00.000Z'),
      maxSessionCostUsd: () => 1
    })
    const imported = await production.importMedia({
      projectId: project.manifest.id,
      kind: 'reference-image',
      label: 'Ayo face reference',
      sourcePath: source,
      origin: 'imported',
      parentAssetIds: []
    })
    if (!imported.ok) throw new Error(JSON.stringify(imported.error))
    const jobInput: ProductionJobInput = {
      projectId: project.manifest.id,
      kind: 'qwen-image',
      label: 'Ayo expression board',
      workflowId: 'qwen-image-character-board',
      workflowVersion: '1.0.0',
      inputAssetIds: [imported.asset.assetId],
      canonIds: [],
      parameters: { width: 1024, height: 1024, candidates: 4 },
      idempotencyKey: 'c'.repeat(64),
      estimate: estimate()
    }

    expect(production.planJob(jobInput)).toMatchObject({
      ok: false,
      error: { code: 'approval-required' }
    })
    production.reviewMedia({
      projectId: project.manifest.id,
      assetId: imported.asset.assetId,
      expectedSha256: imported.asset.sha256,
      decision: 'approved',
      reason: 'This is the reviewed identity reference for the character board.',
      confirmation: true
    })
    const planned = production.planJob(jobInput)
    expect(planned).toMatchObject({ ok: true, details: { job: { state: 'estimated' } } })
    if (!planned.ok) throw new Error('fixture plan failed')
    expect(planned.details.events).toHaveLength(1)

    const approved = production.approveJob({
      projectId: project.manifest.id,
      jobId: planned.details.job.jobId,
      expectedEstimateId: planned.details.job.estimate.estimateId,
      acceptedMaximumUsd: 0.5,
      confirmation: true
    })
    expect(approved).toMatchObject({ ok: true, details: { job: { state: 'approved' } } })
    if (!approved.ok) throw new Error('fixture approval failed')
    expect(approved.details.events.at(-1)?.message).toContain('not been queued')
    projects.close()
  })

  it('records canon consumers and marks only their exact downstream dependencies stale on redesign', () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const firstDraft = writingDraft(
      project.manifest.id,
      project.creativeDirection!.profileId,
      '01K37Q0Z000000000000000021'
    )
    const secondDraft = WritingDraftRecordSchema.parse({
      ...firstDraft,
      draftId: '01K37Q0Z000000000000000022',
      output: {
        ...firstDraft.output,
        summary: 'A bolder redesign with a red coat and a different lantern silhouette.'
      }
    })
    projects.saveWritingDraft(firstDraft)
    projects.saveWritingDraft(secondDraft)
    const production = new ProductionStore({
      projectStore: projects,
      now: () => new Date('2026-08-22T11:00:00.000Z')
    })
    const first = production.promoteWritingDraft({
      projectId: project.manifest.id,
      draftId: firstDraft.draftId,
      expectedDraftSha256: hashJson(firstDraft),
      kind: 'character',
      label: 'Ayo',
      reason: 'The first character identity was reviewed and approved for the pilot.',
      confirmation: true
    })
    if (!first.ok) throw new Error(first.error.message)
    const planned = production.planJob({
      projectId: project.manifest.id,
      kind: 'qwen-image',
      label: 'Ayo identity board',
      workflowId: 'qwen-image-character-board',
      workflowVersion: '1.0.0',
      inputAssetIds: [],
      canonIds: [first.canon.canonId],
      parameters: { prompt: 'Approved Ayo character board' },
      idempotencyKey: 'd'.repeat(64),
      estimate: estimate()
    })
    expect(planned).toMatchObject({ ok: true })
    const before = production.getWorkspace(project.manifest.id)
    expect(before.canonImpacts).toEqual([
      expect.objectContaining({
        canonId: first.canon.canonId,
        dependentCount: 1,
        staleDependentCount: 0,
        affectedTypes: ['image']
      })
    ])

    const second = production.promoteWritingDraft({
      projectId: project.manifest.id,
      draftId: secondDraft.draftId,
      expectedDraftSha256: hashJson(secondDraft),
      kind: 'character',
      label: 'Ayo',
      reason: 'The redesign was explicitly approved after reviewing its downstream impact.',
      confirmation: true
    })
    if (!second.ok) throw new Error(second.error.message)
    const after = production.getWorkspace(project.manifest.id)
    expect(after.staleDependencyCount).toBe(1)
    expect(
      after.canonImpacts.find((impact) => impact.canonId === first.canon.canonId)
    ).toMatchObject({ dependentCount: 1, staleDependentCount: 1 })
    expect(
      after.canonImpacts.find((impact) => impact.canonId === second.canon.canonId)
    ).toMatchObject({ dependentCount: 0, staleDependentCount: 0 })
    projects.close()
  })
})

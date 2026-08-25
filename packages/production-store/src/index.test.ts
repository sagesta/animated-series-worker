import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

  it('rejects a valid file whose media type does not match its selected production role', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const source = join(root, 'not-a-master.png')
    writeFileSync(source, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
    const production = new ProductionStore({ projectStore: projects })

    const result = await production.importMedia({
      projectId: project.manifest.id,
      kind: 'master-video',
      label: 'Incorrectly labelled master',
      sourcePath: source,
      origin: 'imported',
      parentAssetIds: []
    })

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'invalid-input',
        message: 'That file does not match the selected master video role.'
      }
    })
    expect(production.getWorkspace(project.manifest.id).media).toHaveLength(0)
    projects.close()
  })

  it('blocks cross-project references until an approved asset is explicitly copied', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const sourceProject = projects.createProject(projectInput())
    const targetProject = projects.createProject({
      ...projectInput(),
      title: 'The Harbour Bell',
      pilotBrief: 'A young bell keeper follows a mysterious light across the harbour.'
    })
    const source = join(root, 'reference.png')
    writeFileSync(source, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'))
    const production = new ProductionStore({ projectStore: projects })
    const imported = await production.importMedia({
      projectId: sourceProject.manifest.id,
      kind: 'reference-image',
      label: 'Ayo approved identity',
      sourcePath: source,
      origin: 'imported',
      parentAssetIds: []
    })
    if (!imported.ok) throw new Error(imported.error.message)

    expect(() =>
      production.resolveMediaPath(targetProject.manifest.id, imported.asset.assetId)
    ).toThrow(/could not be found/i)
    expect(
      await production.copyMedia({
        sourceProjectId: sourceProject.manifest.id,
        sourceAssetId: imported.asset.assetId,
        targetProjectId: targetProject.manifest.id,
        label: 'Ayo identity copy',
        confirmation: true
      })
    ).toMatchObject({ ok: false, error: { code: 'approval-required' } })

    const approved = production.reviewMedia({
      projectId: sourceProject.manifest.id,
      assetId: imported.asset.assetId,
      expectedSha256: imported.asset.sha256,
      decision: 'approved',
      reason: 'The identity reference was reviewed and approved for controlled reuse.',
      confirmation: true
    })
    if (!approved.ok) throw new Error(approved.error.message)
    const copied = await production.copyMedia({
      sourceProjectId: sourceProject.manifest.id,
      sourceAssetId: imported.asset.assetId,
      targetProjectId: targetProject.manifest.id,
      label: 'Ayo identity copy',
      confirmation: true
    })
    if (!copied.ok) throw new Error(copied.error.message)
    expect(copied.asset).toMatchObject({
      projectId: targetProject.manifest.id,
      state: 'candidate',
      sha256: imported.asset.sha256,
      copiedFrom: {
        projectId: sourceProject.manifest.id,
        assetId: imported.asset.assetId,
        sha256: imported.asset.sha256
      }
    })
    expect(
      production.resolveMediaPath(targetProject.manifest.id, copied.asset.assetId).path
    ).not.toBe(production.resolveMediaPath(sourceProject.manifest.id, imported.asset.assetId).path)
    projects.close()
  })

  it('builds a strict project-only adaptation manifest from ordered approved samples', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({ projectStore: projects })
    const samples = []
    for (let index = 0; index < 4; index += 1) {
      const path = join(root, `sample-${index + 1}.png`)
      writeFileSync(
        path,
        Buffer.concat([
          Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
          Buffer.from(`sample-${index + 1}`)
        ])
      )
      const imported = await production.importMedia({
        projectId: project.manifest.id,
        kind: 'reference-image',
        label: `Reviewed adaptation sample ${index + 1}`,
        sourcePath: path,
        origin: 'imported',
        parentAssetIds: []
      })
      if (!imported.ok) throw new Error(imported.error.message)
      const approved = production.reviewMedia({
        projectId: project.manifest.id,
        assetId: imported.asset.assetId,
        expectedSha256: imported.asset.sha256,
        decision: 'approved',
        reason: 'Rights, identity, provenance, and training consent were reviewed for this sample.',
        confirmation: true
      })
      if (!approved.ok) throw new Error(approved.error.message)
      samples.push(approved.asset)
    }

    const result = production.createAdaptationDataset({
      projectId: project.manifest.id,
      label: 'Ayo project-only identity dataset',
      purpose: 'Improve Ayo identity consistency only inside this production.',
      projectScopeOnly: true,
      humanRightsReviewConfirmed: true,
      trainingSteps: 400,
      learningRate: 0.0001,
      resolutionBuckets: ['576x576x1', '768x448x49'],
      samples: samples.map((asset, index) => ({
        assetId: asset.assetId,
        caption: `Approved Ayo identity reference number ${index + 1} with reviewed clothing and face anchors.`,
        rightsBasis: 'owned-original' as const,
        licenseReference: null,
        consentConfirmed: true as const
      }))
    })
    if (!result.ok) throw new Error(result.error.message)
    expect(result.asset).toMatchObject({
      kind: 'adaptation-dataset',
      state: 'candidate',
      mimeType: 'application/json',
      parentAssetIds: samples.map((asset) => asset.assetId)
    })
    const path = production.resolveMediaPath(project.manifest.id, result.asset.assetId).path
    const bytes = readFileSync(path)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(result.asset.sha256)
    const manifest = JSON.parse(bytes.toString('utf8')) as {
      projectScopeOnly: boolean
      humanRightsReviewConfirmed: boolean
      samples: Array<{ inputOrder: number; assetId: string; sha256: string }>
    }
    expect(manifest.projectScopeOnly).toBe(true)
    expect(manifest.humanRightsReviewConfirmed).toBe(true)
    expect(manifest.samples).toEqual(
      samples.map((asset, index) =>
        expect.objectContaining({
          inputOrder: index + 2,
          assetId: asset.assetId,
          sha256: asset.sha256
        })
      )
    )
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

  it('keeps held takes reviewable and creates retakes as parameter-modified child jobs', () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({
      projectStore: projects,
      now: () => new Date('2026-08-22T11:00:00.000Z'),
      maxSessionCostUsd: () => 1
    })
    const parentParameters = {
      prompt: 'Ayo turns toward the lantern as warm light crosses the painted room.',
      seed: 21
    }
    const planned = production.planJob({
      projectId: project.manifest.id,
      kind: 'qwen-image',
      label: 'Ayo lantern reaction',
      workflowId: 'qwen-image-character-board',
      workflowVersion: '1.0.0',
      inputAssetIds: [],
      canonIds: [],
      parameters: parentParameters,
      idempotencyKey: 'e'.repeat(64),
      estimate: estimate()
    })
    if (!planned.ok) throw new Error(planned.error.message)
    const approved = production.approveJob({
      projectId: project.manifest.id,
      jobId: planned.details.job.jobId,
      expectedEstimateId: planned.details.job.estimate.estimateId,
      acceptedMaximumUsd: 0.5,
      confirmation: true
    })
    if (!approved.ok) throw new Error(approved.error.message)
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'queued',
      'Queued by the test fixture.'
    )
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'provisioning',
      'Provisioning in the test fixture.'
    )
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'running',
      'Running in the test fixture.'
    )
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'downloading',
      'Downloading in the test fixture.'
    )
    const bytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
    const stagingPath = production.prepareArtifactDownload(
      project.manifest.id,
      approved.details.job.jobId,
      'take.png'
    )
    writeFileSync(stagingPath, bytes)
    const take = production.registerGeneratedMedia({
      projectId: project.manifest.id,
      jobId: approved.details.job.jobId,
      label: 'Ayo lantern reaction · take one',
      kind: 'character-board',
      stagingPath,
      fileName: 'take.png',
      mimeType: 'image/png',
      byteSize: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      parentAssetIds: []
    })
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'verifying',
      'Verified in the test fixture.'
    )
    production.transitionJob(
      project.manifest.id,
      approved.details.job.jobId,
      'awaiting-review',
      'Waiting for a human decision.'
    )

    expect(
      production.reviewMedia({
        projectId: project.manifest.id,
        assetId: take.assetId,
        expectedSha256: take.sha256,
        decision: 'held',
        reason: 'Pause this take while the lighting reference is checked.',
        confirmation: true
      })
    ).toMatchObject({ ok: true, asset: { state: 'held' } })
    expect(
      production.reviewMedia({
        projectId: project.manifest.id,
        assetId: take.assetId,
        expectedSha256: take.sha256,
        decision: 'changes-requested',
        reason: 'Keep the pose but reduce the warm spill on the background.',
        confirmation: true
      })
    ).toMatchObject({ ok: true, asset: { state: 'rejected' } })

    expect(
      production.planJob({
        projectId: project.manifest.id,
        kind: 'qwen-image',
        label: 'Ayo lantern reaction retake',
        workflowId: 'qwen-image-character-board',
        workflowVersion: '1.0.0',
        inputAssetIds: [],
        canonIds: [],
        parentJobId: approved.details.job.jobId,
        retakeOfAssetId: take.assetId,
        parameters: parentParameters,
        idempotencyKey: 'f'.repeat(64),
        estimate: estimate()
      })
    ).toMatchObject({ ok: false, error: { code: 'invalid-input' } })

    const retake = production.planJob({
      projectId: project.manifest.id,
      kind: 'qwen-image',
      label: 'Ayo lantern reaction retake',
      workflowId: 'qwen-image-character-board',
      workflowVersion: '1.0.0',
      inputAssetIds: [],
      canonIds: [],
      parentJobId: approved.details.job.jobId,
      retakeOfAssetId: take.assetId,
      parameters: { ...parentParameters, seed: 22 },
      idempotencyKey: '1'.repeat(64),
      estimate: estimate()
    })
    expect(retake).toMatchObject({
      ok: true,
      details: {
        job: {
          parentJobId: approved.details.job.jobId,
          retakeOfAssetId: take.assetId,
          state: 'estimated'
        }
      }
    })
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

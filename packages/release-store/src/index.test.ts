import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectStore } from '@studio/project-store'
import { ProductionStore } from '@studio/production-store'
import { ReleaseStore } from './index'

const roots: string[] = []
const now = new Date('2026-08-22T12:00:00.000Z')

function makeRoot(): string {
  const value = mkdtempSync(join(tmpdir(), 'studio-release-'))
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

afterEach(() => {
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('timeline and manual release package', () => {
  it('requires approved media, locks human decisions, and copies a verified self-contained package', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({ projectStore: projects, now: () => now })
    const release = new ReleaseStore({
      projectStore: projects,
      productionStore: production,
      now: () => now
    })
    const fixtures = [
      {
        name: 'master.mp4',
        kind: 'master-video' as const,
        bytes: Buffer.from('000000186674797069736f6d', 'hex')
      },
      {
        name: 'thumbnail.png',
        kind: 'thumbnail' as const,
        bytes: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
      },
      {
        name: 'captions.srt',
        kind: 'caption' as const,
        bytes: Buffer.from('1\n00:00:00,000 --> 00:00:02,000\nThe lantern wakes.\n')
      }
    ]
    const assets = []
    for (const fixture of fixtures) {
      const source = join(root, fixture.name)
      writeFileSync(source, fixture.bytes)
      const imported = await production.importMedia({
        projectId: project.manifest.id,
        kind: fixture.kind,
        label: fixture.name,
        sourcePath: source,
        origin: 'imported',
        parentAssetIds: []
      })
      if (!imported.ok) throw new Error(imported.error.message)
      const reviewed = production.reviewMedia({
        projectId: project.manifest.id,
        assetId: imported.asset.assetId,
        expectedSha256: imported.asset.sha256,
        decision: 'approved',
        reason: 'Reviewed and selected for the final manual release package.',
        confirmation: true
      })
      if (!reviewed.ok) throw new Error(reviewed.error.message)
      assets.push(reviewed.asset)
    }
    const master = assets[0]!
    const thumbnail = assets[1]!
    const caption = assets[2]!
    const saved = release.saveTimeline({
      projectId: project.manifest.id,
      timelineId: null,
      expectedUpdatedAt: null,
      label: 'Pilot final timeline',
      clips: [
        {
          clipId: '01K37Q0Z000000000000000101',
          assetId: master.assetId,
          order: 0,
          durationMs: 120_000,
          trimInMs: 0,
          transition: 'cut'
        }
      ],
      audioCues: [],
      captions: [
        {
          cueId: '01K37Q0Z000000000000000102',
          startMs: 0,
          endMs: 2_000,
          text: 'The lantern wakes.'
        }
      ]
    })
    if (!saved.ok) throw new Error(saved.error.message)
    const timeline = saved.workspace.timelines[0]!
    const locked = release.lockTimeline({
      projectId: project.manifest.id,
      timelineId: timeline.timelineId,
      expectedUpdatedAt: timeline.updatedAt,
      confirmation: true
    })
    expect(locked).toMatchObject({ ok: true, workspace: { timelines: [{ state: 'locked' }] } })
    const detailsResult = release.saveReleaseDetails({
      projectId: project.manifest.id,
      releaseDetailsId: null,
      expectedUpdatedAt: null,
      title: 'The Lantern Keepers — The First Light',
      description: 'A young keeper follows a mysterious light across the floating city.',
      language: 'English',
      category: 'Film & Animation',
      playlist: 'The Lantern Keepers',
      tags: ['animation', 'fantasy'],
      hashtags: ['#Animation'],
      chapters: [{ startMs: 0, label: 'The first light' }],
      credits: 'Original animated production.',
      endScreenNotes: 'Link to the next episode when available.'
    })
    if (!detailsResult.ok) throw new Error(detailsResult.error.message)
    const details = detailsResult.workspace.releaseDetails[0]!
    const attestResult = release.saveAttestations({
      projectId: project.manifest.id,
      madeForKids: 'no',
      syntheticDisclosure: 'no',
      truthfulPackagingConfirmed: true,
      originalityReviewed: true,
      rightsAndCreditsReviewed: true,
      fullWatchCompleted: true,
      notes:
        'The complete master, thumbnail, credits, and audience setting were reviewed by the creator.'
    })
    if (!attestResult.ok) throw new Error(attestResult.error.message)
    const attestation = attestResult.workspace.attestations[0]!
    const packaged = release.createReleasePackage({
      projectId: project.manifest.id,
      timelineId: timeline.timelineId,
      releaseDetailsId: details.releaseDetailsId,
      attestationId: attestation.attestationId,
      masterAssetId: master.assetId,
      thumbnailAssetId: thumbnail.assetId,
      captionAssetIds: [caption.assetId],
      confirmation: true
    })
    if (!packaged.ok) throw new Error(packaged.error.message)
    expect(packaged.workspace.releasePackages[0]).toMatchObject({ state: 'locked' })
    expect(packaged.workspace.releasePackages[0]?.files.map((file) => file.role)).toEqual(
      expect.arrayContaining([
        'master',
        'thumbnail',
        'caption',
        'details',
        'attestations',
        'manifest'
      ])
    )
    expect(packaged.workspace.blockers).toEqual([])
    const releasePackage = packaged.workspace.releasePackages[0]!
    const resolved = release.resolveReleasePackagePath({
      projectId: project.manifest.id,
      releaseId: releasePackage.releaseId
    })
    expect(resolved).toMatchObject({ ok: true })
    if (!resolved.ok) throw new Error(resolved.error.message)
    writeFileSync(join(resolved.path, 'manifest.json'), '{"tampered":true}\n')
    expect(
      release.resolveReleasePackagePath({
        projectId: project.manifest.id,
        releaseId: releasePackage.releaseId
      })
    ).toMatchObject({
      ok: false,
      error: { code: 'integrity-failed' }
    })
    projects.close()
  })

  it('rejects overlapping captions before changing a timeline', () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({ projectStore: projects, now: () => now })
    const release = new ReleaseStore({
      projectStore: projects,
      productionStore: production,
      now: () => now
    })
    const result = release.saveTimeline({
      projectId: project.manifest.id,
      timelineId: null,
      expectedUpdatedAt: null,
      label: 'Invalid captions',
      clips: [],
      audioCues: [],
      captions: [
        { cueId: '01K37Q0Z000000000000000111', startMs: 0, endMs: 2_000, text: 'One' },
        { cueId: '01K37Q0Z000000000000000112', startMs: 1_500, endMs: 3_000, text: 'Two' }
      ]
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-input' } })
    projects.close()
  })

  it('keeps release profiles, ideas, performance evidence, and approved learnings project-scoped', () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject(projectInput())
    const production = new ProductionStore({ projectStore: projects, now: () => now })
    const release = new ReleaseStore({
      projectStore: projects,
      productionStore: production,
      now: () => now
    })

    const firstProfile = release.saveProjectReleaseProfile({
      projectId: project.manifest.id,
      profileId: null,
      expectedUpdatedAt: null,
      name: 'Lantern Keepers channel profile',
      audience: 'Families who enjoy adventurous fantasy stories.',
      language: 'English',
      region: 'Nigeria',
      timezone: 'Africa/Lagos',
      channelPromise: 'Warm community mysteries in a floating coastal kingdom.',
      packagingVoice: 'Warm, intriguing, specific, and never sensational.',
      visualDirection: 'Painted lantern light, one expressive face, and readable silhouettes.',
      defaultCta: 'Join the keepers for the next mystery.',
      defaultCredits: 'Original animated production.',
      blockedClaims: ['true story', 'guaranteed'],
      blockedTopics: ['unrelated celebrity news'],
      category: 'Film & Animation',
      playlistConvention: 'The Lantern Keepers · Season {season}'
    })
    if (!firstProfile.ok) throw new Error(firstProfile.error.message)
    const profile = firstProfile.workspace.releaseProfiles[0]!
    const revisedProfile = release.saveProjectReleaseProfile({
      projectId: project.manifest.id,
      profileId: profile.profileId,
      expectedUpdatedAt: profile.updatedAt,
      name: profile.name,
      audience: profile.audience,
      language: profile.language,
      region: profile.region,
      timezone: profile.timezone,
      channelPromise: `${profile.channelPromise} Every title names the real mystery.`,
      packagingVoice: profile.packagingVoice,
      visualDirection: profile.visualDirection,
      defaultCta: profile.defaultCta,
      defaultCredits: profile.defaultCredits,
      blockedClaims: profile.blockedClaims,
      blockedTopics: profile.blockedTopics,
      category: profile.category,
      playlistConvention: profile.playlistConvention
    })
    if (!revisedProfile.ok) throw new Error(revisedProfile.error.message)
    expect(revisedProfile.workspace.releaseProfiles.map((item) => item.revision)).toEqual([2, 1])

    const idea = release.saveIdea({
      projectId: project.manifest.id,
      ideaId: null,
      title: 'The lantern that remembered',
      premise: 'A damaged harbour lantern begins replaying a warning from the city founder.',
      sourceType: 'llm-proposal',
      sourceLabel: 'Reviewed local writing proposal',
      rationale: 'It explores memory and community while reusing approved locations.',
      continuityNotes: 'Confirm the founder chronology before outlining.',
      status: 'backlog'
    })
    expect(idea).toMatchObject({ ok: true, workspace: { ideas: [{ status: 'backlog' }] } })

    const snapshot = release.savePerformanceSnapshot({
      projectId: project.manifest.id,
      releaseId: null,
      youtubeVideoId: 'Lantern_001',
      source: 'manual-official',
      windowStart: '2026-08-01',
      windowEnd: '2026-08-07',
      collectedAt: now.toISOString(),
      metrics: {
        views: 1_200,
        impressions: 10_000,
        impressionsClickThroughRatePct: 6.5,
        averageViewDurationSeconds: 420,
        estimatedWatchTimeHours: 140,
        likes: 150,
        comments: 24,
        shares: null,
        subscribersGained: 18,
        retentionAt30SecondsPct: null
      },
      missingDataWarnings: [],
      evidenceNotes: 'Copied from the official YouTube Analytics advanced-mode report.'
    })
    if (!snapshot.ok) throw new Error(snapshot.error.message)
    const evidence = snapshot.workspace.performanceSnapshots[0]!
    expect(evidence.baselineEligible).toBe(true)
    expect(evidence.missingDataWarnings).toEqual(
      expect.arrayContaining(['shares was not supplied by the selected report.'])
    )

    const missingReport = release.savePerformanceSnapshot({
      projectId: project.manifest.id,
      releaseId: null,
      youtubeVideoId: 'Lantern_003',
      source: 'official-report',
      windowStart: '2026-08-01',
      windowEnd: '2026-08-07',
      collectedAt: now.toISOString(),
      metrics: evidence.metrics,
      missingDataWarnings: [],
      evidenceNotes: 'The creator selected official report evidence without importing its file.'
    })
    expect(missingReport).toMatchObject({ ok: false, error: { code: 'invalid-input' } })

    const importedReport = release.savePerformanceSnapshot({
      projectId: project.manifest.id,
      releaseId: null,
      youtubeVideoId: 'Lantern_003',
      source: 'official-report',
      windowStart: '2026-08-01',
      windowEnd: '2026-08-07',
      collectedAt: now.toISOString(),
      metrics: evidence.metrics,
      reportProvenance: {
        fileName: 'YouTube Analytics.csv',
        fileSha256: 'a'.repeat(64),
        importedAt: now.toISOString(),
        rowNumber: 2
      },
      missingDataWarnings: [],
      evidenceNotes: 'The creator reviewed row two from the checked official report file.'
    })
    if (!importedReport.ok) throw new Error(importedReport.error.message)
    const importedEvidence = importedReport.workspace.performanceSnapshots.find(
      (item) => item.youtubeVideoId === 'Lantern_003'
    )
    expect(importedEvidence).toMatchObject({
      youtubeVideoId: 'Lantern_003',
      reportProvenance: { fileName: 'YouTube Analytics.csv', rowNumber: 2 }
    })

    const lowSample = release.savePerformanceSnapshot({
      projectId: project.manifest.id,
      releaseId: null,
      youtubeVideoId: 'Lantern_002',
      source: 'rehearsal',
      windowStart: '2026-08-08',
      windowEnd: '2026-08-08',
      collectedAt: now.toISOString(),
      metrics: {
        views: 12,
        impressions: null,
        impressionsClickThroughRatePct: null,
        averageViewDurationSeconds: null,
        estimatedWatchTimeHours: null,
        likes: null,
        comments: null,
        shares: null,
        subscribersGained: null,
        retentionAt30SecondsPct: null
      },
      missingDataWarnings: [],
      evidenceNotes: 'A rehearsal record used only to prove that simulated evidence stays excluded.'
    })
    if (!lowSample.ok) throw new Error(lowSample.error.message)
    const ineligible = lowSample.workspace.performanceSnapshots.find(
      (item) => item.youtubeVideoId === 'Lantern_002'
    )!
    expect(ineligible.baselineEligible).toBe(false)
    expect(ineligible.missingDataWarnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('fewer than 100 views'),
        expect.stringContaining('Rehearsal evidence')
      ])
    )
    expect(
      release.saveLearning({
        projectId: project.manifest.id,
        snapshotIds: [ineligible.snapshotId],
        observation: 'This rehearsal produced too little evidence for a reliable comparison.',
        inference: 'No performance conclusion should be drawn from the rehearsal record.',
        recommendation: 'Wait for baseline-eligible official evidence before proposing a change.',
        confidence: 'low',
        scope: 'next-release'
      })
    ).toMatchObject({ ok: false, error: { code: 'approval-required' } })

    const learning = release.saveLearning({
      projectId: project.manifest.id,
      snapshotIds: [evidence.snapshotId],
      observation: 'Average view duration was seven minutes during this stated window.',
      inference: 'The opening may hold attention, but no retention curve was supplied.',
      recommendation: 'Test one clearer opening question in the next release only.',
      confidence: 'low',
      scope: 'next-release'
    })
    if (!learning.ok) throw new Error(learning.error.message)
    const proposed = learning.workspace.learnings[0]!
    expect(proposed.status).toBe('proposed')
    const reviewed = release.reviewLearning({
      projectId: project.manifest.id,
      learningId: proposed.learningId,
      decision: 'approved',
      reason: 'The limited next-release scope matches the evidence and preserves human review.',
      confirmation: true
    })
    expect(reviewed).toMatchObject({ ok: true, workspace: { learnings: [{ status: 'approved' }] } })
    const secondProject = projects.createProject({
      ...projectInput(),
      code: 'TIDEWAYS',
      title: 'Tideways',
      type: 'film'
    })
    expect(release.getWorkspace(secondProject.manifest.id)).toMatchObject({
      releaseProfiles: [],
      ideas: [],
      performanceSnapshots: [],
      learnings: []
    })
    projects.close()
  })
})

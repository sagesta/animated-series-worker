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
})

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectStore } from '@studio/project-store'
import { ProductionStore } from '@studio/production-store'
import { ReleaseStore } from '@studio/release-store'
import { LocalProductionService } from './index'

const roots: string[] = []
const now = new Date('2026-08-22T12:00:00.000Z')

function makeRoot(): string {
  const value = mkdtempSync(join(tmpdir(), 'studio-local-production-'))
  roots.push(value)
  return value
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('local finishing service', () => {
  it('exports editable captions from a locked timeline without any GPU or FFmpeg runtime', async () => {
    const root = makeRoot()
    const projects = new ProjectStore({ workspaceRoot: join(root, 'projects') })
    const project = projects.createProject({
      title: 'The Lantern Keepers',
      type: 'series',
      language: 'English',
      targetDurationMinutes: 25,
      visualDirection: '2d',
      sourceMode: 'original',
      pilotBrief: 'Two young keepers protect a floating city.',
      creativeDirection: {
        targetAudience: 'Families who enjoy adventurous fantasy stories.',
        ageBand: 'all-ages',
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
    })
    const production = new ProductionStore({ projectStore: projects, now: () => now })
    const release = new ReleaseStore({
      projectStore: projects,
      productionStore: production,
      now: () => now
    })
    const source = join(root, 'frame.png')
    writeFileSync(
      source,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wlq7p8AAAAASUVORK5CYII=',
        'base64'
      )
    )
    const imported = await production.importMedia({
      projectId: project.manifest.id,
      kind: 'storyboard-frame',
      label: 'Opening frame',
      sourcePath: source,
      origin: 'imported',
      parentAssetIds: []
    })
    if (!imported.ok) throw new Error(imported.error.message)
    const approved = production.reviewMedia({
      projectId: project.manifest.id,
      assetId: imported.asset.assetId,
      expectedSha256: imported.asset.sha256,
      decision: 'approved',
      reason: 'The opening frame was reviewed for the locked caption fixture.',
      confirmation: true
    })
    if (!approved.ok) throw new Error(approved.error.message)
    const saved = release.saveTimeline({
      projectId: project.manifest.id,
      timelineId: null,
      expectedUpdatedAt: null,
      label: 'Caption export timeline',
      clips: [
        {
          clipId: '01K37Q0Z000000000000000141',
          assetId: approved.asset.assetId,
          order: 0,
          durationMs: 5_000,
          trimInMs: 0,
          transition: 'cut'
        }
      ],
      audioCues: [],
      captions: [
        {
          cueId: '01K37Q0Z000000000000000142',
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
    if (!locked.ok) throw new Error(locked.error.message)
    const lockedTimeline = locked.workspace.timelines[0]!
    const service = new LocalProductionService({
      productionStore: production,
      releaseStore: release,
      bundledRuntimeRoot: join(root, 'missing-runtime'),
      now: () => now
    })

    const result = await service.exportCaptions({
      projectId: project.manifest.id,
      timelineId: lockedTimeline.timelineId,
      label: 'English captions',
      format: 'srt',
      confirmation: true
    })

    if (!result.ok) throw new Error(result.error.message)
    expect(result.asset).toMatchObject({ kind: 'caption', origin: 'assembled', state: 'candidate' })
    expect(
      readFileSync(
        production.resolveMediaPath(project.manifest.id, result.asset.assetId).path,
        'utf8'
      )
    ).toContain('00:00:00,000 --> 00:00:02,000')
    projects.close()
  })
})

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectStore } from '@studio/project-store'
import { UpstreamAdapter } from './index'

const roots: string[] = []

function root(): string {
  const path = mkdtempSync(join(tmpdir(), 'studio-upstream-adapter-'))
  roots.push(path)
  return path
}

function projectInput() {
  return {
    title: 'The Lantern Keepers',
    type: 'series' as const,
    language: 'English',
    targetDurationMinutes: 25,
    visualDirection: '2d' as const,
    sourceMode: 'upstream-import' as const,
    pilotBrief: 'Adapt a validated source package into one long-form pilot.',
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

function copyFixturePackage(destination: string): void {
  mkdirSync(destination, { recursive: true })
  const vendor = resolve(process.cwd(), 'vendor', 'shuohao-skills', 'skills')
  copyFileSync(
    join(vendor, 'novel-outline', 'examples', '渡口-outline.json'),
    join(destination, 'story-outline.json')
  )
  copyFileSync(
    join(vendor, 'novel-characters', 'examples', '渡口-cast.json'),
    join(destination, 'story-cast.json')
  )
  copyFileSync(
    join(vendor, 'novel-art', 'examples', '渡口-art.json'),
    join(destination, 'story-art.json')
  )
  copyFileSync(
    join(vendor, 'novel-script', 'examples', '渡口-script.json'),
    join(destination, 'story-script.json')
  )
  copyFileSync(
    join(vendor, 'novel-storyboard', 'examples', '渡口-storyboard.json'),
    join(destination, 'story-storyboard.json')
  )
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('pinned upstream adapter', () => {
  it('validates copied public outputs and previews a deterministic long-form neutral plan', async () => {
    const temporary = root()
    const source = join(temporary, 'source')
    const projects = new ProjectStore({ workspaceRoot: join(temporary, 'projects') })
    const project = projects.createProject(projectInput())
    const adapter = new UpstreamAdapter({
      projectStore: projects,
      upstreamRoot: resolve(process.cwd(), 'vendor', 'shuohao-skills'),
      runtimeManifestPath: resolve(process.cwd(), 'config', 'upstream.runtime.json'),
      timeoutMs: 20_000,
      now: () => new Date('2026-08-22T12:00:00.000Z')
    })
    copyFixturePackage(source)

    const result = await adapter.importFromFolder(project.manifest.id, source)
    if (!result.ok) throw new Error(JSON.stringify(result.error))
    expect(result.record.state).toBe('preview')
    expect(result.record.files).toHaveLength(5)
    expect(result.record.files.every((file) => file.validationState === 'passed')).toBe(true)
    expect(result.record.normalized).toMatchObject({
      projectId: project.manifest.id,
      targetDurationSeconds: 1500,
      frameRate: 24
    })
    expect(result.record.normalized?.acts).toHaveLength(3)
    const shots = result.record.normalized?.acts.flatMap((act) =>
      act.sequences.flatMap((sequence) => sequence.scenes.flatMap((scene) => scene.shots))
    )
    expect(shots?.length).toBeGreaterThan(10)
    expect(shots?.every((shot) => shot.sourceH3ExecutionBlocked)).toBe(true)

    const stale = adapter.acceptImport({
      projectId: project.manifest.id,
      importId: result.record.importId,
      expectedNormalizedSha256: '0'.repeat(64),
      confirmation: true
    })
    expect(stale).toMatchObject({ ok: false, error: { code: 'stale-data' } })

    const accepted = adapter.acceptImport({
      projectId: project.manifest.id,
      importId: result.record.importId,
      expectedNormalizedSha256: result.record.normalized!.normalizedSha256,
      confirmation: true
    })
    expect(accepted).toMatchObject({ ok: true, record: { state: 'accepted' } })
    expect(adapter.listImports(project.manifest.id)[0]?.state).toBe('accepted')
    projects.close()
  }, 30_000)

  it('refuses a runtime whose allowlisted validator hash does not match', () => {
    const temporary = root()
    const projects = new ProjectStore({ workspaceRoot: join(temporary, 'projects') })
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'config', 'upstream.runtime.json'), 'utf8')
    ) as { scripts: { outline: { sha256: string } } }
    manifest.scripts.outline.sha256 = '0'.repeat(64)
    const path = join(temporary, 'bad-runtime.json')
    writeFileSync(path, JSON.stringify(manifest), 'utf8')
    expect(
      () =>
        new UpstreamAdapter({
          projectStore: projects,
          upstreamRoot: resolve(process.cwd(), 'vendor', 'shuohao-skills'),
          runtimeManifestPath: path
        })
    ).toThrow(/integrity check/i)
    projects.close()
  })
})

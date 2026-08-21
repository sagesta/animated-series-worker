import { describe, expect, it } from 'vitest'
import { buildProjectManifest, createUlid, normalizeProjectCode } from './index'

const validInput = {
  title: 'The Lantern Keepers',
  type: 'series' as const,
  language: 'English',
  targetDurationMinutes: 25,
  visualDirection: '2d' as const,
  sourceMode: 'original' as const,
  pilotBrief: 'Two young keepers protect a floating city.'
}

describe('project identity', () => {
  it('creates sortable-looking, valid 26-character project identities', () => {
    const first = createUlid(1_780_000_000_000)
    const second = createUlid(1_780_000_000_001)

    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(second).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(first).not.toBe(second)
    expect(first.slice(0, 10) <= second.slice(0, 10)).toBe(true)
  })

  it('turns a title into a friendly filesystem code', () => {
    expect(normalizeProjectCode('  The Lantern: Keepers!  ')).toBe('THE-LANTERN-KEEPERS')
    expect(normalizeProjectCode('Épisode Première')).toBe('EPISODE-PREMIERE')
  })
})

describe('project manifest', () => {
  it('creates a series manifest with local-only safety defaults', () => {
    const manifest = buildProjectManifest(validInput, {
      now: new Date('2026-08-21T12:00:00.000Z')
    })

    expect(manifest.type).toBe('series')
    expect(manifest.code).toBe('THE-LANTERN-KEEPERS')
    expect(manifest.cloudGpuState).toBe('not-configured')
    expect(manifest.deliveryProfileId).toBe('youtube-1080p24-v1')
    expect(manifest.safeCheckpoint.createdAt).toBe('2026-08-21T12:00:00.000Z')
    expect(manifest.folderName).toMatch(/^the-lantern-keepers-[0-9a-hjkmnp-tv-z]{26}$/)
  })

  it('rejects incomplete or unreasonable production details', () => {
    expect(() =>
      buildProjectManifest({
        ...validInput,
        title: ' ',
        targetDurationMinutes: 0
      })
    ).toThrow()
  })
})

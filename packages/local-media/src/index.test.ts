import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { captionQc, compileTimelineRender, formatSrt, formatVtt } from './index'

const cueOne = {
  cueId: '01K37Q0Z000000000000000201',
  startMs: 0,
  endMs: 2_000,
  text: 'The lantern wakes.'
}

describe('deterministic local media planning', () => {
  it('exports editable SRT/VTT from approved cue timing', () => {
    expect(formatSrt([cueOne])).toContain('00:00:00,000 --> 00:00:02,000')
    expect(formatVtt([cueOne])).toContain('00:00:00.000 --> 00:00:02.000')
    expect(captionQc([cueOne])).toEqual([])
    expect(
      captionQc([
        cueOne,
        {
          cueId: '01K37Q0Z000000000000000202',
          startMs: 1_000,
          endMs: 1_200,
          text: 'This extremely long subtitle is impossible to read in two tenths of a second.'
        }
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'overlap' }),
        expect.objectContaining({ code: 'too-fast' }),
        expect.objectContaining({ code: 'too-short' })
      ])
    )
  })

  it('compiles a shell-free FFmpeg argument plan from one locked timeline', () => {
    const root = mkdtempSync(join(tmpdir(), 'studio-local-media-'))
    const ffmpeg = join(root, 'ffmpeg.exe')
    const frame = join(root, 'frame.png')
    writeFileSync(ffmpeg, 'fixture')
    writeFileSync(frame, 'fixture')
    const plan = compileTimelineRender({
      ffmpegPath: ffmpeg,
      outputPath: join(root, 'master.mp4'),
      timeline: {
        schemaVersion: 1,
        timelineId: '01K37Q0Z000000000000000203',
        projectId: '01K37Q0Z000000000000000204',
        revision: 1,
        state: 'locked',
        label: 'Pilot timeline',
        clips: [
          {
            clipId: '01K37Q0Z000000000000000205',
            assetId: '01K37Q0Z000000000000000206',
            order: 0,
            durationMs: 5_000,
            trimInMs: 0,
            transition: 'cut'
          }
        ],
        audioCues: [],
        captions: [cueOne],
        durationMs: 5_000,
        masterAssetId: null,
        createdAt: '2026-08-22T12:00:00.000Z',
        updatedAt: '2026-08-22T12:00:00.000Z',
        lockedAt: '2026-08-22T12:00:00.000Z'
      },
      assets: [
        {
          assetId: '01K37Q0Z000000000000000206',
          path: frame,
          mimeType: 'image/png'
        }
      ]
    })
    expect(plan.args).toEqual(
      expect.arrayContaining(['-nostdin', '-filter_complex', '-c:v', 'libx264'])
    )
    expect(plan.args.join(' ')).not.toContain('cmd.exe')
    expect(plan.manifestSha256).toMatch(/^[a-f0-9]{64}$/)
  })
})

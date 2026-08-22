import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { z } from 'zod'
import {
  CaptionCueSchema,
  ProductionTimelineSchema,
  type CaptionCue,
  type ProductionTimeline
} from '@studio/contracts'

const execFileAsync = promisify(execFile)

export interface ResolvedTimelineAsset {
  assetId: string
  path: string
  mimeType: string
}

export interface TimelineRenderPlan {
  executable: string
  args: string[]
  outputPath: string
  manifestSha256: string
  expectedDurationMs: number
}

function escapeDrawTextPath(value: string): string {
  return escapeFilterPath(value).replaceAll(',', '\\,').replaceAll(';', '\\;')
}

export interface CaptionQcWarning {
  cueId: string
  code: 'overlap' | 'too-fast' | 'too-short' | 'too-long'
  message: string
}

export class LocalMediaError extends Error {
  constructor(
    readonly code:
      | 'runtime-missing'
      | 'invalid-timeline'
      | 'missing-asset'
      | 'unsafe-output'
      | 'render-failed'
      | 'probe-failed',
    message: string
  ) {
    super(message)
    this.name = 'LocalMediaError'
  }
}

function timecode(milliseconds: number, decimal = ','): string {
  const total = Math.max(0, Math.floor(milliseconds))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)
  const fraction = total % 1_000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${decimal}${String(fraction).padStart(3, '0')}`
}

function escapeFilterPath(value: string): string {
  return value
    .replaceAll('\\', '/')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'")
    .replaceAll('[', '\\[')
    .replaceAll(']', '\\]')
}

export function captionQc(unknownCues: CaptionCue[]): CaptionQcWarning[] {
  const cues = unknownCues
    .map((cue) => CaptionCueSchema.parse(cue))
    .sort((left, right) => left.startMs - right.startMs)
  const warnings: CaptionQcWarning[] = []
  cues.forEach((cue, index) => {
    const durationSeconds = (cue.endMs - cue.startMs) / 1000
    const charactersPerSecond = cue.text.length / durationSeconds
    if (index > 0 && cue.startMs < cues[index - 1]!.endMs)
      warnings.push({
        cueId: cue.cueId,
        code: 'overlap',
        message: 'This caption overlaps the previous cue.'
      })
    if (charactersPerSecond > 20)
      warnings.push({
        cueId: cue.cueId,
        code: 'too-fast',
        message: 'This caption may be too fast to read.'
      })
    if (durationSeconds < 0.5)
      warnings.push({
        cueId: cue.cueId,
        code: 'too-short',
        message: 'This caption is visible for less than half a second.'
      })
    if (durationSeconds > 7)
      warnings.push({
        cueId: cue.cueId,
        code: 'too-long',
        message: 'This caption remains unchanged for more than seven seconds.'
      })
  })
  return warnings
}

export function formatSrt(unknownCues: CaptionCue[]): string {
  const cues = unknownCues
    .map((cue) => CaptionCueSchema.parse(cue))
    .sort((left, right) => left.startMs - right.startMs)
  return `${cues
    .map(
      (cue, index) =>
        `${index + 1}\n${timecode(cue.startMs)} --> ${timecode(cue.endMs)}\n${cue.text.replaceAll('\r', '')}`
    )
    .join('\n\n')}\n`
}

export function formatVtt(unknownCues: CaptionCue[]): string {
  const cues = unknownCues
    .map((cue) => CaptionCueSchema.parse(cue))
    .sort((left, right) => left.startMs - right.startMs)
  return `WEBVTT\n\n${cues
    .map(
      (cue) =>
        `${timecode(cue.startMs, '.')} --> ${timecode(cue.endMs, '.')}\n${cue.text.replaceAll('\r', '')}`
    )
    .join('\n\n')}\n`
}

export function compileTimelineRender(input: {
  ffmpegPath: string
  timeline: ProductionTimeline
  assets: ResolvedTimelineAsset[]
  outputPath: string
  captionPath?: string
  width?: number
  height?: number
  framesPerSecond?: number
}): TimelineRenderPlan {
  const timeline = ProductionTimelineSchema.parse(input.timeline)
  const width = z
    .number()
    .int()
    .min(640)
    .max(7680)
    .parse(input.width ?? 1920)
  const height = z
    .number()
    .int()
    .min(360)
    .max(4320)
    .parse(input.height ?? 1080)
  const fps = z
    .number()
    .int()
    .min(12)
    .max(60)
    .parse(input.framesPerSecond ?? 24)
  if (timeline.state !== 'locked' || timeline.clips.length === 0)
    throw new LocalMediaError(
      'invalid-timeline',
      'Only a locked timeline with approved clips can render.'
    )
  if (!existsSync(input.ffmpegPath))
    throw new LocalMediaError(
      'runtime-missing',
      'The verified local FFmpeg runtime is not installed.'
    )
  if (!input.outputPath.toLowerCase().endsWith('.mp4'))
    throw new LocalMediaError('unsafe-output', 'The master render must use a new MP4 destination.')
  const assets = new Map(input.assets.map((asset) => [asset.assetId, asset]))
  const args: string[] = ['-hide_banner', '-nostdin', '-y']
  for (const clip of timeline.clips) {
    const asset = assets.get(clip.assetId)
    if (!asset || !existsSync(asset.path))
      throw new LocalMediaError('missing-asset', 'A timeline clip is missing from local storage.')
    if (asset.mimeType.startsWith('image/'))
      args.push('-loop', '1', '-t', String(clip.durationMs / 1000), '-i', asset.path)
    else
      args.push(
        '-ss',
        String(clip.trimInMs / 1000),
        '-t',
        String(clip.durationMs / 1000),
        '-i',
        asset.path
      )
  }
  const audioOffset = timeline.clips.length
  for (const cue of timeline.audioCues) {
    const asset = assets.get(cue.assetId)
    if (!asset || !existsSync(asset.path))
      throw new LocalMediaError(
        'missing-asset',
        'A timeline sound cue is missing from local storage.'
      )
    args.push('-i', asset.path)
  }
  const filters: string[] = timeline.clips.map(
    (_clip, index) =>
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${index}]`
  )
  filters.push(
    `${timeline.clips.map((_clip, index) => `[v${index}]`).join('')}concat=n=${timeline.clips.length}:v=1:a=0[video]`
  )
  let videoOutput = 'video'
  if (input.captionPath) {
    filters.push(`[video]subtitles='${escapeFilterPath(input.captionPath)}'[captioned]`)
    videoOutput = 'captioned'
  }
  if (timeline.audioCues.length > 0) {
    timeline.audioCues.forEach((cue, index) => {
      const delay = cue.startMs
      filters.push(
        `[${audioOffset + index}:a]atrim=0:${cue.durationMs / 1000},adelay=${delay}|${delay},volume=${cue.gainDb}dB[a${index}]`
      )
    })
    filters.push(
      `${timeline.audioCues.map((_cue, index) => `[a${index}]`).join('')}amix=inputs=${timeline.audioCues.length}:duration=longest:normalize=0[audio]`
    )
  }
  args.push('-filter_complex', filters.join(';'), '-map', `[${videoOutput}]`)
  if (timeline.audioCues.length > 0) args.push('-map', '[audio]', '-c:a', 'aac', '-b:a', '320k')
  else args.push('-an')
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-metadata',
    `comment=Animated Series Studio timeline ${timeline.timelineId} revision ${timeline.revision}`,
    input.outputPath
  )
  const manifestSha256 = createHash('sha256')
    .update(
      JSON.stringify({
        timeline,
        assets: input.assets.map(({ assetId, mimeType }) => ({ assetId, mimeType })),
        width,
        height,
        fps
      })
    )
    .digest('hex')
  return {
    executable: input.ffmpegPath,
    args,
    outputPath: input.outputPath,
    manifestSha256,
    expectedDurationMs: timeline.durationMs
  }
}

export function compileThumbnailRender(input: {
  ffmpegPath: string
  sourcePath: string
  outputPath: string
  headlineFilePath: string
  fontPath: string
  textPosition: 'top' | 'bottom'
  accent: 'gold' | 'cyan' | 'coral' | 'white'
}): TimelineRenderPlan {
  for (const path of [input.ffmpegPath, input.sourcePath, input.headlineFilePath, input.fontPath]) {
    if (!existsSync(path)) {
      throw new LocalMediaError(
        'runtime-missing',
        'A required local thumbnail file is unavailable.'
      )
    }
  }
  if (!input.outputPath.toLowerCase().endsWith('.png')) {
    throw new LocalMediaError('unsafe-output', 'The thumbnail must use a new PNG destination.')
  }
  const accentColors = {
    gold: '#ffd166',
    cyan: '#5de4ff',
    coral: '#ff7b72',
    white: '#ffffff'
  } as const
  const top = input.textPosition === 'top'
  const boxY = top ? 0 : 'ih-620'
  const textY = top ? 100 : 'h-th-100'
  const filter = [
    'scale=3840:2160:force_original_aspect_ratio=increase',
    'crop=3840:2160',
    `drawbox=x=0:y=${boxY}:w=iw:h=620:color=black@0.62:t=fill`,
    `drawtext=fontfile='${escapeDrawTextPath(input.fontPath)}':textfile='${escapeDrawTextPath(input.headlineFilePath)}':fontcolor=${accentColors[input.accent]}:fontsize=210:line_spacing=24:x=(w-text_w)/2:y=${textY}:borderw=8:bordercolor=black@0.85`
  ].join(',')
  const args = [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-i',
    input.sourcePath,
    '-vf',
    filter,
    '-frames:v',
    '1',
    '-an',
    input.outputPath
  ]
  return {
    executable: input.ffmpegPath,
    args,
    outputPath: input.outputPath,
    manifestSha256: createHash('sha256')
      .update(
        JSON.stringify({
          sourcePath: input.sourcePath,
          headlineFilePath: input.headlineFilePath,
          fontPath: input.fontPath,
          textPosition: input.textPosition,
          accent: input.accent
        })
      )
      .digest('hex'),
    expectedDurationMs: 0
  }
}

export async function executeRender(plan: TimelineRenderPlan, timeoutMs: number): Promise<void> {
  const safeTimeout = z
    .number()
    .int()
    .min(60_000)
    .max(24 * 60 * 60_000)
    .parse(timeoutMs)
  try {
    await execFileAsync(plan.executable, plan.args, {
      windowsHide: true,
      shell: false,
      timeout: safeTimeout,
      maxBuffer: 4 * 1024 * 1024
    })
  } catch {
    throw new LocalMediaError(
      'render-failed',
      'The local master render failed. The prior master and timeline were not replaced.'
    )
  }
}

export async function probeMedia(
  ffprobePath: string,
  mediaPath: string
): Promise<{
  durationMs: number
  width: number | null
  height: number | null
  hasAudio: boolean
}> {
  if (!existsSync(ffprobePath) || !existsSync(mediaPath))
    throw new LocalMediaError('runtime-missing', 'The local media verifier is unavailable.')
  try {
    const result = await execFileAsync(
      ffprobePath,
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', mediaPath],
      { windowsHide: true, shell: false, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }
    )
    const payload = JSON.parse(result.stdout)
    const video = payload.streams?.find(
      (stream: { codec_type?: string }) => stream.codec_type === 'video'
    )
    return {
      durationMs: Math.round(Number(payload.format?.duration ?? 0) * 1000),
      width: Number.isInteger(video?.width) ? video.width : null,
      height: Number.isInteger(video?.height) ? video.height : null,
      hasAudio:
        payload.streams?.some((stream: { codec_type?: string }) => stream.codec_type === 'audio') ??
        false
    }
  } catch {
    throw new LocalMediaError('probe-failed', 'The rendered media could not be verified.')
  }
}

import { createHash } from 'node:crypto'
import { execFile, execFileSync } from 'node:child_process'
import { createReadStream, existsSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  ExportCaptionsInputSchema,
  InstallLocalMediaToolsInputSchema,
  LocalMediaActionResultSchema,
  LocalMediaInstallResultSchema,
  LocalMediaRuntimeStatusSchema,
  RenderThumbnailInputSchema,
  RenderTimelineInputSchema,
  type ExportCaptionsInput,
  type LocalMediaActionResult,
  type LocalMediaInstallResult,
  type LocalMediaRuntimeStatus,
  type RenderThumbnailInput,
  type RenderTimelineInput
} from '@studio/contracts'
import { createUlid } from '@studio/domain'
import {
  LocalMediaError,
  captionQc,
  compileThumbnailRender,
  compileTimelineRender,
  executeRender,
  formatSrt,
  formatVtt,
  probeMedia
} from '@studio/local-media'
import { ProductionStore, ProductionStoreError } from '@studio/production-store'
import { ReleaseStore, ReleaseStoreError } from '@studio/release-store'

interface RuntimePaths {
  source: 'bundled' | 'system'
  ffmpeg: string
  ffprobe: string
  font: string
}

const execFileAsync = promisify(execFile)

export interface LocalProductionServiceOptions {
  productionStore: ProductionStore
  releaseStore: ReleaseStore
  bundledRuntimeRoot?: string
  windowsFontRoot?: string
  now?: () => Date
}

function firstExecutable(command: string): string | null {
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which'
    const output = execFileSync(locator, [command], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 10_000
    })
    return (
      output
        .split(/\r?\n/)
        .map((value) => value.trim())
        .find((value) => value && existsSync(value)) ?? null
    )
  } catch {
    return null
  }
}

function mediaRuntimeHasRequiredFeatures(ffmpeg: string, ffprobe: string): boolean {
  try {
    const version = execFileSync(ffmpeg, ['-hide_banner', '-version'], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 15_000
    })
    const filters = execFileSync(ffmpeg, ['-hide_banner', '-filters'], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024
    })
    const encoders = execFileSync(ffmpeg, ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024
    })
    const probeVersion = execFileSync(ffprobe, ['-hide_banner', '-version'], {
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
      timeout: 15_000
    })
    return (
      version.startsWith('ffmpeg version') &&
      probeVersion.startsWith('ffprobe version') &&
      filters.includes(' drawtext ') &&
      filters.includes(' subtitles ') &&
      encoders.includes('libx264') &&
      encoders.includes(' aac ')
    )
  } catch {
    return false
  }
}

async function shaFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function actionError(error: unknown): Extract<LocalMediaActionResult, { ok: false }> {
  if (error instanceof LocalMediaError) {
    const code =
      error.code === 'runtime-missing'
        ? 'runtime-missing'
        : error.code === 'render-failed' || error.code === 'probe-failed'
          ? 'render-failed'
          : error.code === 'unsafe-output'
            ? 'unsafe-path'
            : 'invalid-input'
    return LocalMediaActionResultSchema.parse({
      ok: false,
      error: { code, message: error.message }
    }) as Extract<LocalMediaActionResult, { ok: false }>
  }
  if (error instanceof ProductionStoreError || error instanceof ReleaseStoreError) {
    const allowed = new Set([
      'invalid-input',
      'not-found',
      'stale-data',
      'approval-required',
      'integrity-failed',
      'unsafe-path'
    ])
    return LocalMediaActionResultSchema.parse({
      ok: false,
      error: { code: allowed.has(error.code) ? error.code : 'unknown', message: error.message }
    }) as Extract<LocalMediaActionResult, { ok: false }>
  }
  return LocalMediaActionResultSchema.parse({
    ok: false,
    error: {
      code: 'unknown',
      message: 'The local media task stopped safely. Existing media was not replaced.'
    }
  }) as Extract<LocalMediaActionResult, { ok: false }>
}

export class LocalProductionService {
  private readonly productionStore: ProductionStore
  private readonly releaseStore: ReleaseStore
  private readonly bundledRuntimeRoot: string | null
  private readonly windowsFontRoot: string
  private readonly now: () => Date
  private resolvedRuntime: RuntimePaths | null | undefined

  constructor(options: LocalProductionServiceOptions) {
    this.productionStore = options.productionStore
    this.releaseStore = options.releaseStore
    this.bundledRuntimeRoot = options.bundledRuntimeRoot
      ? resolve(options.bundledRuntimeRoot)
      : null
    this.windowsFontRoot = resolve(options.windowsFontRoot ?? 'C:\\Windows\\Fonts')
    this.now = options.now ?? (() => new Date())
  }

  getStatus(): LocalMediaRuntimeStatus {
    const runtime = this.resolveRuntime()
    return LocalMediaRuntimeStatusSchema.parse(
      runtime
        ? {
            state: 'ready',
            source: runtime.source,
            ffmpegAvailable: true,
            ffprobeAvailable: true,
            message:
              runtime.source === 'bundled'
                ? 'The verified media tools bundled with this app are ready.'
                : 'The free FFmpeg media tools installed on this computer are ready.'
          }
        : {
            state: 'missing',
            source: 'none',
            ffmpegAvailable: false,
            ffprobeAvailable: false,
            message:
              'Install the free local media tools once before rendering masters, captions, or thumbnails.'
          }
    )
  }

  async installRuntime(unknownInput: unknown): Promise<LocalMediaInstallResult> {
    InstallLocalMediaToolsInputSchema.parse(unknownInput)
    if (process.platform !== 'win32') {
      return LocalMediaInstallResultSchema.parse({
        ok: false,
        error: {
          code: 'unsupported',
          message: 'One-button media-tool setup is currently available only in the Windows app.'
        }
      })
    }
    const winget = firstExecutable('winget')
    if (!winget) {
      return LocalMediaInstallResultSchema.parse({
        ok: false,
        error: {
          code: 'installer-missing',
          message: 'Windows App Installer is required for the one-time free media-tool setup.'
        }
      })
    }
    try {
      await execFileAsync(
        winget,
        [
          'install',
          '--id',
          'Gyan.FFmpeg.Essentials',
          '--exact',
          '--source',
          'winget',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity'
        ],
        {
          windowsHide: true,
          shell: false,
          timeout: 20 * 60_000,
          maxBuffer: 8 * 1024 * 1024
        }
      )
    } catch {
      return LocalMediaInstallResultSchema.parse({
        ok: false,
        error: {
          code: 'install-failed',
          message: 'Windows could not finish the free media-tool installation. No GPU was started.'
        }
      })
    }
    this.resolvedRuntime = undefined
    const status = this.getStatus()
    return status.state === 'ready'
      ? LocalMediaInstallResultSchema.parse({ ok: true, status })
      : LocalMediaInstallResultSchema.parse({
          ok: false,
          error: {
            code: 'verification-failed',
            message:
              'The tools installed, but the app could not verify all required render features. Reopen the app and check again.'
          }
        })
  }

  async renderTimeline(unknownInput: RenderTimelineInput): Promise<LocalMediaActionResult> {
    let stagingDirectory: string | null = null
    try {
      const input = RenderTimelineInputSchema.parse(unknownInput)
      const runtime = this.requireRuntime()
      const timeline = this.releaseStore.getTimeline(input.projectId, input.timelineId)
      if (timeline.state !== 'locked') {
        throw new ReleaseStoreError(
          'approval-required',
          'Lock the exact timeline before rendering.'
        )
      }
      if (timeline.updatedAt !== input.expectedUpdatedAt) {
        throw new ReleaseStoreError(
          'stale-data',
          'The timeline changed. Review it before rendering.'
        )
      }
      const parentAssetIds = [
        ...new Set([
          ...timeline.clips.map((clip) => clip.assetId),
          ...timeline.audioCues.map((cue) => cue.assetId)
        ])
      ]
      const workspace = this.productionStore.getWorkspace(input.projectId)
      const assets = parentAssetIds.map((assetId) => {
        const asset = workspace.media.find((candidate) => candidate.assetId === assetId)
        if (!asset || asset.state !== 'approved') {
          throw new ProductionStoreError(
            'approval-required',
            'Every timeline input must still be approved before rendering.'
          )
        }
        const resolvedAsset = this.productionStore.resolveMediaPath(input.projectId, asset.assetId)
        return { assetId: asset.assetId, path: resolvedAsset.path, mimeType: asset.mimeType }
      })
      const assemblyId = createUlid(this.now().getTime())
      const outputPath = this.productionStore.prepareAssemblyOutput(
        input.projectId,
        assemblyId,
        'master.mp4'
      )
      stagingDirectory = dirname(outputPath)
      let captionPath: string | undefined
      const warnings = captionQc(timeline.captions).map((warning) => warning.message)
      if (input.burnCaptions && timeline.captions.length > 0) {
        captionPath = this.productionStore.prepareAssemblyOutput(
          input.projectId,
          assemblyId,
          'burn-in-captions.srt'
        )
        writeFileSync(captionPath, formatSrt(timeline.captions), { encoding: 'utf8', flag: 'wx' })
      }
      const plan = compileTimelineRender({
        ffmpegPath: runtime.ffmpeg,
        timeline,
        assets,
        outputPath,
        captionPath,
        width: input.width,
        height: input.height,
        framesPerSecond: input.framesPerSecond
      })
      const timeoutMs = Math.min(24 * 60 * 60_000, Math.max(5 * 60_000, timeline.durationMs * 3))
      await executeRender(plan, timeoutMs)
      const probe = await probeMedia(runtime.ffprobe, outputPath)
      const durationTolerance = Math.max(2_000, Math.round(timeline.durationMs * 0.02))
      if (
        Math.abs(probe.durationMs - timeline.durationMs) > durationTolerance ||
        probe.width !== input.width ||
        probe.height !== input.height ||
        (timeline.audioCues.length > 0 && !probe.hasAudio)
      ) {
        throw new LocalMediaError(
          'probe-failed',
          'The rendered master did not match the locked duration, picture size, or sound plan.'
        )
      }
      const stat = statSync(outputPath)
      const asset = this.productionStore.registerAssembledMedia({
        projectId: input.projectId,
        assemblyId,
        label: input.label,
        kind: 'master-video',
        stagingPath: outputPath,
        fileName: 'master.mp4',
        mimeType: 'video/mp4',
        byteSize: stat.size,
        sha256: await shaFile(outputPath),
        parentAssetIds,
        width: probe.width,
        height: probe.height,
        durationMs: probe.durationMs
      })
      const finishWorkspace = this.releaseStore.attachMasterAsset(
        input.projectId,
        input.timelineId,
        input.expectedUpdatedAt,
        asset.assetId
      )
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      stagingDirectory = null
      return LocalMediaActionResultSchema.parse({
        ok: true,
        asset,
        workspace: finishWorkspace,
        warnings: [
          ...new Set([
            ...warnings,
            'The master is a candidate until a person watches it from start to finish and approves it.'
          ])
        ]
      })
    } catch (error) {
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      return actionError(error)
    }
  }

  async exportCaptions(unknownInput: ExportCaptionsInput): Promise<LocalMediaActionResult> {
    let stagingDirectory: string | null = null
    try {
      const input = ExportCaptionsInputSchema.parse(unknownInput)
      const timeline = this.releaseStore.getTimeline(input.projectId, input.timelineId)
      if (timeline.state !== 'locked') {
        throw new ReleaseStoreError(
          'approval-required',
          'Lock the timeline before exporting captions.'
        )
      }
      if (timeline.captions.length === 0) {
        throw new ReleaseStoreError('approval-required', 'Add at least one caption before export.')
      }
      const assemblyId = createUlid(this.now().getTime())
      const fileName = `captions.${input.format}`
      const outputPath = this.productionStore.prepareAssemblyOutput(
        input.projectId,
        assemblyId,
        fileName
      )
      stagingDirectory = dirname(outputPath)
      writeFileSync(
        outputPath,
        input.format === 'srt' ? formatSrt(timeline.captions) : formatVtt(timeline.captions),
        { encoding: 'utf8', flag: 'wx' }
      )
      const stat = statSync(outputPath)
      const asset = this.productionStore.registerAssembledMedia({
        projectId: input.projectId,
        assemblyId,
        label: input.label,
        kind: 'caption',
        stagingPath: outputPath,
        fileName,
        mimeType: input.format === 'srt' ? 'application/x-subrip' : 'text/vtt',
        byteSize: stat.size,
        sha256: await shaFile(outputPath),
        parentAssetIds: [],
        width: null,
        height: null,
        durationMs: null
      })
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      stagingDirectory = null
      return LocalMediaActionResultSchema.parse({
        ok: true,
        asset,
        workspace: this.releaseStore.getWorkspace(input.projectId),
        warnings: captionQc(timeline.captions).map((warning) => warning.message)
      })
    } catch (error) {
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      return actionError(error)
    }
  }

  async renderThumbnail(unknownInput: RenderThumbnailInput): Promise<LocalMediaActionResult> {
    let stagingDirectory: string | null = null
    try {
      const input = RenderThumbnailInputSchema.parse(unknownInput)
      const runtime = this.requireRuntime()
      const source = this.productionStore
        .getWorkspace(input.projectId)
        .media.find((asset) => asset.assetId === input.sourceAssetId)
      if (
        !source ||
        source.state !== 'approved' ||
        (!source.mimeType.startsWith('image/') && !source.mimeType.startsWith('video/'))
      ) {
        throw new ProductionStoreError(
          'approval-required',
          'Choose an approved image or video frame from this production.'
        )
      }
      const sourcePath = this.productionStore.resolveMediaPath(
        input.projectId,
        input.sourceAssetId
      ).path
      const assemblyId = createUlid(this.now().getTime())
      const outputPath = this.productionStore.prepareAssemblyOutput(
        input.projectId,
        assemblyId,
        'thumbnail.png'
      )
      stagingDirectory = dirname(outputPath)
      const headlinePath = this.productionStore.prepareAssemblyOutput(
        input.projectId,
        assemblyId,
        'headline.txt'
      )
      writeFileSync(headlinePath, `${input.headline}\n`, { encoding: 'utf8', flag: 'wx' })
      await executeRender(
        compileThumbnailRender({
          ffmpegPath: runtime.ffmpeg,
          sourcePath,
          outputPath,
          headlineFilePath: headlinePath,
          fontPath: runtime.font,
          textPosition: input.textPosition,
          accent: input.accent
        }),
        5 * 60_000
      )
      const probe = await probeMedia(runtime.ffprobe, outputPath)
      if (probe.width !== 3840 || probe.height !== 2160) {
        throw new LocalMediaError(
          'probe-failed',
          'The thumbnail did not match the required 16:9 production size.'
        )
      }
      const stat = statSync(outputPath)
      const asset = this.productionStore.registerAssembledMedia({
        projectId: input.projectId,
        assemblyId,
        label: input.label,
        kind: 'thumbnail',
        stagingPath: outputPath,
        fileName: 'thumbnail.png',
        mimeType: 'image/png',
        byteSize: stat.size,
        sha256: await shaFile(outputPath),
        parentAssetIds: [source.assetId],
        width: probe.width,
        height: probe.height,
        durationMs: null
      })
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      stagingDirectory = null
      return LocalMediaActionResultSchema.parse({
        ok: true,
        asset,
        workspace: this.releaseStore.getWorkspace(input.projectId),
        warnings: [
          'Open the full-size thumbnail and confirm the subject, words, contrast, cropping, and truthfulness before approval.'
        ]
      })
    } catch (error) {
      if (stagingDirectory && existsSync(stagingDirectory)) {
        rmSync(stagingDirectory, { recursive: true, force: true })
      }
      return actionError(error)
    }
  }

  private resolveRuntime(): RuntimePaths | null {
    if (this.resolvedRuntime !== undefined) return this.resolvedRuntime
    const bundledExtension = process.platform === 'win32' ? '.exe' : ''
    const bundledFfmpeg = this.bundledRuntimeRoot
      ? join(this.bundledRuntimeRoot, `ffmpeg${bundledExtension}`)
      : null
    const bundledFfprobe = this.bundledRuntimeRoot
      ? join(this.bundledRuntimeRoot, `ffprobe${bundledExtension}`)
      : null
    const font = [
      join(this.windowsFontRoot, 'arialbd.ttf'),
      join(this.windowsFontRoot, 'segoeuib.ttf'),
      join(this.windowsFontRoot, 'arial.ttf')
    ].find((candidate) => existsSync(candidate))
    if (!font) {
      this.resolvedRuntime = null
      return null
    }
    if (
      bundledFfmpeg &&
      bundledFfprobe &&
      existsSync(bundledFfmpeg) &&
      existsSync(bundledFfprobe) &&
      mediaRuntimeHasRequiredFeatures(bundledFfmpeg, bundledFfprobe)
    ) {
      this.resolvedRuntime = {
        source: 'bundled',
        ffmpeg: bundledFfmpeg,
        ffprobe: bundledFfprobe,
        font
      }
      return this.resolvedRuntime
    }
    const ffmpeg = firstExecutable('ffmpeg')
    const ffprobe = firstExecutable('ffprobe')
    const wingetLinkRoot = process.env.LOCALAPPDATA
      ? resolve(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links')
      : null
    const linkedFfmpeg = wingetLinkRoot ? join(wingetLinkRoot, 'ffmpeg.exe') : null
    const linkedFfprobe = wingetLinkRoot ? join(wingetLinkRoot, 'ffprobe.exe') : null
    const systemFfmpeg = ffmpeg ?? (linkedFfmpeg && existsSync(linkedFfmpeg) ? linkedFfmpeg : null)
    const systemFfprobe =
      ffprobe ?? (linkedFfprobe && existsSync(linkedFfprobe) ? linkedFfprobe : null)
    this.resolvedRuntime =
      systemFfmpeg && systemFfprobe && mediaRuntimeHasRequiredFeatures(systemFfmpeg, systemFfprobe)
        ? { source: 'system', ffmpeg: systemFfmpeg, ffprobe: systemFfprobe, font }
        : null
    return this.resolvedRuntime
  }

  private requireRuntime(): RuntimePaths {
    const runtime = this.resolveRuntime()
    if (!runtime) {
      throw new LocalMediaError(
        'runtime-missing',
        'Install the free local media tools once, then reopen the app. No GPU is needed.'
      )
    }
    return runtime
  }
}

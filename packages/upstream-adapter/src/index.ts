import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { ZodError } from 'zod'
import {
  AcceptUpstreamImportInputSchema,
  LongFormPlanSchema,
  UpstreamImportActionResultSchema,
  UpstreamImportRecordSchema,
  UpstreamSourceFileSchema,
  type AcceptUpstreamImportInput,
  type LongFormPlan,
  type NeutralShot,
  type UpstreamFileRole,
  type UpstreamImportActionResult,
  type UpstreamImportRecord,
  type UpstreamSourceFile
} from '@studio/contracts'
import { createUlid } from '@studio/domain'

interface AdapterProject {
  manifest: {
    id: string
    type: 'series' | 'film'
    targetDurationMinutes: number
  }
  workspacePath: string
  creativeDirection: {
    profileId: string
    direction: unknown
  } | null
}

export interface UpstreamProjectStore {
  openProject(projectId: string): AdapterProject
}

interface RuntimeScript {
  path: string
  sha256: string
}

interface RuntimeManifest {
  schemaVersion: 1
  commit: string
  scripts: Record<UpstreamFileRole, RuntimeScript>
}

export interface UpstreamAdapterOptions {
  projectStore: UpstreamProjectStore
  upstreamRoot: string
  runtimeManifestPath: string
  nodeExecutable?: string
  nodeEnvironment?: NodeJS.ProcessEnv
  timeoutMs?: number
  now?: () => Date
}

export class UpstreamAdapterError extends Error {
  constructor(
    readonly code:
      | 'cancelled'
      | 'invalid-source'
      | 'lock-mismatch'
      | 'validation-failed'
      | 'timed-out'
      | 'stale-data'
      | 'project-error'
      | 'storage-error'
      | 'unknown',
    message: string
  ) {
    super(message)
    this.name = 'UpstreamAdapterError'
  }
}

interface SourceCandidate {
  role: UpstreamFileRole
  path: string
  originalName: string
}

interface JsonObject {
  [key: string]: unknown
}

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

const rolePatterns: Array<[UpstreamFileRole, RegExp]> = [
  ['outline', /(?:^|-)outline\.json$/i],
  ['characters', /(?:^|-)(?:cast|characters)\.json$/i],
  ['art', /(?:^|-)art\.json$/i],
  ['script', /(?:^|-)script\.json$/i],
  ['storyboard', /(?:^|-)storyboard\.json$/i]
]

const roleOrder: UpstreamFileRole[] = ['outline', 'characters', 'art', 'script', 'storyboard']
const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_PROCESS_OUTPUT = 32_000

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function atomicWrite(path: string, text: string): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  mkdirSync(dirname(path), { recursive: true })
  const descriptor = openSync(temporary, 'wx')
  try {
    writeFileSync(descriptor, text, 'utf8')
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporary, path)
}

function jsonObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new UpstreamAdapterError('invalid-source', `${label} must contain one JSON object.`)
  }
  return value as JsonObject
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : []
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function safeId(value: unknown, fallback: string): string {
  const candidate = text(value, fallback)
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  return candidate || fallback
}

function asTier(value: unknown): 'lead' | 'support' | 'functional' {
  if (value === 'lead' || value === 'protagonist' || value === 'major') return 'lead'
  if (value === 'support' || value === 'supporting') return 'support'
  return 'functional'
}

function actionError(error: unknown): { code: UpstreamAdapterError['code']; message: string } {
  if (error instanceof UpstreamAdapterError) return { code: error.code, message: error.message }
  if (error instanceof ZodError) {
    return {
      code: 'invalid-source',
      message: `The normalized source did not match the studio contract: ${error.issues[0]?.path.join('.') || 'unknown field'} — ${error.issues[0]?.message ?? 'invalid value'}.`
    }
  }
  const code =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? `:${error.code}`
      : ''
  const kind = error instanceof Error ? `${error.name}${code}` : 'UnknownError'
  return {
    code: 'unknown',
    message: `The upstream story package could not be imported safely (${kind}).`
  }
}

function readRuntimeManifest(path: string): RuntimeManifest {
  const parsed = jsonObject(JSON.parse(readFileSync(path, 'utf8')), 'The upstream runtime manifest')
  if (parsed.schemaVersion !== 1 || typeof parsed.commit !== 'string' || !parsed.scripts) {
    throw new UpstreamAdapterError(
      'lock-mismatch',
      'The upstream runtime manifest is not compatible with this studio version.'
    )
  }
  const scripts = parsed.scripts as Record<string, unknown>
  const normalized = {} as Record<UpstreamFileRole, RuntimeScript>
  for (const role of roleOrder) {
    const record = jsonObject(scripts[role], `${role} runtime entry`)
    if (typeof record.path !== 'string' || !/^[a-f0-9]{64}$/.test(String(record.sha256))) {
      throw new UpstreamAdapterError('lock-mismatch', `The ${role} runtime entry is incomplete.`)
    }
    normalized[role] = { path: record.path, sha256: String(record.sha256) }
  }
  return {
    schemaVersion: 1,
    commit: parsed.commit,
    scripts: normalized
  }
}

export class UpstreamAdapter {
  private readonly projectStore: UpstreamProjectStore
  private readonly upstreamRoot: string
  private readonly runtimeManifest: RuntimeManifest
  private readonly nodeExecutable: string
  private readonly nodeEnvironment: NodeJS.ProcessEnv
  private readonly timeoutMs: number
  private readonly now: () => Date

  constructor(options: UpstreamAdapterOptions) {
    this.projectStore = options.projectStore
    this.upstreamRoot = resolve(options.upstreamRoot)
    this.runtimeManifest = readRuntimeManifest(options.runtimeManifestPath)
    this.nodeExecutable = options.nodeExecutable ?? process.execPath
    this.nodeEnvironment = options.nodeEnvironment ?? process.env
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.now = options.now ?? (() => new Date())
    this.verifyRuntime()
  }

  async importFromFolder(
    projectId: string,
    folderPath: string
  ): Promise<UpstreamImportActionResult> {
    try {
      const project = this.openProject(projectId)
      if (!project.creativeDirection) {
        throw new UpstreamAdapterError(
          'project-error',
          'Save the Audience & Creative Direction profile before importing story files.'
        )
      }
      const candidates = this.discover(folderPath)
      const importId = createUlid(this.now().getTime())
      const importRoot = join(project.workspacePath, 'source', 'shuohao', importId.toLowerCase())
      mkdirSync(importRoot, { recursive: false })
      const copied = new Map<UpstreamFileRole, { path: string; source: UpstreamSourceFile }>()
      for (const candidate of candidates) {
        const data = readFileSync(candidate.path)
        const destination = join(importRoot, `${candidate.role}.json`)
        atomicWrite(destination, data.toString('utf8'))
        copied.set(candidate.role, {
          path: destination,
          source: UpstreamSourceFileSchema.parse({
            role: candidate.role,
            originalName: candidate.originalName,
            relativePath: `source/shuohao/${importId.toLowerCase()}/${candidate.role}.json`,
            sha256: sha256(data),
            byteSize: data.byteLength,
            validationState: 'not-run',
            validatorOutput: ''
          })
        })
      }

      let validationFailed = false
      for (const role of roleOrder) {
        const item = copied.get(role)
        if (!item) continue
        const result = await this.validate(role, copied)
        const output = `${result.stdout}${result.stderr ? `\n${result.stderr}` : ''}`
          .trim()
          .slice(0, 8_000)
        item.source = UpstreamSourceFileSchema.parse({
          ...item.source,
          validationState: result.exitCode === 0 ? 'passed' : 'failed',
          validatorOutput: output
        })
        if (result.exitCode !== 0) validationFailed = true
      }

      const createdAt = this.now().toISOString()
      const normalized = validationFailed
        ? null
        : this.normalize(project, importId, createdAt, copied)
      const record = UpstreamImportRecordSchema.parse({
        schemaVersion: 1,
        importId,
        projectId,
        state: validationFailed ? 'validation-failed' : 'preview',
        sourceCommit: this.runtimeManifest.commit,
        creativeDirectionProfileId: project.creativeDirection.profileId,
        creativeDirectionSha256: sha256(JSON.stringify(project.creativeDirection)),
        files: roleOrder.flatMap((role) => {
          const item = copied.get(role)
          return item ? [item.source] : []
        }),
        normalized,
        acceptedAt: null,
        createdAt
      })
      atomicWrite(join(importRoot, 'import.json'), `${JSON.stringify(record, null, 2)}\n`)
      return UpstreamImportActionResultSchema.parse({ ok: true, record })
    } catch (error) {
      return UpstreamImportActionResultSchema.parse({ ok: false, error: actionError(error) })
    }
  }

  listImports(projectId: string): UpstreamImportRecord[] {
    const project = this.openProject(projectId)
    const root = join(project.workspacePath, 'source', 'shuohao')
    if (!existsSync(root)) return []
    const records: UpstreamImportRecord[] = []
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const recordPath = join(root, entry.name, 'import.json')
      if (!existsSync(recordPath)) continue
      try {
        const record = UpstreamImportRecordSchema.parse(
          JSON.parse(readFileSync(recordPath, 'utf8'))
        )
        if (record.projectId === projectId) records.push(record)
      } catch {
        // Damaged imports remain on disk for recovery and are not shown as valid source records.
      }
    }
    return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  acceptImport(unknownInput: AcceptUpstreamImportInput): UpstreamImportActionResult {
    try {
      const input = AcceptUpstreamImportInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const record = this.listImports(input.projectId).find(
        (item) => item.importId === input.importId
      )
      if (!record || !record.normalized) {
        throw new UpstreamAdapterError(
          'invalid-source',
          'That validated import preview could not be found.'
        )
      }
      if (record.state !== 'preview') {
        throw new UpstreamAdapterError(
          'stale-data',
          'That import is no longer waiting for acceptance.'
        )
      }
      if (record.normalized.normalizedSha256 !== input.expectedNormalizedSha256) {
        throw new UpstreamAdapterError(
          'stale-data',
          'The normalized plan changed. Review it again before accepting.'
        )
      }
      const acceptedAt = this.now().toISOString()
      const accepted = UpstreamImportRecordSchema.parse({
        ...record,
        state: 'accepted',
        acceptedAt
      })
      const planRoot = join(project.workspacePath, 'productions', 'plans')
      const planPath = join(planRoot, `long-form-${record.normalized.planId.toLowerCase()}.json`)
      if (existsSync(planPath)) {
        throw new UpstreamAdapterError(
          'stale-data',
          'That normalized plan is already stored in this production.'
        )
      }
      atomicWrite(planPath, `${JSON.stringify(record.normalized, null, 2)}\n`)
      const importPath = join(
        project.workspacePath,
        'source',
        'shuohao',
        record.importId.toLowerCase(),
        'import.json'
      )
      atomicWrite(importPath, `${JSON.stringify(accepted, null, 2)}\n`)
      return UpstreamImportActionResultSchema.parse({ ok: true, record: accepted })
    } catch (error) {
      return UpstreamImportActionResultSchema.parse({ ok: false, error: actionError(error) })
    }
  }

  private verifyRuntime(): void {
    if (!/^[a-f0-9]{40}$/.test(this.runtimeManifest.commit)) {
      throw new UpstreamAdapterError('lock-mismatch', 'The pinned upstream commit is invalid.')
    }
    for (const role of roleOrder) {
      const entry = this.runtimeManifest.scripts[role]
      const scriptPath = resolve(this.upstreamRoot, ...entry.path.split('/'))
      if (!existsSync(scriptPath)) {
        throw new UpstreamAdapterError('lock-mismatch', `The pinned ${role} validator is missing.`)
      }
      const actual = sha256(readFileSync(scriptPath))
      if (actual !== entry.sha256) {
        throw new UpstreamAdapterError(
          'lock-mismatch',
          `The pinned ${role} validator failed its integrity check.`
        )
      }
    }
  }

  private discover(folderPath: string): SourceCandidate[] {
    const folder = resolve(folderPath)
    const stat = statSync(folder)
    if (!stat.isDirectory())
      throw new UpstreamAdapterError(
        'invalid-source',
        'Choose a folder containing upstream JSON files.'
      )
    const found = new Map<UpstreamFileRole, SourceCandidate>()
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const match = rolePatterns.find(([, pattern]) => pattern.test(entry.name))
      if (!match) continue
      const [role] = match
      if (found.has(role))
        throw new UpstreamAdapterError(
          'invalid-source',
          `More than one ${role} file was found. Keep one version in the selected folder.`
        )
      const path = join(folder, entry.name)
      const fileStat = statSync(path)
      if (fileStat.size === 0 || fileStat.size > MAX_SOURCE_BYTES)
        throw new UpstreamAdapterError('invalid-source', `${entry.name} is empty or too large.`)
      try {
        jsonObject(JSON.parse(readFileSync(path, 'utf8')), entry.name)
      } catch (error) {
        if (error instanceof UpstreamAdapterError) throw error
        throw new UpstreamAdapterError('invalid-source', `${entry.name} is not valid JSON.`)
      }
      found.set(role, { role, path, originalName: basename(path) })
    }
    if (!found.has('outline') || !found.has('script')) {
      throw new UpstreamAdapterError(
        'invalid-source',
        'The folder must contain one outline JSON and one script JSON. Character, art, and storyboard files are optional.'
      )
    }
    return roleOrder.flatMap((role) => {
      const item = found.get(role)
      return item ? [item] : []
    })
  }

  private async validate(
    role: UpstreamFileRole,
    copied: Map<UpstreamFileRole, { path: string; source: UpstreamSourceFile }>
  ): Promise<CommandResult> {
    const own = copied.get(role)
    if (!own) return { exitCode: 0, stdout: '', stderr: '' }
    const outline = copied.get('outline')?.path
    const characters = copied.get('characters')?.path
    const art = copied.get('art')?.path
    const script = copied.get('script')?.path
    const args = ['validate', own.path]
    if (role === 'outline') args.push('--stage', 'full')
    if (role === 'art' && characters) args.push('--cast', characters)
    if (role === 'script') {
      if (outline) args.push('--outline', outline)
      if (art) args.push('--art', art)
    }
    if (role === 'storyboard') {
      if (!script)
        throw new UpstreamAdapterError(
          'invalid-source',
          'A storyboard requires the matching script.'
        )
      args.push('--script', script)
      if (outline) args.push('--outline', outline)
      if (characters) args.push('--cast', characters)
      if (art) args.push('--art', art)
      args.push('--no-log')
    }
    const scriptPath = resolve(
      this.upstreamRoot,
      ...this.runtimeManifest.scripts[role].path.split('/')
    )
    return this.runCommand(scriptPath, args)
  }

  private runCommand(scriptPath: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolveResult, reject) => {
      const child = spawn(this.nodeExecutable, [scriptPath, ...args], {
        shell: false,
        windowsHide: true,
        env: this.nodeEnvironment,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let stdout = ''
      let stderr = ''
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        reject(
          new UpstreamAdapterError(
            'timed-out',
            'An upstream validation took too long and was stopped.'
          )
        )
      }, this.timeoutMs)
      child.stdout.on('data', (chunk) => {
        if (stdout.length < MAX_PROCESS_OUTPUT)
          stdout += String(chunk).slice(0, MAX_PROCESS_OUTPUT - stdout.length)
      })
      child.stderr.on('data', (chunk) => {
        if (stderr.length < MAX_PROCESS_OUTPUT)
          stderr += String(chunk).slice(0, MAX_PROCESS_OUTPUT - stderr.length)
      })
      child.once('error', (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(
          new UpstreamAdapterError(
            'validation-failed',
            `The pinned validator could not start (${error.name}).`
          )
        )
      })
      child.once('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolveResult({ exitCode: code ?? 1, stdout, stderr })
      })
    })
  }

  private normalize(
    project: AdapterProject,
    importId: string,
    createdAt: string,
    copied: Map<UpstreamFileRole, { path: string; source: UpstreamSourceFile }>
  ): LongFormPlan {
    const read = (role: UpstreamFileRole): JsonObject | null => {
      const item = copied.get(role)
      return item ? jsonObject(JSON.parse(readFileSync(item.path, 'utf8')), role) : null
    }
    const outline = read('outline')!
    const cast = read('characters')
    const art = read('art')
    const script = read('script')!
    const storyboard = read('storyboard')
    const scriptEpisodes = arrayOfObjects(script.episodes)
    if (scriptEpisodes.length === 0)
      throw new UpstreamAdapterError(
        'invalid-source',
        'The validated script has no episodes to normalize.'
      )
    const outlineEpisodes = new Map(
      arrayOfObjects(outline.episodes).map((episode) => [number(episode.ep, 0), episode])
    )
    const storyboardEpisodes = new Map(
      arrayOfObjects(storyboard?.episodes).map((episode) => [number(episode.ep, 0), episode])
    )
    const sourceSeconds = scriptEpisodes.reduce(
      (total, episode) => total + Math.max(1, number(episode.targetSeconds, 120)),
      0
    )
    const targetDurationSeconds = Math.round(project.manifest.targetDurationMinutes * 60)
    const scale = targetDurationSeconds / sourceSeconds
    const sequences = scriptEpisodes.map((episode, episodeIndex) => {
      const epNumber = number(episode.ep, episodeIndex + 1)
      const outlineEpisode = outlineEpisodes.get(epNumber)
      const sceneList = arrayOfObjects(episode.scenes)
      const episodeTarget = Math.max(1, Math.round(number(episode.targetSeconds, 120) * scale))
      const weights = sceneList.map((scene) => Math.max(1, arrayOfObjects(scene.flow).length))
      const weightTotal = weights.reduce((total, weight) => total + weight, 0)
      const boardSegments = arrayOfObjects(storyboardEpisodes.get(epNumber)?.segments)
      const scenes = sceneList.map((scene, sceneIndex) => {
        const sourceSceneId = text(scene.sceneId, `S${sceneIndex + 1}`)
        const targetSeconds = Math.max(
          1,
          Math.round((episodeTarget * weights[sceneIndex]) / weightTotal)
        )
        const segments = boardSegments.filter(
          (segment) => number(segment.sceneIndex, 0) === sceneIndex + 1
        )
        const shots: NeutralShot[] = []
        for (const [segmentIndex, segment] of segments.entries()) {
          const cuts = arrayOfObjects(segment.cuts)
          for (const [cutIndex, cut] of cuts.entries()) {
            const seconds = Math.max(1, number(cut.seconds, 3))
            const camera = text(cut.camera, 'Static Shot')
            const shotId = `SHOT-${safeId(segment.id, `E${epNumber}-S${sceneIndex + 1}-${segmentIndex + 1}`)}-${cutIndex + 1}`
            shots.push({
              shotId,
              sourceAlias: `${text(segment.id, `segment-${segmentIndex + 1}`)}:cut-${cutIndex + 1}`,
              sourceSceneId,
              narrativeJob: camera === 'Static Shot' ? 'mood' : 'movement',
              targetDurationFrames: Math.max(1, Math.round(seconds * 24)),
              frameRate: 24,
              composition: text(cut.frame, 'Storyboard composition requires review.'),
              cameraIntent: camera,
              characterAliases: strings(cut.characters),
              propAliases: strings(cut.props),
              productionMethod: camera === 'Static Shot' ? 'held-image' : 'image-to-video',
              fallbackMethod: 'held-image',
              sourceH3Prompt: typeof segment.h3Prompt === 'string' ? segment.h3Prompt : null,
              sourceH3ExecutionBlocked: true,
              approvalCriteria: [
                'Matches the active character, style, location, and prop versions.',
                'Preserves the approved narrative beat and framing intent.',
                'Contains no unintended text, logos, identity drift, or visible defects.'
              ]
            })
          }
        }
        if (shots.length === 0) {
          shots.push({
            shotId: `SHOT-E${epNumber}-S${sceneIndex + 1}-HOLD`,
            sourceAlias: `${sourceSceneId}:fallback-hold`,
            sourceSceneId,
            narrativeJob: 'establish',
            targetDurationFrames: targetSeconds * 24,
            frameRate: 24,
            composition:
              'A reviewable held storyboard frame derived from the approved scene action.',
            cameraIntent: 'Static hold pending storyboard decisions',
            characterAliases: strings(scene.characters),
            propAliases: strings(scene.props),
            productionMethod: 'held-image',
            fallbackMethod: 'manual',
            sourceH3Prompt: null,
            sourceH3ExecutionBlocked: true,
            approvalCriteria: [
              'Shows the scene purpose clearly.',
              'Uses only approved character, location, and prop references.'
            ]
          })
        }
        return {
          sceneId: `SCENE-E${epNumber}-${safeId(sourceSceneId, `S${sceneIndex + 1}`)}`,
          sourceAliases: [sourceSceneId],
          label: `Episode ${epNumber} · Scene ${sceneIndex + 1}`,
          purpose: text(
            arrayOfObjects(scene.flow)[0]?.action,
            text(outlineEpisode?.synopsis, 'Scene purpose requires editorial review.')
          ),
          targetSeconds,
          shots
        }
      })
      return {
        sequenceId: `SEQ-EP${epNumber}`,
        label: `Source episode ${epNumber}`,
        purpose: text(
          outlineEpisode?.synopsis,
          text(episode.hook, 'Sequence purpose requires editorial review.')
        ),
        targetSeconds: episodeTarget,
        scenes
      }
    })
    const actCount = Math.min(3, sequences.length)
    const acts = Array.from({ length: actCount }, (_, index) => {
      const from = Math.floor((index * sequences.length) / actCount)
      const to = Math.floor(((index + 1) * sequences.length) / actCount)
      const actSequences = sequences.slice(from, Math.max(from + 1, to))
      return {
        actNumber: index + 1,
        label: actCount === 1 ? 'Complete story' : `Act ${index + 1}`,
        dramaticPurpose:
          index === 0
            ? 'Establish the world, characters, desire, and disrupting problem.'
            : index === actCount - 1
              ? 'Deliver the climax, consequences, and a satisfying ending or next-episode promise.'
              : 'Escalate pressure, reveal consequences, and force meaningful choices.',
        targetSeconds: actSequences.reduce((total, sequence) => total + sequence.targetSeconds, 0),
        sequences: actSequences
      }
    })
    const characterSource =
      arrayOfObjects(cast?.characters).length > 0
        ? arrayOfObjects(cast?.characters)
        : arrayOfObjects(outline.characters)
    const characters = characterSource.map((character, index) => ({
      sourceAlias: text(character.id, `C${index + 1}`),
      name: text(character.name, `Character ${index + 1}`),
      tier: asTier(character.importance ?? character.tier),
      identitySummary: text(
        jsonObject(character.persona ?? {}, 'character persona').appearance,
        text(character.oneLiner, text(character.arc, 'Identity details require review.'))
      )
    }))
    const locations = arrayOfObjects(art?.scenes).map((location, index) => ({
      sourceAlias: text(location.id, `S${index + 1}`),
      name: text(location.name, `Location ${index + 1}`),
      summary: text(location.summary, 'Location details require review.')
    }))
    const warnings = [
      'Upstream short-drama timing was expanded into the project target duration and requires a full pacing review.',
      'Every preserved H3 prompt is source evidence only and is blocked from LTX or ComfyUI execution.',
      'Shot production methods and fallbacks are studio-owned suggestions until the storyboard and animatic are approved.'
    ]
    if (!cast)
      warnings.push(
        'No character-package file was supplied; character summaries were derived from the outline.'
      )
    if (!art)
      warnings.push(
        'No art-package file was supplied; location bibles must be completed before generation.'
      )
    if (!storyboard)
      warnings.push(
        'No storyboard package was supplied; each scene received a safe held-frame placeholder.'
      )
    const planId = createUlid(this.now().getTime())
    const base = {
      schemaVersion: 1 as const,
      planId,
      importId,
      projectId: project.manifest.id,
      projectType: project.manifest.type,
      sourceCommit: this.runtimeManifest.commit,
      sourceLanguage: text(outline.lang ?? cast?.lang, 'unknown'),
      targetDurationSeconds,
      frameRate: 24,
      acts,
      characters,
      locations,
      warnings,
      createdAt
    }
    return LongFormPlanSchema.parse({ ...base, normalizedSha256: sha256(JSON.stringify(base)) })
  }

  private openProject(projectId: string): AdapterProject {
    try {
      return this.projectStore.openProject(projectId)
    } catch {
      throw new UpstreamAdapterError('project-error', 'That production could not be opened safely.')
    }
  }
}

export { actionError as toUpstreamActionError }

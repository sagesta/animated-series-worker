import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import {
  CaptionCueSchema,
  CreateReleasePackageInputSchema,
  FinishActionResultSchema,
  FinishWorkspaceSchema,
  LockProductionTimelineInputSchema,
  ProductionTimelineSchema,
  ReleaseAttestationsSchema,
  ReleaseDetailsSchema,
  ReleasePackageFileSchema,
  ReleasePackageSchema,
  SaveProductionTimelineInputSchema,
  SaveReleaseAttestationsInputSchema,
  SaveReleaseDetailsInputSchema,
  TimelineAudioCueSchema,
  TimelineClipSchema,
  UlidSchema,
  type CreateReleasePackageInput,
  type FinishActionResult,
  type FinishWorkspace,
  type LockProductionTimelineInput,
  type ProductionTimeline,
  type SaveProductionTimelineInput,
  type SaveReleaseAttestationsInput,
  type SaveReleaseDetailsInput
} from '@studio/contracts'
import { createUlid } from '@studio/domain'
import type { ProductionStore } from '@studio/production-store'

interface ProjectLocation {
  manifest: { id: string }
  workspacePath: string
}

interface ReleaseProjectStore {
  openProject(projectId: string): ProjectLocation
}

interface JsonRow {
  record_json: string
}

export interface ReleaseStoreOptions {
  projectStore: ReleaseProjectStore
  productionStore: ProductionStore
  now?: () => Date
}

export class ReleaseStoreError extends Error {
  constructor(
    readonly code:
      | 'invalid-input'
      | 'not-found'
      | 'stale-data'
      | 'approval-required'
      | 'integrity-failed'
      | 'unsafe-path'
      | 'unknown',
    message: string
  ) {
    super(message)
    this.name = 'ReleaseStoreError'
  }
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const fromRoot = relative(rootPath, candidatePath)
  return (
    fromRoot === '' ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
  )
}

function shaFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function atomicJson(path: string, value: unknown): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  mkdirSync(dirname(path), { recursive: true })
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

function parseRow<T>(row: JsonRow | undefined, parser: (value: unknown) => T, message: string): T {
  if (!row) throw new ReleaseStoreError('not-found', message)
  try {
    return parser(JSON.parse(row.record_json))
  } catch (error) {
    if (error instanceof ReleaseStoreError) throw error
    throw new ReleaseStoreError('integrity-failed', message)
  }
}

function safeError(error: unknown): ReleaseStoreError {
  if (error instanceof ReleaseStoreError) return error
  if (error instanceof z.ZodError) {
    return new ReleaseStoreError(
      'invalid-input',
      error.issues[0]?.message ?? 'Check the finishing details.'
    )
  }
  return new ReleaseStoreError('unknown', 'The finishing record could not be changed safely.')
}

function packageName(
  role: 'master' | 'thumbnail' | 'caption',
  index: number,
  source: string
): string {
  const extension = extname(source).toLowerCase()
  return role === 'caption' ? `captions-${index + 1}${extension}` : `${role}${extension}`
}

type PackageFile = z.infer<typeof ReleasePackageFileSchema>

export class ReleaseStore {
  private readonly projectStore: ReleaseProjectStore
  private readonly productionStore: ProductionStore
  private readonly now: () => Date

  constructor(options: ReleaseStoreOptions) {
    this.projectStore = options.projectStore
    this.productionStore = options.productionStore
    this.now = options.now ?? (() => new Date())
  }

  getTimeline(projectId: string, timelineId: string): ProductionTimeline {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const timeline = this.readTimeline(database, UlidSchema.parse(timelineId))
      if (timeline.projectId !== projectId) {
        throw new ReleaseStoreError('not-found', 'That timeline is not in this production.')
      }
      return timeline
    } finally {
      database.close()
    }
  }

  attachMasterAsset(
    projectId: string,
    timelineId: string,
    expectedUpdatedAt: string,
    masterAssetId: string
  ): FinishWorkspace {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const timeline = this.readTimeline(database, UlidSchema.parse(timelineId))
      if (timeline.state !== 'locked') {
        throw new ReleaseStoreError(
          'approval-required',
          'Only a locked timeline can receive a master render.'
        )
      }
      if (timeline.updatedAt !== expectedUpdatedAt) {
        throw new ReleaseStoreError(
          'stale-data',
          'The timeline changed while rendering. The candidate master was kept, but it was not attached.'
        )
      }
      if (timeline.masterAssetId) {
        throw new ReleaseStoreError(
          'approval-required',
          'This timeline already has a master. Create a new timeline revision for a replacement render.'
        )
      }
      const master = this.productionStore
        .getWorkspace(projectId)
        .media.find((asset) => asset.assetId === masterAssetId)
      if (!master || master.kind !== 'master-video' || master.projectId !== projectId) {
        throw new ReleaseStoreError('not-found', 'The candidate master is not in this production.')
      }
      const updatedAt = this.now().toISOString()
      const attached = ProductionTimelineSchema.parse({
        ...timeline,
        masterAssetId: master.assetId,
        updatedAt
      })
      database
        .prepare(
          'UPDATE production_timelines SET record_json = ?, updated_at = ? WHERE timeline_id = ?'
        )
        .run(JSON.stringify(attached), attached.updatedAt, attached.timelineId)
      return this.getWorkspace(projectId)
    } finally {
      database.close()
    }
  }

  getWorkspace(projectId: string): FinishWorkspace {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const timelines = this.readAll(
        database,
        'production_timelines',
        ProductionTimelineSchema.parse
      )
      const releaseDetails = this.readAll(database, 'release_details', ReleaseDetailsSchema.parse)
      const attestations = this.readAll(
        database,
        'release_attestations',
        ReleaseAttestationsSchema.parse
      )
      const releasePackages = this.readAll(database, 'release_packages', ReleasePackageSchema.parse)
      const production = this.productionStore.getWorkspace(projectId)
      const blockers: string[] = []
      if (!timelines.some((timeline) => timeline.state === 'locked'))
        blockers.push('Lock an approved timeline.')
      if (
        !production.media.some(
          (asset) => asset.kind === 'master-video' && asset.state === 'approved'
        )
      )
        blockers.push('Approve a full master video.')
      if (
        !production.media.some((asset) => asset.kind === 'thumbnail' && asset.state === 'approved')
      )
        blockers.push('Select and approve one truthful thumbnail.')
      if (releaseDetails.length === 0) blockers.push('Complete the YouTube release details.')
      if (attestations.length === 0)
        blockers.push('Complete every human release attestation and full watch.')
      if (production.staleDependencyCount > 0)
        blockers.push('Resolve stale continuity dependencies before release lock.')
      return FinishWorkspaceSchema.parse({
        projectId,
        timelines,
        releaseDetails,
        attestations,
        releasePackages,
        blockers
      })
    } finally {
      database.close()
    }
  }

  saveTimeline(unknownInput: SaveProductionTimelineInput): FinishActionResult {
    try {
      const input = SaveProductionTimelineInputSchema.parse(unknownInput)
      this.validateTimeline(input)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const existing = input.timelineId ? this.readTimeline(database, input.timelineId) : null
        if (existing?.state !== 'draft') {
          if (existing)
            throw new ReleaseStoreError(
              'approval-required',
              'A locked timeline cannot be edited. Start a new revision.'
            )
        }
        if (existing && existing.updatedAt !== input.expectedUpdatedAt) {
          throw new ReleaseStoreError(
            'stale-data',
            'The timeline changed. Reload it before saving.'
          )
        }
        const now = this.now().toISOString()
        const revision = existing
          ? existing.revision
          : Number(
              (
                database
                  .prepare(
                    'SELECT COALESCE(MAX(revision), 0) AS revision FROM production_timelines'
                  )
                  .get() as unknown as { revision: number }
              ).revision
            ) + 1
        const record = ProductionTimelineSchema.parse({
          schemaVersion: 1,
          timelineId: existing?.timelineId ?? createUlid(this.now().getTime()),
          projectId: input.projectId,
          revision,
          state: 'draft',
          label: input.label,
          clips: [...input.clips].sort((left, right) => left.order - right.order),
          audioCues: input.audioCues,
          captions: [...input.captions].sort((left, right) => left.startMs - right.startMs),
          durationMs: input.clips.reduce((total, clip) => total + clip.durationMs, 0),
          masterAssetId: null,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          lockedAt: null
        })
        database
          .prepare(
            `INSERT INTO production_timelines (timeline_id, revision, state, record_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(timeline_id) DO UPDATE SET
               state = excluded.state, record_json = excluded.record_json, updated_at = excluded.updated_at`
          )
          .run(
            record.timelineId,
            record.revision,
            record.state,
            JSON.stringify(record),
            record.createdAt,
            record.updatedAt
          )
        return FinishActionResultSchema.parse({
          ok: true,
          workspace: this.getWorkspace(input.projectId)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      const safe = safeError(error)
      return FinishActionResultSchema.parse({
        ok: false,
        error: { code: safe.code, message: safe.message }
      })
    }
  }

  lockTimeline(unknownInput: LockProductionTimelineInput): FinishActionResult {
    try {
      const input = LockProductionTimelineInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const timeline = this.readTimeline(database, input.timelineId)
        if (timeline.state !== 'draft')
          throw new ReleaseStoreError(
            'approval-required',
            'That timeline already has a final decision.'
          )
        if (timeline.updatedAt !== input.expectedUpdatedAt)
          throw new ReleaseStoreError(
            'stale-data',
            'The timeline changed. Review it again before locking.'
          )
        if (timeline.clips.length === 0)
          throw new ReleaseStoreError(
            'approval-required',
            'Add at least one approved visual clip before locking.'
          )
        this.assertApprovedAssets(input.projectId, [
          ...timeline.clips.map((clip) => clip.assetId),
          ...timeline.audioCues.map((cue) => cue.assetId)
        ])
        if (this.productionStore.getWorkspace(input.projectId).staleDependencyCount > 0) {
          throw new ReleaseStoreError(
            'approval-required',
            'Resolve stale continuity dependencies before locking the timeline.'
          )
        }
        const lockedAt = this.now().toISOString()
        const locked = ProductionTimelineSchema.parse({
          ...timeline,
          state: 'locked',
          updatedAt: lockedAt,
          lockedAt
        })
        database
          .prepare(
            'UPDATE production_timelines SET state = ?, record_json = ?, updated_at = ? WHERE timeline_id = ?'
          )
          .run(locked.state, JSON.stringify(locked), locked.updatedAt, locked.timelineId)
        this.productionStore.registerContinuityDependencies(
          input.projectId,
          this.productionStore
            .getWorkspace(input.projectId)
            .canon.filter((canon) => canon.state === 'active')
            .map((canon) => canon.canonId),
          'timeline',
          locked.timelineId
        )
        return FinishActionResultSchema.parse({
          ok: true,
          workspace: this.getWorkspace(input.projectId)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      const safe = safeError(error)
      return FinishActionResultSchema.parse({
        ok: false,
        error: { code: safe.code, message: safe.message }
      })
    }
  }

  saveReleaseDetails(unknownInput: SaveReleaseDetailsInput): FinishActionResult {
    try {
      const input = SaveReleaseDetailsInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const existing = input.releaseDetailsId
          ? parseRow(
              database
                .prepare('SELECT record_json FROM release_details WHERE release_details_id = ?')
                .get(input.releaseDetailsId) as unknown as JsonRow | undefined,
              ReleaseDetailsSchema.parse,
              'Those release details were not found.'
            )
          : null
        if (existing && existing.updatedAt !== input.expectedUpdatedAt)
          throw new ReleaseStoreError(
            'stale-data',
            'The release details changed. Reload before saving.'
          )
        const now = this.now().toISOString()
        const record = ReleaseDetailsSchema.parse({
          schemaVersion: 1,
          releaseDetailsId: existing?.releaseDetailsId ?? createUlid(this.now().getTime()),
          projectId: input.projectId,
          revision: existing?.revision ?? this.nextRevision(database, 'release_details'),
          title: input.title,
          description: input.description,
          language: input.language,
          category: input.category,
          playlist: input.playlist,
          tags: [...new Set(input.tags)],
          hashtags: [...new Set(input.hashtags)],
          chapters: [...input.chapters].sort((left, right) => left.startMs - right.startMs),
          credits: input.credits,
          endScreenNotes: input.endScreenNotes,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now
        })
        if (record.chapters.length > 0 && record.chapters[0]?.startMs !== 0)
          throw new ReleaseStoreError('invalid-input', 'The first chapter must begin at 0:00.')
        database
          .prepare(
            `INSERT INTO release_details (release_details_id, revision, record_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(release_details_id) DO UPDATE SET record_json = excluded.record_json, updated_at = excluded.updated_at`
          )
          .run(
            record.releaseDetailsId,
            record.revision,
            JSON.stringify(record),
            record.createdAt,
            record.updatedAt
          )
        return FinishActionResultSchema.parse({
          ok: true,
          workspace: this.getWorkspace(input.projectId)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      const safe = safeError(error)
      return FinishActionResultSchema.parse({
        ok: false,
        error: { code: safe.code, message: safe.message }
      })
    }
  }

  saveAttestations(unknownInput: SaveReleaseAttestationsInput): FinishActionResult {
    try {
      const input = SaveReleaseAttestationsInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const record = ReleaseAttestationsSchema.parse({
          schemaVersion: 1,
          attestationId: createUlid(this.now().getTime()),
          ...input,
          attestedAt: this.now().toISOString()
        })
        database
          .prepare(
            'INSERT INTO release_attestations (attestation_id, record_json, created_at) VALUES (?, ?, ?)'
          )
          .run(record.attestationId, JSON.stringify(record), record.attestedAt)
        return FinishActionResultSchema.parse({
          ok: true,
          workspace: this.getWorkspace(input.projectId)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      const safe = safeError(error)
      return FinishActionResultSchema.parse({
        ok: false,
        error: { code: safe.code, message: safe.message }
      })
    }
  }

  createReleasePackage(unknownInput: CreateReleasePackageInput): FinishActionResult {
    let packageRoot: string | null = null
    try {
      const input = CreateReleasePackageInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const timeline = this.readTimeline(database, input.timelineId)
        if (timeline.state !== 'locked')
          throw new ReleaseStoreError(
            'approval-required',
            'Lock the exact timeline before packaging.'
          )
        const details = parseRow(
          database
            .prepare('SELECT record_json FROM release_details WHERE release_details_id = ?')
            .get(input.releaseDetailsId) as unknown as JsonRow | undefined,
          ReleaseDetailsSchema.parse,
          'Release details were not found.'
        )
        const attestations = parseRow(
          database
            .prepare('SELECT record_json FROM release_attestations WHERE attestation_id = ?')
            .get(input.attestationId) as unknown as JsonRow | undefined,
          ReleaseAttestationsSchema.parse,
          'Release attestations were not found.'
        )
        if (details.projectId !== input.projectId || attestations.projectId !== input.projectId)
          throw new ReleaseStoreError('unsafe-path', 'Release decisions cannot cross projects.')
        this.assertApprovedAssets(input.projectId, [
          input.masterAssetId,
          input.thumbnailAssetId,
          ...input.captionAssetIds
        ])
        const media = this.productionStore.getWorkspace(input.projectId).media
        const master = media.find(
          (asset) => asset.assetId === input.masterAssetId && asset.kind === 'master-video'
        )
        const thumbnail = media.find(
          (asset) => asset.assetId === input.thumbnailAssetId && asset.kind === 'thumbnail'
        )
        if (!master || !thumbnail)
          throw new ReleaseStoreError(
            'approval-required',
            'Choose an approved master video and approved thumbnail with the correct roles.'
          )
        if (
          input.captionAssetIds.some(
            (id) => !media.some((asset) => asset.assetId === id && asset.kind === 'caption')
          )
        )
          throw new ReleaseStoreError(
            'approval-required',
            'Every selected caption must be an approved caption asset.'
          )
        const releaseId = createUlid(this.now().getTime())
        const relativePath = `releases/${releaseId.toLowerCase()}`
        packageRoot = resolve(project.workspacePath, ...relativePath.split('/'))
        if (!isInside(project.workspacePath, packageRoot) || existsSync(packageRoot))
          throw new ReleaseStoreError('unsafe-path', 'The release package destination is not safe.')
        mkdirSync(packageRoot, { recursive: true })
        const files: PackageFile[] = []
        const assets = [
          { role: 'master' as const, asset: master },
          { role: 'thumbnail' as const, asset: thumbnail },
          ...input.captionAssetIds.map((id) => ({
            role: 'caption' as const,
            asset: media.find((item) => item.assetId === id)!
          }))
        ]
        for (const [index, item] of assets.entries()) {
          const source = this.productionStore.resolveMediaPath(
            input.projectId,
            item.asset.assetId
          ).path
          const fileName = packageName(item.role, index, source)
          const destination = resolve(packageRoot, fileName)
          copyFileSync(source, destination, 0)
          const sha256 = shaFile(destination)
          if (sha256 !== item.asset.sha256)
            throw new ReleaseStoreError(
              'integrity-failed',
              'A selected release file changed during packaging.'
            )
          files.push({ role: item.role, fileName, byteSize: statSync(destination).size, sha256 })
        }
        const detailPath = resolve(packageRoot, 'release-details.json')
        const attestationPath = resolve(packageRoot, 'release-attestations.json')
        atomicJson(detailPath, details)
        atomicJson(attestationPath, attestations)
        files.push({
          role: 'details',
          fileName: basename(detailPath),
          byteSize: statSync(detailPath).size,
          sha256: shaFile(detailPath)
        })
        files.push({
          role: 'attestations',
          fileName: basename(attestationPath),
          byteSize: statSync(attestationPath).size,
          sha256: shaFile(attestationPath)
        })
        const createdAt = this.now().toISOString()
        const manifestPath = resolve(packageRoot, 'manifest.json')
        atomicJson(manifestPath, {
          schemaVersion: 1,
          releaseId,
          projectId: input.projectId,
          timelineId: input.timelineId,
          releaseDetailsId: input.releaseDetailsId,
          attestationId: input.attestationId,
          masterAssetId: input.masterAssetId,
          thumbnailAssetId: input.thumbnailAssetId,
          captionAssetIds: input.captionAssetIds,
          files,
          createdAt
        })
        files.push({
          role: 'manifest',
          fileName: 'manifest.json',
          byteSize: statSync(manifestPath).size,
          sha256: shaFile(manifestPath)
        })
        const record = ReleasePackageSchema.parse({
          schemaVersion: 1,
          releaseId,
          projectId: input.projectId,
          timelineId: input.timelineId,
          releaseDetailsId: input.releaseDetailsId,
          attestationId: input.attestationId,
          masterAssetId: input.masterAssetId,
          thumbnailAssetId: input.thumbnailAssetId,
          captionAssetIds: input.captionAssetIds,
          state: 'locked',
          files,
          relativePath,
          createdAt
        })
        database
          .prepare(
            'INSERT INTO release_packages (release_id, record_json, created_at) VALUES (?, ?, ?)'
          )
          .run(record.releaseId, JSON.stringify(record), record.createdAt)
        this.productionStore.registerContinuityDependencies(
          input.projectId,
          this.productionStore
            .getWorkspace(input.projectId)
            .canon.filter((canon) => canon.state === 'active')
            .map((canon) => canon.canonId),
          'release-package',
          record.releaseId
        )
        packageRoot = null
        return FinishActionResultSchema.parse({
          ok: true,
          workspace: this.getWorkspace(input.projectId)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      if (packageRoot) rmSync(packageRoot, { recursive: true, force: true })
      const safe = safeError(error)
      return FinishActionResultSchema.parse({
        ok: false,
        error: { code: safe.code, message: safe.message }
      })
    }
  }

  private validateTimeline(input: SaveProductionTimelineInput): void {
    const clips = input.clips.map((clip) => TimelineClipSchema.parse(clip))
    const orders = clips.map((clip) => clip.order).sort((left, right) => left - right)
    if (orders.some((order, index) => order !== index))
      throw new ReleaseStoreError(
        'invalid-input',
        'Clip order must be complete and cannot contain duplicates.'
      )
    input.audioCues.forEach((cue) => TimelineAudioCueSchema.parse(cue))
    const captions = input.captions
      .map((cue) => CaptionCueSchema.parse(cue))
      .sort((left, right) => left.startMs - right.startMs)
    for (let index = 1; index < captions.length; index += 1) {
      if (captions[index]!.startMs < captions[index - 1]!.endMs)
        throw new ReleaseStoreError('invalid-input', 'Caption cues cannot overlap.')
    }
    this.assertApprovedAssets(input.projectId, [
      ...clips.map((clip) => clip.assetId),
      ...input.audioCues.map((cue) => cue.assetId)
    ])
  }

  private assertApprovedAssets(projectId: string, assetIds: string[]): void {
    const media = this.productionStore.getWorkspace(projectId).media
    for (const assetId of new Set(assetIds)) {
      const asset = media.find((candidate) => candidate.assetId === assetId)
      if (!asset || asset.state !== 'approved')
        throw new ReleaseStoreError(
          'approval-required',
          'Only approved media from this project can enter a timeline or release package.'
        )
    }
  }

  private openProject(projectId: string): ProjectLocation {
    try {
      return this.projectStore.openProject(UlidSchema.parse(projectId))
    } catch {
      throw new ReleaseStoreError('not-found', 'That production could not be opened safely.')
    }
  }

  private openDatabase(workspacePath: string): DatabaseSync {
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS production_timelines (
        timeline_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        state TEXT NOT NULL,
        record_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS release_details (
        release_details_id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        record_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS release_attestations (
        attestation_id TEXT PRIMARY KEY,
        record_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS release_packages (
        release_id TEXT PRIMARY KEY,
        record_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (4, CURRENT_TIMESTAMP);
    `)
    return database
  }

  private readTimeline(database: DatabaseSync, timelineId: string): ProductionTimeline {
    return parseRow(
      database
        .prepare('SELECT record_json FROM production_timelines WHERE timeline_id = ?')
        .get(UlidSchema.parse(timelineId)) as unknown as JsonRow | undefined,
      ProductionTimelineSchema.parse,
      'That timeline was not found or is damaged.'
    )
  }

  private readAll<T>(
    database: DatabaseSync,
    table: 'production_timelines' | 'release_details' | 'release_attestations' | 'release_packages',
    parser: (value: unknown) => T
  ): T[] {
    return (
      database
        .prepare(`SELECT record_json FROM ${table} ORDER BY created_at DESC`)
        .all() as unknown as JsonRow[]
    ).map((row) => parseRow(row, parser, `A ${table} record is damaged.`))
  }

  private nextRevision(database: DatabaseSync, table: 'release_details'): number {
    const row = database
      .prepare(`SELECT COALESCE(MAX(revision), 0) AS revision FROM ${table}`)
      .get() as unknown as { revision: number }
    return Number(row.revision) + 1
  }
}

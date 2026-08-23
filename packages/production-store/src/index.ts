import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import {
  ApprovalDecisionSchema,
  CanonActionResultSchema,
  CanonRecordSchema,
  CanonImpactSummarySchema,
  ChooseMediaAssetInputSchema,
  CostEstimateSchema,
  ContinuityDependencySchema,
  MediaActionResultSchema,
  MediaAssetSchema,
  MediaAssetViewSchema,
  ProductionJobActionResultSchema,
  ProductionJobApprovalInputSchema,
  ProductionJobDetailsSchema,
  ProductionJobEventSchema,
  ProductionJobInputSchema,
  ProductionJobRecordSchema,
  ProductionWorkspaceSummarySchema,
  PromoteWritingDraftInputSchema,
  RegisterMediaAssetInputSchema,
  ReviewMediaAssetInputSchema,
  UlidSchema,
  type CanonActionResult,
  type CanonRecord,
  type ContinuityDependency,
  type ChooseMediaAssetInput,
  type CostEstimate,
  type MediaActionResult,
  type MediaAsset,
  type MediaAssetView,
  type ProductionJobActionResult,
  type ProductionJobApprovalInput,
  type ProductionJobDetails,
  type ProductionJobEvent,
  type ProductionJobInput,
  type ProductionJobRecord,
  type ProductionJobState,
  type ProductionWorkspaceSummary,
  type PromoteWritingDraftInput,
  type RegisterMediaAssetInput,
  type ReviewMediaAssetInput,
  type WritingDraftRecord
} from '@studio/contracts'
import { createUlid } from '@studio/domain'

interface ProjectLocation {
  manifest: {
    id: string
  }
  workspacePath: string
  creativeDirection: {
    profileId: string
  } | null
}

export interface ProductionProjectStore {
  openProject(projectId: string): ProjectLocation
  listWritingDrafts(projectId: string): WritingDraftRecord[]
}

export interface ProductionStoreOptions {
  projectStore: ProductionProjectStore
  maxImportBytes?: number
  maxSessionCostUsd?: () => number
  now?: () => Date
}

export interface GeneratedMediaRegistration {
  projectId: string
  jobId: string
  label: string
  kind: MediaAsset['kind']
  stagingPath: string
  fileName: string
  mimeType: string
  byteSize: number
  sha256: string
  parentAssetIds: string[]
}

export interface AssembledMediaRegistration {
  projectId: string
  assemblyId: string
  label: string
  kind: MediaAsset['kind']
  stagingPath: string
  fileName: string
  mimeType: string
  byteSize: number
  sha256: string
  parentAssetIds: string[]
  width: number | null
  height: number | null
  durationMs: number | null
}

export class ProductionStoreError extends Error {
  constructor(
    readonly code:
      | 'invalid-input'
      | 'not-found'
      | 'stale-data'
      | 'approval-required'
      | 'budget-exceeded'
      | 'invalid-state'
      | 'unsafe-path'
      | 'integrity-failed'
      | 'project-error'
      | 'unknown',
    message: string
  ) {
    super(message)
    this.name = 'ProductionStoreError'
  }
}

interface JsonRow {
  record_json: string
}

interface CountRow {
  count: number
}

const MAX_IMPORT_BYTES = 20 * 1024 * 1024 * 1024

const mediaTypes = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.srt', 'application/x-subrip'],
  ['.vtt', 'text/vtt'],
  ['.json', 'application/json'],
  ['.pdf', 'application/pdf']
])

const allowedTransitions: Record<ProductionJobState, readonly ProductionJobState[]> = {
  planned: ['estimated'],
  estimated: ['approved', 'cancelled'],
  approved: ['queued', 'cancelled'],
  queued: ['provisioning', 'cancel-requested', 'failed'],
  provisioning: ['running', 'cancel-requested', 'failed', 'terminated'],
  running: ['downloading', 'cancel-requested', 'failed', 'terminated'],
  downloading: ['verifying', 'cancel-requested', 'failed'],
  verifying: ['awaiting-review', 'failed'],
  'awaiting-review': ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  'cancel-requested': ['cancelled', 'terminated', 'failed'],
  cancelled: [],
  terminated: []
}

function consumerTypeForJob(
  kind: ProductionJobRecord['kind']
): ContinuityDependency['consumerType'] {
  if (['qwen-image', 'qwen-image-edit'].includes(kind)) return 'image'
  if (kind === 'qwen3-tts') return 'voice'
  if (kind === 'animatic') return 'storyboard'
  if (['timeline-render', 'caption-export', 'foley'].includes(kind)) return 'timeline'
  if (kind === 'adaptation-train') return 'image'
  if (kind === 'thumbnail-render') return 'thumbnail'
  if (kind === 'release-package') return 'release-package'
  return 'video'
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const fromRoot = relative(rootPath, candidatePath)
  return (
    fromRoot === '' ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
  )
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function parseJson<T>(row: JsonRow | undefined, parse: (value: unknown) => T, message: string): T {
  if (!row) throw new ProductionStoreError('not-found', message)
  try {
    return parse(JSON.parse(row.record_json))
  } catch {
    throw new ProductionStoreError('integrity-failed', message)
  }
}

function mediaUrl(projectId: string, assetId: string): string {
  return `studio-media://asset/${projectId}/${assetId}`
}

function toAssetView(asset: MediaAsset): MediaAssetView {
  return MediaAssetViewSchema.parse({
    ...asset,
    mediaUrl: mediaUrl(asset.projectId, asset.assetId)
  })
}

function sniffMimeType(path: string, expected: string): boolean {
  const descriptor = openSync(path, 'r')
  try {
    const prefix = Buffer.alloc(16)
    readSync(descriptor, prefix, 0, prefix.length, 0)
    if (expected === 'image/png')
      return prefix.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    if (expected === 'image/jpeg')
      return prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff
    if (expected === 'image/webp')
      return prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WEBP'
    if (expected === 'audio/wav')
      return prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WAVE'
    if (expected === 'audio/mpeg')
      return (
        prefix.toString('ascii', 0, 3) === 'ID3' ||
        (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0)
      )
    if (expected === 'video/mp4') return prefix.toString('ascii', 4, 8) === 'ftyp'
    if (expected === 'video/webm')
      return prefix.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'))
    if (expected === 'application/pdf') return prefix.toString('ascii', 0, 5) === '%PDF-'
    return true
  } finally {
    closeSync(descriptor)
  }
}

async function copyAndHash(sourcePath: string, destinationPath: string): Promise<string> {
  const temporaryPath = `${destinationPath}.${randomUUID()}.tmp`
  const hash = createHash('sha256')
  const source = createReadStream(sourcePath)
  source.on('data', (chunk) => hash.update(chunk as Buffer))
  mkdirSync(dirname(destinationPath), { recursive: true })
  try {
    await pipeline(source, createWriteStream(temporaryPath, { flags: 'wx' }))
    const descriptor = openSync(temporaryPath, 'r+')
    try {
      fsyncSync(descriptor)
    } finally {
      closeSync(descriptor)
    }
    renameSync(temporaryPath, destinationPath)
    return hash.digest('hex')
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
    throw error
  }
}

function productionError(error: unknown): ProductionStoreError {
  if (error instanceof ProductionStoreError) return error
  const errorCode =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? `:${error.code}`
      : ''
  const errorCall =
    error instanceof Error && 'syscall' in error && typeof error.syscall === 'string'
      ? `:${error.syscall}`
      : ''
  const errorType =
    error instanceof Error ? `${error.name}${errorCode}${errorCall}` : 'UnknownError'
  return new ProductionStoreError(
    'unknown',
    `The production record could not be changed safely (${errorType}).`
  )
}

export function toProductionActionError(error: unknown): {
  code: ProductionStoreError['code']
  message: string
} {
  const safe = productionError(error)
  return { code: safe.code, message: safe.message }
}

export class ProductionStore {
  private readonly projectStore: ProductionProjectStore
  private readonly maxImportBytes: number
  private readonly maxSessionCostUsd: () => number
  private readonly now: () => Date

  constructor(options: ProductionStoreOptions) {
    this.projectStore = options.projectStore
    this.maxImportBytes = options.maxImportBytes ?? MAX_IMPORT_BYTES
    this.maxSessionCostUsd = options.maxSessionCostUsd ?? (() => 10)
    this.now = options.now ?? (() => new Date())
  }

  getWorkspace(projectId: string): ProductionWorkspaceSummary {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const canon = (
        database
          .prepare('SELECT record_json FROM canon_records ORDER BY created_at DESC')
          .all() as unknown as JsonRow[]
      ).map((row) =>
        parseJson(row, (value) => CanonRecordSchema.parse(value), 'A canon record is damaged.')
      )
      const media = (
        database
          .prepare('SELECT record_json FROM media_assets ORDER BY created_at DESC')
          .all() as unknown as JsonRow[]
      ).map((row) =>
        toAssetView(
          parseJson(row, (value) => MediaAssetSchema.parse(value), 'A media record is damaged.')
        )
      )
      const jobs = (
        database
          .prepare('SELECT record_json FROM production_jobs ORDER BY created_at DESC')
          .all() as unknown as JsonRow[]
      ).map((row) =>
        parseJson(
          row,
          (value) => ProductionJobRecordSchema.parse(value),
          'A job record is damaged.'
        )
      )
      const staleRow = database
        .prepare("SELECT COUNT(*) AS count FROM continuity_dependencies WHERE state = 'stale'")
        .get() as unknown as CountRow
      const promotedDrafts = new Set(canon.map((record) => record.sourceDraftId))
      const canonImpacts = canon.map((record) => {
        const rows = database
          .prepare('SELECT record_json FROM continuity_dependencies WHERE source_canon_id = ?')
          .all(record.canonId) as unknown as JsonRow[]
        const dependencies = rows.map((row) =>
          parseJson(
            row,
            (value) => ContinuityDependencySchema.parse(value),
            'A continuity dependency is damaged.'
          )
        )
        return CanonImpactSummarySchema.parse({
          canonId: record.canonId,
          activeRevision: record.revision,
          dependentCount: dependencies.length,
          staleDependentCount: dependencies.filter((dependency) => dependency.state === 'stale')
            .length,
          affectedTypes: [...new Set(dependencies.map((dependency) => dependency.consumerType))]
        })
      })
      const draftFingerprints = this.projectStore.listWritingDrafts(projectId).map((draft) => ({
        draftId: draft.draftId,
        sha256: hashJson(draft),
        alreadyPromoted: promotedDrafts.has(draft.draftId)
      }))

      return ProductionWorkspaceSummarySchema.parse({
        projectId,
        canon,
        media,
        jobs,
        canonImpacts,
        draftFingerprints,
        staleDependencyCount: staleRow.count,
        estimatedApprovedSpendUsd: jobs
          .filter((job) => !['cancelled', 'failed', 'terminated'].includes(job.state))
          .reduce((total, job) => total + (job.approvedMaximumUsd ?? 0), 0),
        actualSpendUsd: jobs.reduce((total, job) => total + job.actualCostUsd, 0),
        elapsedCloudUsageEstimateUsd: jobs.reduce(
          (total, job) => total + job.elapsedCostEstimateUsd,
          0
        )
      })
    } finally {
      database.close()
    }
  }

  promoteWritingDraft(unknownInput: PromoteWritingDraftInput): CanonActionResult {
    try {
      const input = PromoteWritingDraftInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const draft = this.projectStore
        .listWritingDrafts(input.projectId)
        .find((candidate) => candidate.draftId === input.draftId)
      if (!draft)
        throw new ProductionStoreError('not-found', 'That writing proposal no longer exists.')
      const draftSha256 = hashJson(draft)
      if (draftSha256 !== input.expectedDraftSha256) {
        throw new ProductionStoreError(
          'stale-data',
          'The writing proposal changed after this screen opened. Review it again before approval.'
        )
      }

      const database = this.openDatabase(project.workspacePath)
      try {
        const alreadyPromoted = database
          .prepare('SELECT record_json FROM canon_records WHERE source_draft_id = ?')
          .get(draft.draftId) as unknown as JsonRow | undefined
        if (alreadyPromoted) {
          throw new ProductionStoreError(
            'invalid-state',
            'That proposal is already recorded in canon.'
          )
        }

        const activeRow = database
          .prepare(
            "SELECT record_json FROM canon_records WHERE kind = ? AND lower(label) = lower(?) AND state = 'active'"
          )
          .get(input.kind, input.label) as unknown as JsonRow | undefined
        const active = activeRow
          ? parseJson(
              activeRow,
              (value) => CanonRecordSchema.parse(value),
              'The active canon record is damaged.'
            )
          : undefined
        const createdAt = this.now().toISOString()
        const canonId = createUlid(this.now().getTime())
        const outputSha256 = hashJson(draft.output)
        const decision = ApprovalDecisionSchema.parse({
          decisionId: createUlid(this.now().getTime()),
          projectId: input.projectId,
          subjectType: 'canon',
          subjectId: canonId,
          decision: 'approved',
          reason: input.reason,
          confirmation: true,
          decidedAt: createdAt,
          contentSha256: outputSha256
        })
        const record = CanonRecordSchema.parse({
          schemaVersion: 1,
          canonId,
          projectId: input.projectId,
          kind: input.kind,
          label: input.label,
          revision: (active?.revision ?? 0) + 1,
          state: 'active',
          sourceDraftId: draft.draftId,
          sourceDraftSha256: draftSha256,
          creativeDirectionProfileId: project.creativeDirection?.profileId ?? null,
          output: draft.output,
          outputSha256,
          approval: decision,
          createdAt,
          supersededAt: null
        })

        database.exec('BEGIN IMMEDIATE')
        try {
          if (active) {
            const superseded = CanonRecordSchema.parse({
              ...active,
              state: 'superseded',
              supersededAt: createdAt
            })
            database
              .prepare(
                "UPDATE canon_records SET state = 'superseded', record_json = ? WHERE canon_id = ?"
              )
              .run(JSON.stringify(superseded), active.canonId)
            const dependencyRows = database
              .prepare(
                "SELECT record_json FROM continuity_dependencies WHERE source_canon_id = ? AND state = 'current'"
              )
              .all(active.canonId) as unknown as JsonRow[]
            for (const row of dependencyRows) {
              const dependency = parseJson(
                row,
                (value) => ContinuityDependencySchema.parse(value),
                'A continuity dependency is damaged.'
              )
              const stale = ContinuityDependencySchema.parse({
                ...dependency,
                state: 'stale',
                staleAt: createdAt
              })
              database
                .prepare(
                  "UPDATE continuity_dependencies SET state = 'stale', stale_at = ?, record_json = ? WHERE dependency_id = ?"
                )
                .run(createdAt, JSON.stringify(stale), stale.dependencyId)
            }
          }
          database
            .prepare(
              `INSERT INTO canon_records
               (canon_id, kind, label, revision, state, source_draft_id, record_json, created_at)
               VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
            )
            .run(
              record.canonId,
              record.kind,
              record.label,
              record.revision,
              record.sourceDraftId,
              JSON.stringify(record),
              record.createdAt
            )
          database
            .prepare(
              `INSERT INTO approval_decisions
               (decision_id, subject_type, subject_id, decision, record_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
              decision.decisionId,
              decision.subjectType,
              decision.subjectId,
              decision.decision,
              JSON.stringify(decision),
              decision.decidedAt
            )
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        return CanonActionResultSchema.parse({ ok: true, canon: record })
      } finally {
        database.close()
      }
    } catch (error) {
      return CanonActionResultSchema.parse({ ok: false, error: toProductionActionError(error) })
    }
  }

  async importMedia(unknownInput: RegisterMediaAssetInput): Promise<MediaActionResult> {
    try {
      const input = RegisterMediaAssetInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const sourcePath = resolve(input.sourcePath)
      const stat = statSync(sourcePath)
      if (!stat.isFile()) throw new ProductionStoreError('invalid-input', 'Choose one media file.')
      if (stat.size === 0 || stat.size > this.maxImportBytes) {
        throw new ProductionStoreError(
          'invalid-input',
          'That media file is empty or exceeds the import limit.'
        )
      }
      const extension = extname(sourcePath).toLowerCase()
      const mimeType = mediaTypes.get(extension)
      if (!mimeType || !sniffMimeType(sourcePath, mimeType)) {
        throw new ProductionStoreError(
          'integrity-failed',
          'The selected file type is unsupported or does not match its contents.'
        )
      }
      const assetId = createUlid(this.now().getTime())
      const safeName = basename(sourcePath)
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .slice(-120)
      const relativePath = `assets/imported/${assetId.toLowerCase()}-${safeName}`
      const destinationPath = resolve(project.workspacePath, ...relativePath.split('/'))
      if (!isInside(project.workspacePath, destinationPath) || existsSync(destinationPath)) {
        throw new ProductionStoreError('unsafe-path', 'The media destination was not safe to use.')
      }
      const sha256 = await copyAndHash(sourcePath, destinationPath)
      const record = MediaAssetSchema.parse({
        schemaVersion: 1,
        assetId,
        projectId: input.projectId,
        kind: input.kind,
        label: input.label,
        relativePath,
        mimeType,
        byteSize: stat.size,
        sha256,
        origin: input.origin,
        jobId: null,
        parentAssetIds: input.parentAssetIds,
        state: 'candidate',
        width: null,
        height: null,
        durationMs: null,
        createdAt: this.now().toISOString()
      })
      const database = this.openDatabase(project.workspacePath)
      try {
        database
          .prepare(
            `INSERT INTO media_assets
             (asset_id, kind, state, relative_path, sha256, record_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            record.assetId,
            record.kind,
            record.state,
            record.relativePath,
            record.sha256,
            JSON.stringify(record),
            record.createdAt
          )
      } catch (error) {
        if (existsSync(destinationPath)) unlinkSync(destinationPath)
        throw error
      } finally {
        database.close()
      }
      return MediaActionResultSchema.parse({ ok: true, asset: toAssetView(record) })
    } catch (error) {
      return MediaActionResultSchema.parse({ ok: false, error: toProductionActionError(error) })
    }
  }

  reviewMedia(unknownInput: ReviewMediaAssetInput): MediaActionResult {
    try {
      const input = ReviewMediaAssetInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const asset = this.readAsset(database, input.assetId)
        if (asset.projectId !== input.projectId)
          throw new ProductionStoreError('not-found', 'That media item is not in this production.')
        if (asset.sha256 !== input.expectedSha256)
          throw new ProductionStoreError(
            'stale-data',
            'That media item changed. Review it again before deciding.'
          )
        if (asset.state !== 'candidate')
          throw new ProductionStoreError('invalid-state', 'That media item already has a decision.')
        const state = input.decision === 'approved' ? 'approved' : 'rejected'
        const updated = MediaAssetSchema.parse({ ...asset, state })
        const decision = ApprovalDecisionSchema.parse({
          decisionId: createUlid(this.now().getTime()),
          projectId: input.projectId,
          subjectType: 'asset',
          subjectId: asset.assetId,
          decision: input.decision,
          reason: input.reason,
          confirmation: true,
          decidedAt: this.now().toISOString(),
          contentSha256: asset.sha256
        })
        database.exec('BEGIN IMMEDIATE')
        try {
          database
            .prepare('UPDATE media_assets SET state = ?, record_json = ? WHERE asset_id = ?')
            .run(updated.state, JSON.stringify(updated), updated.assetId)
          database
            .prepare(
              `INSERT INTO approval_decisions
               (decision_id, subject_type, subject_id, decision, record_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(
              decision.decisionId,
              decision.subjectType,
              decision.subjectId,
              decision.decision,
              JSON.stringify(decision),
              decision.decidedAt
            )
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        if (updated.jobId) {
          const job = this.readJob(database, updated.jobId)
          if (job.state === 'awaiting-review' && job.outputAssetIds.length > 0) {
            const outputAssets = job.outputAssetIds.map((assetId) =>
              this.readAsset(database, assetId)
            )
            if (outputAssets.every((output) => output.state === 'approved')) {
              const succeeded = ProductionJobRecordSchema.parse({
                ...job,
                state: 'succeeded',
                updatedAt: this.now().toISOString()
              })
              const event = this.makeEvent(
                succeeded,
                'succeeded',
                'Every generated output for this job received an explicit human approval.',
                100
              )
              database.exec('BEGIN IMMEDIATE')
              try {
                this.updateJob(database, succeeded)
                this.insertEvent(database, event)
                database.exec('COMMIT')
              } catch (error) {
                database.exec('ROLLBACK')
                throw error
              }
            }
          }
        }
        return MediaActionResultSchema.parse({ ok: true, asset: toAssetView(updated) })
      } finally {
        database.close()
      }
    } catch (error) {
      return MediaActionResultSchema.parse({ ok: false, error: toProductionActionError(error) })
    }
  }

  planJob(unknownInput: ProductionJobInput): ProductionJobActionResult {
    try {
      const input = ProductionJobInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      this.assertEstimateCurrent(input.estimate)
      const database = this.openDatabase(project.workspacePath)
      try {
        const existing = database
          .prepare('SELECT record_json FROM production_jobs WHERE idempotency_key = ?')
          .get(input.idempotencyKey) as unknown as JsonRow | undefined
        if (existing) {
          const job = parseJson(
            existing,
            (value) => ProductionJobRecordSchema.parse(value),
            'A matching job is damaged.'
          )
          const expectedInput = {
            kind: input.kind,
            workflowId: input.workflowId,
            workflowVersion: input.workflowVersion,
            inputAssetIds: input.inputAssetIds,
            canonIds: input.canonIds,
            parameters: input.parameters,
            estimate: input.estimate
          }
          const storedInput = {
            kind: job.kind,
            workflowId: job.workflowId,
            workflowVersion: job.workflowVersion,
            inputAssetIds: job.inputAssetIds,
            canonIds: job.canonIds,
            parameters: job.parameters,
            estimate: job.estimate
          }
          if (hashJson(expectedInput) !== hashJson(storedInput)) {
            throw new ProductionStoreError(
              'invalid-state',
              'That job identity is already used for different work.'
            )
          }
          return ProductionJobActionResultSchema.parse({
            ok: true,
            details: this.readJobDetails(database, job)
          })
        }
        for (const assetId of input.inputAssetIds) {
          const asset = this.readAsset(database, assetId)
          if (asset.state !== 'approved')
            throw new ProductionStoreError(
              'approval-required',
              `Approve “${asset.label}” before using it in paid work.`
            )
        }
        for (const canonId of input.canonIds) {
          const canon = this.readCanon(database, canonId)
          if (canon.state !== 'active')
            throw new ProductionStoreError(
              'stale-data',
              `“${canon.label}” is no longer the active canon revision.`
            )
        }
        const createdAt = this.now().toISOString()
        const job = ProductionJobRecordSchema.parse({
          schemaVersion: 1,
          jobId: createUlid(this.now().getTime()),
          projectId: input.projectId,
          kind: input.kind,
          label: input.label,
          state: 'estimated',
          workflowId: input.workflowId,
          workflowVersion: input.workflowVersion,
          inputAssetIds: input.inputAssetIds,
          canonIds: input.canonIds,
          parameters: input.parameters,
          idempotencyKey: input.idempotencyKey,
          estimate: input.estimate,
          approvedMaximumUsd: null,
          actualCostUsd: 0,
          elapsedCostEstimateUsd: 0,
          costState: 'not-recorded',
          outputAssetIds: [],
          workerLeaseId: null,
          workerPodId: null,
          workerHardDeadline: null,
          workerClosedAt: null,
          recoverable: true,
          lastErrorCode: null,
          createdAt,
          updatedAt: createdAt
        })
        const event = this.makeEvent(
          job,
          'estimated',
          'Cost and runtime were estimated. No GPU was started.',
          null
        )
        database.exec('BEGIN IMMEDIATE')
        try {
          this.insertJob(database, job)
          this.insertEvent(database, event)
          this.insertContinuityDependencies(
            database,
            input.projectId,
            input.canonIds,
            consumerTypeForJob(job.kind),
            job.jobId
          )
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        return ProductionJobActionResultSchema.parse({
          ok: true,
          details: { job, events: [event] }
        })
      } finally {
        database.close()
      }
    } catch (error) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: toProductionActionError(error)
      })
    }
  }

  approveJob(unknownInput: ProductionJobApprovalInput): ProductionJobActionResult {
    try {
      const input = ProductionJobApprovalInputSchema.parse(unknownInput)
      const project = this.openProject(input.projectId)
      const database = this.openDatabase(project.workspacePath)
      try {
        const job = this.readJob(database, input.jobId)
        if (job.projectId !== input.projectId)
          throw new ProductionStoreError('not-found', 'That job is not in this production.')
        if (job.state !== 'estimated')
          throw new ProductionStoreError(
            'invalid-state',
            'That job is no longer waiting for cost approval.'
          )
        if (job.estimate.estimateId !== input.expectedEstimateId)
          throw new ProductionStoreError(
            'stale-data',
            'The cost estimate changed. Review the new maximum before approval.'
          )
        this.assertEstimateCurrent(job.estimate)
        if (input.acceptedMaximumUsd < job.estimate.maximumTotalUsd)
          throw new ProductionStoreError(
            'budget-exceeded',
            'The accepted maximum is below the job’s worst-case estimate.'
          )
        if (input.acceptedMaximumUsd > this.maxSessionCostUsd())
          throw new ProductionStoreError(
            'budget-exceeded',
            'This approval is above the saved session spending limit.'
          )
        const updated = ProductionJobRecordSchema.parse({
          ...job,
          state: 'approved',
          approvedMaximumUsd: input.acceptedMaximumUsd,
          updatedAt: this.now().toISOString()
        })
        const event = this.makeEvent(
          updated,
          'approved',
          'The maximum cost was approved. The job has not been queued yet.',
          null
        )
        database.exec('BEGIN IMMEDIATE')
        try {
          this.updateJob(database, updated)
          this.insertEvent(database, event)
          database.exec('COMMIT')
        } catch (error) {
          database.exec('ROLLBACK')
          throw error
        }
        return ProductionJobActionResultSchema.parse({
          ok: true,
          details: this.readJobDetails(database, updated)
        })
      } finally {
        database.close()
      }
    } catch (error) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: toProductionActionError(error)
      })
    }
  }

  getProjectJob(projectId: string, jobId: string): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      return this.readJobDetails(database, job)
    } finally {
      database.close()
    }
  }

  transitionJob(
    projectId: string,
    jobId: string,
    state: ProductionJobState,
    message: string,
    progressPercent: number | null = null
  ): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      if (!allowedTransitions[job.state].includes(state)) {
        throw new ProductionStoreError(
          'invalid-state',
          `A ${job.state} job cannot move to ${state}.`
        )
      }
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        state,
        updatedAt: this.now().toISOString()
      })
      const event = this.makeEvent(updated, state, message, progressPercent)
      database.exec('BEGIN IMMEDIATE')
      try {
        this.updateJob(database, updated)
        this.insertEvent(database, event)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  assignWorker(
    projectId: string,
    jobId: string,
    leaseId: string,
    hardDeadline: string
  ): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      if (job.state !== 'approved') {
        throw new ProductionStoreError(
          'invalid-state',
          'Only an approved job can reserve a worker.'
        )
      }
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        state: 'queued',
        workerLeaseId: UlidSchema.parse(leaseId),
        workerHardDeadline: new Date(hardDeadline).toISOString(),
        workerClosedAt: null,
        updatedAt: this.now().toISOString()
      })
      const event = this.makeEvent(
        updated,
        'queued',
        'A protected worker lease was reserved. Provider reconciliation runs before creation.',
        0
      )
      database.exec('BEGIN IMMEDIATE')
      try {
        this.updateJob(database, updated)
        this.insertEvent(database, event)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  attachProviderPod(projectId: string, jobId: string, podId: string): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      if (!['queued', 'provisioning'].includes(job.state)) {
        throw new ProductionStoreError(
          'invalid-state',
          'That job is not waiting for a provider worker.'
        )
      }
      const state: ProductionJobState = 'provisioning'
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        state,
        workerPodId: z.string().min(1).max(191).parse(podId),
        updatedAt: this.now().toISOString()
      })
      const event = this.makeEvent(
        updated,
        state,
        'RunPod returned a worker identity. The secured gateway is starting and being checked.',
        2
      )
      database.exec('BEGIN IMMEDIATE')
      try {
        this.updateJob(database, updated)
        this.insertEvent(database, event)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  markWorkerClosed(projectId: string, jobId: string, reason: string): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      if (!job.workerLeaseId) {
        throw new ProductionStoreError('invalid-state', 'That job has no worker lease to close.')
      }
      if (job.workerClosedAt) return this.readJobDetails(database, job)
      const timestamp = this.now().toISOString()
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        workerClosedAt: timestamp,
        recoverable: false,
        updatedAt: timestamp
      })
      const event = this.makeEvent(
        updated,
        updated.state,
        z.string().min(2).max(500).parse(reason),
        null
      )
      database.exec('BEGIN IMMEDIATE')
      try {
        this.updateJob(database, updated)
        this.insertEvent(database, event)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  recordActualCost(projectId: string, jobId: string, actualCostUsd: number): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      const safeCost = z.number().nonnegative().parse(actualCostUsd)
      if (safeCost < job.actualCostUsd) {
        throw new ProductionStoreError(
          'stale-data',
          'Recorded provider cost cannot move backwards.'
        )
      }
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        actualCostUsd: safeCost,
        costState: 'provider-reconciled',
        lastErrorCode:
          job.approvedMaximumUsd !== null && safeCost > job.approvedMaximumUsd
            ? 'approved-cost-exceeded'
            : job.lastErrorCode,
        updatedAt: this.now().toISOString()
      })
      this.updateJob(database, updated)
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  recordElapsedCostEstimate(
    projectId: string,
    jobId: string,
    elapsedCostEstimateUsd: number
  ): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      const safeCost = z.number().nonnegative().parse(elapsedCostEstimateUsd)
      if (safeCost < job.elapsedCostEstimateUsd) return this.readJobDetails(database, job)
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        elapsedCostEstimateUsd: safeCost,
        costState:
          job.costState === 'provider-reconciled' ? 'provider-reconciled' : 'elapsed-estimate',
        lastErrorCode:
          job.approvedMaximumUsd !== null && safeCost > job.approvedMaximumUsd
            ? 'approved-cost-estimate-exceeded'
            : job.lastErrorCode,
        updatedAt: this.now().toISOString()
      })
      this.updateJob(database, updated)
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  resolveMediaPath(projectId: string, assetId: string): { path: string; mimeType: string } {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const asset = this.readAsset(database, UlidSchema.parse(assetId))
      const path = resolve(project.workspacePath, ...asset.relativePath.split('/'))
      if (!isInside(project.workspacePath, path) || !existsSync(path)) {
        throw new ProductionStoreError(
          'unsafe-path',
          'That media file is unavailable or outside its production.'
        )
      }
      return { path, mimeType: asset.mimeType }
    } finally {
      database.close()
    }
  }

  prepareArtifactDownload(projectId: string, jobId: string, fileName: string): string {
    const project = this.openProject(projectId)
    const safeJobId = UlidSchema.parse(jobId)
    const safeName = z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
      .parse(fileName)
    const directory = resolve(project.workspacePath, 'assets', 'download-staging', safeJobId)
    const path = resolve(directory, safeName)
    if (!isInside(project.workspacePath, path) || !isInside(directory, path) || existsSync(path)) {
      throw new ProductionStoreError('unsafe-path', 'The output download destination is not safe.')
    }
    mkdirSync(directory, { recursive: true })
    return path
  }

  prepareAssemblyOutput(projectId: string, assemblyId: string, fileName: string): string {
    const project = this.openProject(projectId)
    const safeAssemblyId = UlidSchema.parse(assemblyId)
    const safeName = z
      .string()
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
      .parse(fileName)
    const directory = resolve(project.workspacePath, 'assets', 'assembly-staging', safeAssemblyId)
    const path = resolve(directory, safeName)
    if (!isInside(project.workspacePath, path) || !isInside(directory, path) || existsSync(path)) {
      throw new ProductionStoreError('unsafe-path', 'The local assembly destination is not safe.')
    }
    mkdirSync(directory, { recursive: true })
    return path
  }

  registerAssembledMedia(unknownInput: AssembledMediaRegistration): MediaAssetView {
    const input = z
      .object({
        projectId: UlidSchema,
        assemblyId: UlidSchema,
        label: z.string().trim().min(1).max(240),
        kind: MediaAssetSchema.shape.kind,
        stagingPath: z.string().min(1).max(2_000),
        fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
        mimeType: MediaAssetSchema.shape.mimeType,
        byteSize: z.number().int().positive(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        parentAssetIds: UlidSchema.array().max(2_500),
        width: z.number().int().positive().nullable(),
        height: z.number().int().positive().nullable(),
        durationMs: z.number().int().positive().nullable()
      })
      .strict()
      .parse(unknownInput)
    const project = this.openProject(input.projectId)
    const stagingRoot = resolve(
      project.workspacePath,
      'assets',
      'assembly-staging',
      input.assemblyId
    )
    const stagingPath = resolve(input.stagingPath)
    if (!isInside(stagingRoot, stagingPath) || !existsSync(stagingPath)) {
      throw new ProductionStoreError(
        'unsafe-path',
        'The assembled output is outside its protected staging area.'
      )
    }
    const stat = statSync(stagingPath)
    if (!stat.isFile() || stat.size !== input.byteSize) {
      throw new ProductionStoreError(
        'integrity-failed',
        'The assembled output size changed before registration.'
      )
    }
    const actualHash = createHash('sha256')
    const descriptor = openSync(stagingPath, 'r')
    try {
      const buffer = Buffer.alloc(1024 * 1024)
      let bytesRead = 0
      let position = 0
      while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, position)) > 0) {
        actualHash.update(buffer.subarray(0, bytesRead))
        position += bytesRead
      }
    } finally {
      closeSync(descriptor)
    }
    if (actualHash.digest('hex') !== input.sha256 || !sniffMimeType(stagingPath, input.mimeType)) {
      throw new ProductionStoreError(
        'integrity-failed',
        'The assembled output failed its local file check.'
      )
    }
    const database = this.openDatabase(project.workspacePath)
    let destinationPath: string | null = null
    try {
      for (const parentId of input.parentAssetIds) this.readAsset(database, parentId)
      const assetId = createUlid(this.now().getTime())
      const relativePath = `assets/assembled/${assetId.toLowerCase()}-${input.fileName}`
      destinationPath = resolve(project.workspacePath, ...relativePath.split('/'))
      if (!isInside(project.workspacePath, destinationPath) || existsSync(destinationPath)) {
        throw new ProductionStoreError(
          'unsafe-path',
          'The assembled media destination is not safe.'
        )
      }
      mkdirSync(dirname(destinationPath), { recursive: true })
      renameSync(stagingPath, destinationPath)
      const record = MediaAssetSchema.parse({
        schemaVersion: 1,
        assetId,
        projectId: input.projectId,
        kind: input.kind,
        label: input.label,
        relativePath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        sha256: input.sha256,
        origin: 'assembled',
        jobId: null,
        parentAssetIds: input.parentAssetIds,
        state: 'candidate',
        width: input.width,
        height: input.height,
        durationMs: input.durationMs,
        createdAt: this.now().toISOString()
      })
      database
        .prepare(
          `INSERT INTO media_assets
           (asset_id, kind, state, relative_path, sha256, record_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.assetId,
          record.kind,
          record.state,
          record.relativePath,
          record.sha256,
          JSON.stringify(record),
          record.createdAt
        )
      return toAssetView(record)
    } catch (error) {
      if (destinationPath && existsSync(destinationPath)) unlinkSync(destinationPath)
      throw error
    } finally {
      database.close()
    }
  }

  registerGeneratedMedia(unknownInput: GeneratedMediaRegistration): MediaAssetView {
    const input = z
      .object({
        projectId: UlidSchema,
        jobId: UlidSchema,
        label: z.string().trim().min(1).max(240),
        kind: MediaAssetSchema.shape.kind,
        stagingPath: z.string().min(1).max(2_000),
        fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
        mimeType: MediaAssetSchema.shape.mimeType,
        byteSize: z.number().int().positive(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        parentAssetIds: UlidSchema.array().max(2_500)
      })
      .strict()
      .parse(unknownInput)
    const project = this.openProject(input.projectId)
    const stagingRoot = resolve(project.workspacePath, 'assets', 'download-staging', input.jobId)
    const stagingPath = resolve(input.stagingPath)
    if (!isInside(stagingRoot, stagingPath) || !existsSync(stagingPath)) {
      throw new ProductionStoreError(
        'unsafe-path',
        'The generated output is outside its download staging area.'
      )
    }
    const stat = statSync(stagingPath)
    if (!stat.isFile() || stat.size !== input.byteSize) {
      throw new ProductionStoreError(
        'integrity-failed',
        'The generated output size changed after download.'
      )
    }
    const actualHash = createHash('sha256')
    const descriptor = openSync(stagingPath, 'r')
    try {
      const buffer = Buffer.alloc(1024 * 1024)
      let bytesRead = 0
      let position = 0
      while ((bytesRead = readSync(descriptor, buffer, 0, buffer.length, position)) > 0) {
        actualHash.update(buffer.subarray(0, bytesRead))
        position += bytesRead
      }
    } finally {
      closeSync(descriptor)
    }
    if (actualHash.digest('hex') !== input.sha256 || !sniffMimeType(stagingPath, input.mimeType)) {
      throw new ProductionStoreError(
        'integrity-failed',
        'The generated output failed its final local integrity check.'
      )
    }
    const database = this.openDatabase(project.workspacePath)
    let destinationPath: string | null = null
    try {
      const job = this.readJob(database, input.jobId)
      if (!['downloading', 'verifying'].includes(job.state)) {
        throw new ProductionStoreError(
          'invalid-state',
          'That job is not accepting verified outputs.'
        )
      }
      for (const parentId of input.parentAssetIds) this.readAsset(database, parentId)
      const assetId = createUlid(this.now().getTime())
      const relativePath = `assets/generated/${assetId.toLowerCase()}-${input.fileName}`
      destinationPath = resolve(project.workspacePath, ...relativePath.split('/'))
      if (!isInside(project.workspacePath, destinationPath) || existsSync(destinationPath)) {
        throw new ProductionStoreError(
          'unsafe-path',
          'The generated output destination is not safe.'
        )
      }
      mkdirSync(dirname(destinationPath), { recursive: true })
      renameSync(stagingPath, destinationPath)
      const record = MediaAssetSchema.parse({
        schemaVersion: 1,
        assetId,
        projectId: input.projectId,
        kind: input.kind,
        label: input.label,
        relativePath,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        sha256: input.sha256,
        origin: 'generated',
        jobId: input.jobId,
        parentAssetIds: input.parentAssetIds,
        state: 'candidate',
        width: null,
        height: null,
        durationMs: null,
        createdAt: this.now().toISOString()
      })
      const updatedJob = ProductionJobRecordSchema.parse({
        ...job,
        outputAssetIds: [...job.outputAssetIds, assetId],
        updatedAt: this.now().toISOString()
      })
      database.exec('BEGIN IMMEDIATE')
      try {
        database
          .prepare(
            `INSERT INTO media_assets
             (asset_id, kind, state, relative_path, sha256, record_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            record.assetId,
            record.kind,
            record.state,
            record.relativePath,
            record.sha256,
            JSON.stringify(record),
            record.createdAt
          )
        this.updateJob(database, updatedJob)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      destinationPath = null
      return toAssetView(record)
    } catch (error) {
      if (destinationPath && existsSync(destinationPath)) renameSync(destinationPath, stagingPath)
      throw productionError(error)
    } finally {
      database.close()
    }
  }

  recordRecoverableError(
    projectId: string,
    jobId: string,
    errorCode: string,
    message: string
  ): ProductionJobDetails {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      const job = this.readJob(database, UlidSchema.parse(jobId))
      const updated = ProductionJobRecordSchema.parse({
        ...job,
        recoverable: true,
        lastErrorCode: z.string().min(1).max(100).parse(errorCode),
        updatedAt: this.now().toISOString()
      })
      const event = this.makeEvent(updated, updated.state, message, null)
      database.exec('BEGIN IMMEDIATE')
      try {
        this.updateJob(database, updated)
        this.insertEvent(database, event)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return this.readJobDetails(database, updated)
    } finally {
      database.close()
    }
  }

  registerContinuityDependencies(
    projectId: string,
    canonIds: string[],
    consumerType: ContinuityDependency['consumerType'],
    consumerId: string
  ): void {
    const project = this.openProject(projectId)
    const database = this.openDatabase(project.workspacePath)
    try {
      database.exec('BEGIN IMMEDIATE')
      try {
        this.insertContinuityDependencies(
          database,
          projectId,
          UlidSchema.array().max(100).parse(canonIds),
          ContinuityDependencySchema.shape.consumerType.parse(consumerType),
          UlidSchema.parse(consumerId)
        )
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    } finally {
      database.close()
    }
  }

  private openProject(projectId: string): ProjectLocation {
    try {
      return this.projectStore.openProject(UlidSchema.parse(projectId))
    } catch (error) {
      if (error instanceof ProductionStoreError) throw error
      throw new ProductionStoreError('project-error', 'That production could not be opened safely.')
    }
  }

  private openDatabase(workspacePath: string): DatabaseSync {
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    try {
      database.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = FULL;
        CREATE TABLE IF NOT EXISTS canon_records (
          canon_id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          revision INTEGER NOT NULL,
          state TEXT NOT NULL,
          source_draft_id TEXT NOT NULL UNIQUE,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS canon_active_label
          ON canon_records(kind, label) WHERE state = 'active';
        CREATE TABLE IF NOT EXISTS approval_decisions (
          decision_id TEXT PRIMARY KEY,
          subject_type TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          decision TEXT NOT NULL,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS continuity_dependencies (
          dependency_id TEXT PRIMARY KEY,
          source_canon_id TEXT NOT NULL,
          consumer_type TEXT NOT NULL,
          consumer_id TEXT NOT NULL,
          state TEXT NOT NULL,
          stale_at TEXT,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS continuity_consumer_source
          ON continuity_dependencies(source_canon_id, consumer_type, consumer_id);
        CREATE TABLE IF NOT EXISTS media_assets (
          asset_id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          state TEXT NOT NULL,
          relative_path TEXT NOT NULL UNIQUE,
          sha256 TEXT NOT NULL,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS production_jobs (
          job_id TEXT PRIMARY KEY,
          idempotency_key TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL,
          state TEXT NOT NULL,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS job_events (
          event_id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          state TEXT NOT NULL,
          record_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(job_id) REFERENCES production_jobs(job_id)
        );
        CREATE INDEX IF NOT EXISTS job_events_job_created
          ON job_events(job_id, created_at);
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
          VALUES (3, CURRENT_TIMESTAMP);
      `)
      return database
    } catch (error) {
      database.close()
      throw error
    }
  }

  private readAsset(database: DatabaseSync, assetId: string): MediaAsset {
    const row = database
      .prepare('SELECT record_json FROM media_assets WHERE asset_id = ?')
      .get(assetId) as unknown as JsonRow | undefined
    return parseJson(
      row,
      (value) => MediaAssetSchema.parse(value),
      'That media record could not be found or is damaged.'
    )
  }

  private readCanon(database: DatabaseSync, canonId: string): CanonRecord {
    const row = database
      .prepare('SELECT record_json FROM canon_records WHERE canon_id = ?')
      .get(canonId) as unknown as JsonRow | undefined
    return parseJson(
      row,
      (value) => CanonRecordSchema.parse(value),
      'That canon record could not be found or is damaged.'
    )
  }

  private readJob(database: DatabaseSync, jobId: string): ProductionJobRecord {
    const row = database
      .prepare('SELECT record_json FROM production_jobs WHERE job_id = ?')
      .get(jobId) as unknown as JsonRow | undefined
    return parseJson(
      row,
      (value) => ProductionJobRecordSchema.parse(value),
      'That production job could not be found or is damaged.'
    )
  }

  private readJobDetails(database: DatabaseSync, job: ProductionJobRecord): ProductionJobDetails {
    const events = (
      database
        .prepare('SELECT record_json FROM job_events WHERE job_id = ? ORDER BY created_at ASC')
        .all(job.jobId) as unknown as JsonRow[]
    ).map((row) =>
      parseJson(row, (value) => ProductionJobEventSchema.parse(value), 'A job event is damaged.')
    )
    return ProductionJobDetailsSchema.parse({ job, events })
  }

  private insertJob(database: DatabaseSync, job: ProductionJobRecord): void {
    database
      .prepare(
        `INSERT INTO production_jobs
         (job_id, idempotency_key, kind, state, record_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.jobId,
        job.idempotencyKey,
        job.kind,
        job.state,
        JSON.stringify(job),
        job.createdAt,
        job.updatedAt
      )
  }

  private updateJob(database: DatabaseSync, job: ProductionJobRecord): void {
    database
      .prepare(
        'UPDATE production_jobs SET state = ?, record_json = ?, updated_at = ? WHERE job_id = ?'
      )
      .run(job.state, JSON.stringify(job), job.updatedAt, job.jobId)
  }

  private insertEvent(database: DatabaseSync, event: ProductionJobEvent): void {
    database
      .prepare(
        'INSERT INTO job_events (event_id, job_id, state, record_json, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(event.eventId, event.jobId, event.state, JSON.stringify(event), event.createdAt)
  }

  private insertContinuityDependencies(
    database: DatabaseSync,
    projectId: string,
    canonIds: string[],
    consumerType: ContinuityDependency['consumerType'],
    consumerId: string
  ): void {
    for (const canonId of canonIds) {
      const canon = this.readCanon(database, canonId)
      if (canon.projectId !== projectId || canon.state !== 'active') {
        throw new ProductionStoreError(
          'stale-data',
          'A continuity dependency no longer points to active canon.'
        )
      }
      const dependency = ContinuityDependencySchema.parse({
        dependencyId: createUlid(this.now().getTime()),
        projectId,
        sourceCanonId: canon.canonId,
        consumerType,
        consumerId,
        sourceOutputSha256: canon.outputSha256,
        state: 'current',
        createdAt: this.now().toISOString(),
        staleAt: null
      })
      database
        .prepare(
          `INSERT OR IGNORE INTO continuity_dependencies
           (dependency_id, source_canon_id, consumer_type, consumer_id, state, stale_at, record_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          dependency.dependencyId,
          dependency.sourceCanonId,
          dependency.consumerType,
          dependency.consumerId,
          dependency.state,
          dependency.staleAt,
          JSON.stringify(dependency),
          dependency.createdAt
        )
    }
  }

  private makeEvent(
    job: ProductionJobRecord,
    state: ProductionJobState,
    message: string,
    progressPercent: number | null
  ): ProductionJobEvent {
    return ProductionJobEventSchema.parse({
      eventId: createUlid(this.now().getTime()),
      jobId: job.jobId,
      projectId: job.projectId,
      state,
      message,
      progressPercent,
      createdAt: this.now().toISOString()
    })
  }

  private assertEstimateCurrent(estimate: CostEstimate): void {
    const safe = CostEstimateSchema.parse(estimate)
    if (Date.parse(safe.expiresAt) <= this.now().getTime()) {
      throw new ProductionStoreError(
        'stale-data',
        'That price estimate expired. Refresh it before approval.'
      )
    }
    if (safe.maximumTotalUsd < safe.expectedTotalUsd) {
      throw new ProductionStoreError(
        'invalid-input',
        'The maximum cost cannot be below the expected cost.'
      )
    }
  }
}

export function buildMediaImportInput(
  input: ChooseMediaAssetInput,
  sourcePath: string
): RegisterMediaAssetInput {
  const safe = ChooseMediaAssetInputSchema.parse(input)
  return RegisterMediaAssetInputSchema.parse({ ...safe, sourcePath, origin: 'imported' })
}

export { hashJson, mediaUrl }

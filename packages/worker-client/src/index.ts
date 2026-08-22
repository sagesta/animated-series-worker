import { createHash, randomBytes } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync
} from 'node:fs'
import { dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { z } from 'zod'
import { CapabilityReportSchema, type CapabilityReport } from '@studio/workflow-registry'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const TRANSFER_CHUNK_BYTES = 4 * 1024 ** 2

export const WorkerHealthSchema = z
  .object({
    status: z.enum(['starting', 'ready', 'busy', 'draining']),
    release: z.string().min(1),
    leaseId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    hardDeadline: z.string().datetime({ offset: true }),
    comfyUi: z.enum(['starting', 'ready', 'unavailable']),
    activeJobs: z.number().int().nonnegative(),
    secondsUntilHardStop: z.number().int().nonnegative(),
    secondsUntilIdleStop: z.number().int().nonnegative()
  })
  .strict()
export type WorkerHealth = z.infer<typeof WorkerHealthSchema>

export const WorkerArtifactSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
    mimeType: z.string().min(1).max(100),
    byteSize: z.number().int().positive(),
    sha256: Sha256Schema,
    downloadPath: z.string().regex(/^\/v1\/artifacts\//)
  })
  .strict()
export type WorkerArtifact = z.infer<typeof WorkerArtifactSchema>

export const WorkerJobSchema = z
  .object({
    jobId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    idempotencyKey: Sha256Schema,
    workflowId: z.string().min(1).max(100),
    workflowVersion: z.string().min(1).max(80),
    state: z.enum(['queued', 'running', 'verifying', 'succeeded', 'failed', 'cancelled']),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    message: z.string().min(1).max(500),
    comfyPromptId: z.string().nullable(),
    artifacts: z.array(WorkerArtifactSchema).max(100),
    errorCode: z.string().min(1).max(100).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type WorkerJob = z.infer<typeof WorkerJobSchema>

export const WorkerSubmitJobInputSchema = z
  .object({
    jobId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    idempotencyKey: Sha256Schema,
    workflowId: z.string().min(1).max(100),
    workflowVersion: z.string().min(1).max(80),
    parameters: z.record(
      z.string().min(1).max(80),
      z.union([z.string().max(4000), z.number().finite(), z.boolean()])
    ),
    inputAssets: z
      .array(
        z
          .object({
            assetId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
            fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
            sha256: Sha256Schema,
            byteSize: z.number().int().positive()
          })
          .strict()
      )
      .max(50)
  })
  .strict()
export type WorkerSubmitJobInput = z.infer<typeof WorkerSubmitJobInputSchema>

export class WorkerClientError extends Error {
  constructor(
    readonly code:
      | 'unauthorized'
      | 'timed-out'
      | 'unavailable'
      | 'invalid-response'
      | 'integrity-failed'
      | 'conflict'
      | 'refused',
    message: string
  ) {
    super(message)
    this.name = 'WorkerClientError'
  }
}

export interface WorkerClientOptions {
  baseUrl: string
  token: string
  timeoutMs?: number
  transferChunkBytes?: number
  fetchImplementation?: typeof fetch
}

function validateBaseUrl(value: string): string {
  const url = new URL(value)
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new WorkerClientError('refused', 'The worker connection must use HTTPS.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new WorkerClientError(
      'refused',
      'The worker address contains unsupported credentials or query data.'
    )
  }
  return url.toString().replace(/\/$/, '')
}

function mapStatus(status: number): WorkerClientError {
  if (status === 401 || status === 403)
    return new WorkerClientError(
      'unauthorized',
      'The worker rejected this short-lived session token.'
    )
  if (status === 409)
    return new WorkerClientError(
      'conflict',
      'The worker already has different work under this identity.'
    )
  if (status === 400 || status === 404 || status === 422)
    return new WorkerClientError('refused', 'The worker refused this request before running it.')
  return new WorkerClientError('unavailable', 'The worker could not complete this request.')
}

export function createWorkerToken(): { token: string; sha256: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, sha256: createHash('sha256').update(token).digest('hex') }
}

export class WorkerClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number
  private readonly transferChunkBytes: number
  private readonly fetchImplementation: typeof fetch

  constructor(options: WorkerClientOptions) {
    this.baseUrl = validateBaseUrl(options.baseUrl)
    this.token = z.string().min(32).max(200).parse(options.token)
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.transferChunkBytes = z
      .number()
      .int()
      .min(1024)
      .max(TRANSFER_CHUNK_BYTES)
      .parse(options.transferChunkBytes ?? TRANSFER_CHUNK_BYTES)
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch
  }

  async getHealth(): Promise<WorkerHealth> {
    return WorkerHealthSchema.parse(await this.requestJson('/v1/health', { method: 'GET' }))
  }

  async getCapabilities(): Promise<CapabilityReport> {
    return CapabilityReportSchema.parse(
      await this.requestJson('/v1/capabilities', { method: 'GET' })
    )
  }

  async submitJob(unknownInput: WorkerSubmitJobInput): Promise<WorkerJob> {
    const input = WorkerSubmitJobInputSchema.parse(unknownInput)
    return WorkerJobSchema.parse(
      await this.requestJson('/v1/jobs', { method: 'POST', body: JSON.stringify(input) })
    )
  }

  async getJob(jobId: string): Promise<WorkerJob> {
    const id = z
      .string()
      .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
      .parse(jobId)
    return WorkerJobSchema.parse(await this.requestJson(`/v1/jobs/${id}`, { method: 'GET' }))
  }

  async cancelJob(jobId: string): Promise<WorkerJob> {
    const id = z
      .string()
      .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
      .parse(jobId)
    return WorkerJobSchema.parse(
      await this.requestJson(`/v1/jobs/${id}/cancel`, { method: 'POST' })
    )
  }

  async purgeJob(jobId: string): Promise<void> {
    const id = z
      .string()
      .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
      .parse(jobId)
    await this.request(`/v1/jobs/${id}`, { method: 'DELETE' })
  }

  async uploadAsset(input: {
    jobId: string
    assetId: string
    fileName: string
    sha256: string
    bytes: Uint8Array
  }): Promise<void> {
    const safe = z
      .object({
        jobId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        assetId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
        sha256: Sha256Schema,
        bytes: z.instanceof(Uint8Array)
      })
      .parse(input)
    const actual = createHash('sha256').update(safe.bytes).digest('hex')
    if (actual !== safe.sha256)
      throw new WorkerClientError('integrity-failed', 'The input changed before upload.')
    if (safe.bytes.byteLength > this.transferChunkBytes) {
      throw new WorkerClientError(
        'refused',
        'Use the streamed file uploader for inputs larger than 4 MB.'
      )
    }
    await this.request(`/v1/uploads/${safe.jobId}/${safe.assetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(safe.bytes.byteLength),
        'Content-Range': `bytes 0-${safe.bytes.byteLength - 1}/${safe.bytes.byteLength}`,
        'X-Studio-File-Name': safe.fileName,
        'X-Studio-Sha256': safe.sha256
      },
      body: safe.bytes
    })
  }

  async uploadAssetFromPath(input: {
    jobId: string
    assetId: string
    fileName: string
    sha256: string
    sourcePath: string
    byteSize: number
  }): Promise<void> {
    const safe = z
      .object({
        jobId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        assetId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
        fileName: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/),
        sha256: Sha256Schema,
        sourcePath: z.string().min(1).max(2000),
        byteSize: z
          .number()
          .int()
          .positive()
          .max(20 * 1024 ** 3)
      })
      .parse(input)
    if (!existsSync(safe.sourcePath) || statSync(safe.sourcePath).size !== safe.byteSize) {
      throw new WorkerClientError('integrity-failed', 'The input file changed before upload.')
    }
    const sourceHash = createHash('sha256')
    for await (const chunk of createReadStream(safe.sourcePath)) sourceHash.update(chunk)
    if (sourceHash.digest('hex') !== safe.sha256) {
      throw new WorkerClientError('integrity-failed', 'The input hash changed before upload.')
    }
    for (let start = 0; start < safe.byteSize; start += this.transferChunkBytes) {
      const end = Math.min(safe.byteSize - 1, start + this.transferChunkBytes - 1)
      const body = createReadStream(safe.sourcePath, { start, end })
      const response = await this.request(`/v1/uploads/${safe.jobId}/${safe.assetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${safe.byteSize}`,
          'X-Studio-File-Name': safe.fileName,
          'X-Studio-Sha256': safe.sha256
        },
        body: body as unknown as BodyInit,
        duplex: 'half'
      } as RequestInit & { duplex: 'half' })
      const receipt = z
        .object({
          ok: z.literal(true),
          complete: z.boolean(),
          nextOffset: z.number().int().nonnegative(),
          byteSize: z.number().int().positive(),
          sha256: Sha256Schema
        })
        .strict()
        .parse(await response.json())
      if (
        receipt.nextOffset !== end + 1 ||
        receipt.byteSize !== safe.byteSize ||
        receipt.sha256 !== safe.sha256 ||
        receipt.complete !== (end + 1 === safe.byteSize)
      ) {
        throw new WorkerClientError(
          'integrity-failed',
          'The worker upload receipt did not match the sent chunk.'
        )
      }
    }
  }

  async downloadArtifact(artifact: WorkerArtifact, destinationPath: string): Promise<void> {
    const safe = WorkerArtifactSchema.parse(artifact)
    const temporaryPath = `${destinationPath}.partial`
    mkdirSync(dirname(destinationPath), { recursive: true })
    const hash = createHash('sha256')
    try {
      for (let start = 0; start < safe.byteSize; start += this.transferChunkBytes) {
        const end = Math.min(safe.byteSize - 1, start + this.transferChunkBytes - 1)
        const response = await this.request(safe.downloadPath, {
          method: 'GET',
          headers: { Range: `bytes=${start}-${end}` }
        })
        if (!response.body)
          throw new WorkerClientError(
            'invalid-response',
            'The worker returned an empty download chunk.'
          )
        const expectedLength = end - start + 1
        const contentLength = Number(response.headers.get('content-length'))
        const contentRange = response.headers.get('content-range')
        if (
          contentLength !== expectedLength ||
          (response.status === 206 && contentRange !== `bytes ${start}-${end}/${safe.byteSize}`) ||
          (response.status !== 206 &&
            !(response.status === 200 && start === 0 && expectedLength === safe.byteSize))
        ) {
          throw new WorkerClientError(
            'integrity-failed',
            'The worker download range did not match its manifest.'
          )
        }
        const source = Readable.fromWeb(response.body as never)
        source.on('data', (chunk) => hash.update(chunk as Buffer))
        await pipeline(
          source,
          createWriteStream(temporaryPath, { flags: start === 0 ? 'wx' : 'a' })
        )
      }
      if (statSync(temporaryPath).size !== safe.byteSize) {
        throw new WorkerClientError(
          'integrity-failed',
          'The worker download size did not match its manifest.'
        )
      }
      if (hash.digest('hex') !== safe.sha256)
        throw new WorkerClientError(
          'integrity-failed',
          'The worker download failed its hash check.'
        )
      renameSync(temporaryPath, destinationPath)
    } catch (error) {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
      throw error
    }
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.request(path, init)
    try {
      return await response.json()
    } catch {
      throw new WorkerClientError('invalid-response', 'The worker returned an unreadable response.')
    }
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    if (!path.startsWith('/v1/'))
      throw new WorkerClientError('refused', 'The worker path was not allowlisted.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const streamingBody =
        typeof init.body === 'object' && init.body !== null && 'pipe' in init.body
      const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.token}`,
          ...(init.body && !(init.body instanceof Uint8Array) && !streamingBody
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...init.headers
        },
        redirect: 'error',
        signal: controller.signal
      })
      if (!response.ok) throw mapStatus(response.status)
      return response
    } catch (error) {
      if (error instanceof WorkerClientError) throw error
      if (controller.signal.aborted)
        throw new WorkerClientError('timed-out', 'The worker request timed out safely.')
      throw new WorkerClientError('unavailable', 'The worker could not be reached.')
    } finally {
      clearTimeout(timeout)
    }
  }
}

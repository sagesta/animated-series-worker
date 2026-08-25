import { z } from 'zod'
import { CloudGpuOptionSchema, type CloudErrorCode, type CloudGpuOption } from '@studio/contracts'

const DEFAULT_REST_BASE_URL = 'https://rest.runpod.io/v1'
const DEFAULT_CATALOG_BASE_URL = 'https://api.runpod.io/v2'
const DEFAULT_TIMEOUT_MS = 12_000
const ACTIVE_POD_STATES = new Set(['RUNNING'])

const CurrencySchema = z.union([z.number().nonnegative(), z.string().regex(/^\d+(?:\.\d+)?$/)])

const RunPodPodSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().default('Unnamed studio worker'),
    desiredStatus: z.enum(['RUNNING', 'EXITED', 'TERMINATED']),
    costPerHr: CurrencySchema.catch(0),
    adjustedCostPerHr: z.number().nonnegative().nullable().optional(),
    publicIp: z.string().nullable().optional(),
    portMappings: z.record(z.string(), z.number().int().positive()).catch({}),
    env: z.record(z.string(), z.string()).catch({}),
    image: z.string().optional(),
    networkVolume: z
      .object({ id: z.string().min(1), name: z.string().optional(), size: z.number().optional() })
      .passthrough()
      .nullable()
      .optional(),
    gpu: z
      .object({
        id: z.string().min(1),
        count: z.number().int().positive(),
        displayName: z.string().optional()
      })
      .passthrough()
      .optional(),
    lastStartedAt: z.string().optional(),
    lastStatusChange: z.string().optional()
  })
  .passthrough()

const RunPodListPodsResponseSchema = z.union([
  z.array(RunPodPodSchema),
  z.object({ pods: z.array(RunPodPodSchema) }).passthrough()
])

const NumericCatalogValueSchema = z.union([
  z.number().nonnegative(),
  z.string().regex(/^\d+(?:\.\d+)?$/)
])
const NullableCatalogValueSchema = NumericCatalogValueSchema.nullable().optional()

const RunPodGpuCatalogItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).nullish(),
    manufacturer: z.string().min(1).nullish(),
    memory: NumericCatalogValueSchema,
    price: z
      .object({ secure: NullableCatalogValueSchema, community: NullableCatalogValueSchema })
      .passthrough()
  })
  .passthrough()

const RunPodGpuCatalogSchema = z
  .object({
    gpus: z.array(z.unknown())
  })
  .passthrough()

export const RunPodCreatePodInputSchema = z
  .object({
    leaseId: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    name: z.string().trim().min(3).max(191),
    imageName: z.string().trim().min(3).max(500),
    gpuTypeIds: z.array(z.string().min(1)).min(1).max(12),
    gpuCount: z.number().int().min(1).max(3),
    containerDiskInGb: z.number().int().min(20).max(2000),
    volumeInGb: z.number().int().min(0).max(2000),
    networkVolumeId: z.string().min(1).max(191).optional(),
    ports: z
      .array(z.string().regex(/^\d{2,5}\/(?:http|tcp)$/))
      .min(1)
      .max(5),
    environment: z.record(z.string().regex(/^[A-Z][A-Z0-9_]*$/), z.string().max(4000)),
    interruptible: z.boolean().default(false)
  })
  .strict()
export type RunPodCreatePodInput = z.infer<typeof RunPodCreatePodInputSchema>

export interface RunPodPod {
  id: string
  name: string
  desiredStatus: 'RUNNING' | 'EXITED' | 'TERMINATED'
  hourlyCostUsd: number
  publicIp: string | null
  portMappings: Record<string, number>
  environment: Record<string, string>
  imageName: string | null
  gpuTypeId: string | null
  gpuCount: number
  hasNetworkVolume: boolean
  lastStartedAt: string | null
  lastStatusChange: string | null
}

export interface RunPodAccountCheck {
  totalPods: number
  activePods: number
  activeHourlyCostUsd: number
}

export class RunPodConnectionError extends Error {
  readonly code: CloudErrorCode

  constructor(code: CloudErrorCode, message: string) {
    super(message)
    this.name = 'RunPodConnectionError'
    this.code = code
  }
}

export interface RunPodClientOptions {
  restBaseUrl?: string
  catalogBaseUrl?: string
  timeoutMs?: number
  fetchImplementation?: typeof fetch
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function toCurrency(value: number | string): number {
  return typeof value === 'number' ? value : Number.parseFloat(value)
}

function nullableCurrency(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : toCurrency(value)
}

function toPod(value: z.infer<typeof RunPodPodSchema>): RunPodPod {
  return {
    id: value.id,
    name: value.name,
    desiredStatus: value.desiredStatus,
    hourlyCostUsd: value.adjustedCostPerHr ?? toCurrency(value.costPerHr),
    publicIp: value.publicIp ?? null,
    portMappings: value.portMappings,
    environment: value.env,
    imageName: value.image ?? null,
    gpuTypeId: value.gpu?.id ?? null,
    gpuCount: value.gpu?.count ?? 0,
    hasNetworkVolume: Boolean(value.networkVolume),
    lastStartedAt: value.lastStartedAt ?? null,
    lastStatusChange: value.lastStatusChange ?? null
  }
}

function lowestPrice(option: CloudGpuOption): number {
  return Math.min(
    option.secureHourlyUsd ?? Number.POSITIVE_INFINITY,
    option.communityHourlyUsd ?? Number.POSITIVE_INFINITY
  )
}

function mapHttpError(status: number): RunPodConnectionError {
  if (status === 401) {
    return new RunPodConnectionError(
      'invalid-key',
      'RunPod did not accept this API key. Copy the complete active key and try again.'
    )
  }
  if (status === 403) {
    return new RunPodConnectionError(
      'insufficient-permissions',
      'The key is valid but does not allow this Pod action. Update its RunPod permissions and try again.'
    )
  }
  if (status === 404) {
    return new RunPodConnectionError(
      'invalid-response',
      'RunPod could not find that worker. Refresh the session before trying another action.'
    )
  }
  if (status === 409 || status === 422) {
    return new RunPodConnectionError(
      'invalid-input',
      'RunPod refused this worker configuration. No second worker was created.'
    )
  }
  if (status === 429) {
    return new RunPodConnectionError(
      'rate-limited',
      'RunPod is limiting requests for a moment. The studio will reconcile before retrying.'
    )
  }

  return new RunPodConnectionError(
    'provider-unavailable',
    'RunPod could not complete the request. The studio will reconcile before any retry.'
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export class RunPodClient {
  private readonly restBaseUrl: string
  private readonly catalogBaseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImplementation: typeof fetch

  constructor(options: RunPodClientOptions = {}) {
    this.restBaseUrl = (options.restBaseUrl ?? DEFAULT_REST_BASE_URL).replace(/\/$/, '')
    this.catalogBaseUrl = (options.catalogBaseUrl ?? DEFAULT_CATALOG_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch
  }

  async validateAccount(apiKey: string): Promise<RunPodAccountCheck> {
    const pods = await this.listPods(apiKey)
    const activePods = pods.filter((pod) => ACTIVE_POD_STATES.has(pod.desiredStatus))

    return {
      totalPods: pods.length,
      activePods: activePods.length,
      activeHourlyCostUsd: roundCurrency(
        activePods.reduce((total, pod) => total + pod.hourlyCostUsd, 0)
      )
    }
  }

  async listPods(apiKey: string): Promise<RunPodPod[]> {
    const payload = await this.requestJson(
      this.restBaseUrl,
      '/pods?computeType=GPU',
      apiKey,
      RunPodListPodsResponseSchema,
      { method: 'GET' }
    )
    const list = Array.isArray(payload) ? payload : payload.pods
    return list.map(toPod)
  }

  async getPod(apiKey: string, podId: string): Promise<RunPodPod> {
    const safeId = encodeURIComponent(z.string().min(1).max(191).parse(podId))
    return toPod(
      await this.requestJson(this.restBaseUrl, `/pods/${safeId}`, apiKey, RunPodPodSchema, {
        method: 'GET'
      })
    )
  }

  async findPodByLease(apiKey: string, leaseId: string): Promise<RunPodPod | null> {
    const safeLeaseId = RunPodCreatePodInputSchema.shape.leaseId.parse(leaseId)
    const matches = (await this.listPods(apiKey)).filter(
      (pod) => pod.environment.STUDIO_LEASE_ID === safeLeaseId
    )
    if (matches.length > 1) {
      throw new RunPodConnectionError(
        'invalid-response',
        'RunPod returned more than one worker for this lease. The studio stopped before creating anything.'
      )
    }
    return matches[0] ?? null
  }

  async createPod(apiKey: string, unknownInput: RunPodCreatePodInput): Promise<RunPodPod> {
    const input = RunPodCreatePodInputSchema.parse(unknownInput)
    const existing = await this.findPodByLease(apiKey, input.leaseId)
    if (existing) return existing

    const payload = {
      name: input.name,
      computeType: 'GPU',
      imageName: input.imageName,
      gpuTypeIds: input.gpuTypeIds,
      gpuTypePriority: 'availability',
      gpuCount: input.gpuCount,
      containerDiskInGb: input.containerDiskInGb,
      volumeInGb: input.networkVolumeId ? 0 : input.volumeInGb,
      volumeMountPath: '/workspace',
      ports: input.ports,
      env: { ...input.environment, STUDIO_LEASE_ID: input.leaseId },
      ...(input.networkVolumeId ? { networkVolumeId: input.networkVolumeId } : {}),
      interruptible: input.interruptible,
      locked: false
    }

    try {
      return toPod(
        await this.requestJson(this.restBaseUrl, '/pods', apiKey, RunPodPodSchema, {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      )
    } catch (error) {
      if (
        error instanceof RunPodConnectionError &&
        ['timed-out', 'provider-unavailable', 'rate-limited'].includes(error.code)
      ) {
        const reconciled = await this.findPodByLease(apiKey, input.leaseId).catch(() => null)
        if (reconciled) return reconciled
      }
      throw error
    }
  }

  async stopPod(apiKey: string, podId: string): Promise<RunPodPod> {
    const pod = await this.getPod(apiKey, podId)
    if (pod.hasNetworkVolume) {
      throw new RunPodConnectionError(
        'invalid-input',
        'This worker uses a network volume and cannot be stopped. Download results, then terminate it to end GPU charges.'
      )
    }
    if (pod.desiredStatus !== 'RUNNING') return pod
    return this.mutatePod(apiKey, pod.id, 'stop')
  }

  async startPod(apiKey: string, podId: string): Promise<RunPodPod> {
    const pod = await this.getPod(apiKey, podId)
    if (pod.desiredStatus === 'RUNNING') return pod
    return this.mutatePod(apiKey, pod.id, 'start')
  }

  async terminatePod(apiKey: string, podId: string): Promise<void> {
    const safeId = encodeURIComponent(z.string().min(1).max(191).parse(podId))
    await this.requestNoContent(this.restBaseUrl, `/pods/${safeId}`, apiKey, { method: 'DELETE' })
  }

  async listGpuOptions(apiKey: string): Promise<CloudGpuOption[]> {
    const payload = await this.requestJson(
      this.catalogBaseUrl,
      '/catalog/gpus',
      apiKey,
      RunPodGpuCatalogSchema,
      { method: 'GET' }
    )

    const candidates = payload.gpus
      .map((gpu) => RunPodGpuCatalogItemSchema.safeParse(gpu))
      .filter((result) => result.success)
      .map((result) => result.data)
      .filter((gpu) => {
        const memory = toCurrency(gpu.memory)
        const isNvidia = gpu.manufacturer === 'NVIDIA' || gpu.id.startsWith('NVIDIA ')
        return isNvidia && (memory >= 32 || gpu.id === 'NVIDIA GeForce RTX 4090')
      })
      .map((gpu) =>
        CloudGpuOptionSchema.parse({
          id: gpu.id,
          name: gpu.name ?? gpu.id.replace(/^NVIDIA\s+/, ''),
          memoryGb: toCurrency(gpu.memory),
          secureHourlyUsd: nullableCurrency(gpu.price.secure),
          communityHourlyUsd: nullableCurrency(gpu.price.community),
          ltxCompatibility: toCurrency(gpu.memory) >= 32 ? 'meets-baseline' : 'below-baseline'
        })
      )
      .sort((left, right) => {
        if (left.ltxCompatibility !== right.ltxCompatibility) {
          return left.ltxCompatibility === 'meets-baseline' ? -1 : 1
        }
        return lowestPrice(left) - lowestPrice(right) || left.memoryGb - right.memoryGb
      })

    const compatible = candidates
      .filter((candidate) => candidate.ltxCompatibility === 'meets-baseline')
      .slice(0, 7)
    const rtx4090 = candidates.find((candidate) => candidate.id === 'NVIDIA GeForce RTX 4090')
    const options = rtx4090 ? [...compatible, rtx4090] : compatible
    if (options.length === 0) {
      throw new RunPodConnectionError(
        'invalid-response',
        'RunPod returned no usable GPU planning prices. No paid action was started.'
      )
    }
    return options
  }

  private async mutatePod(
    apiKey: string,
    podId: string,
    action: 'start' | 'stop'
  ): Promise<RunPodPod> {
    const safeId = encodeURIComponent(z.string().min(1).max(191).parse(podId))
    const payload = await this.requestJson(
      this.restBaseUrl,
      `/pods/${safeId}/${action}`,
      apiKey,
      z.union([RunPodPodSchema, z.object({}).passthrough()]),
      { method: 'POST' }
    )
    const parsedPod = RunPodPodSchema.safeParse(payload)
    if (parsedPod.success) return toPod(parsedPod.data)
    return this.getPod(apiKey, podId)
  }

  private async requestJson<T>(
    baseUrl: string,
    path: string,
    apiKey: string,
    schema: z.ZodType<T>,
    init: RequestInit
  ): Promise<T> {
    const response = await this.request(baseUrl, path, apiKey, init)
    try {
      return schema.parse(await response.json())
    } catch {
      throw new RunPodConnectionError(
        'invalid-response',
        'RunPod returned an unexpected response. The studio stopped before another paid action.'
      )
    }
  }

  private async requestNoContent(
    baseUrl: string,
    path: string,
    apiKey: string,
    init: RequestInit
  ): Promise<void> {
    await this.request(baseUrl, path, apiKey, init)
  }

  private async request(
    baseUrl: string,
    path: string,
    apiKey: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {})
        },
        signal: controller.signal,
        redirect: 'error'
      })
      if (!response.ok) throw mapHttpError(response.status)
      return response
    } catch (error) {
      if (error instanceof RunPodConnectionError) throw error
      if (isAbortError(error) || controller.signal.aborted) {
        throw new RunPodConnectionError(
          'timed-out',
          'The RunPod request timed out. The studio will reconcile before any retry.'
        )
      }
      throw new RunPodConnectionError(
        'provider-unavailable',
        'RunPod could not be reached. The studio will reconcile before any retry.'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

import { z } from 'zod'
import { CloudGpuOptionSchema, type CloudErrorCode, type CloudGpuOption } from '@studio/contracts'

const DEFAULT_BASE_URL = 'https://api.runpod.io/v2'
const DEFAULT_TIMEOUT_MS = 12_000
const ACTIVE_POD_STATES = new Set(['PROVISIONING', 'STARTING', 'RUNNING'])

const RunPodListPodsResponseSchema = z
  .object({
    pods: z.array(
      z
        .object({
          status: z.string(),
          cost: z.number().nonnegative().catch(0)
        })
        .passthrough()
    )
  })
  .passthrough()

const NullablePriceSchema = z.number().nonnegative().nullable().optional()

const RunPodGpuCatalogSchema = z
  .object({
    gpus: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          manufacturer: z.string(),
          memory: z.number().int().positive(),
          price: z
            .object({
              secure: NullablePriceSchema,
              community: NullablePriceSchema
            })
            .passthrough()
        })
        .passthrough()
    )
  })
  .passthrough()

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
  baseUrl?: string
  timeoutMs?: number
  fetchImplementation?: typeof fetch
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
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
      'The key is valid but cannot read Pods. Allow read access to Pods for this key in RunPod.'
    )
  }
  if (status === 429) {
    return new RunPodConnectionError(
      'rate-limited',
      'RunPod is limiting connection checks for a moment. Wait a minute, then try again.'
    )
  }

  return new RunPodConnectionError(
    'provider-unavailable',
    'RunPod could not complete the check. No GPU was created; try again shortly.'
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export class RunPodClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImplementation: typeof fetch

  constructor(options: RunPodClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch
  }

  async validateAccount(apiKey: string): Promise<RunPodAccountCheck> {
    const payload = RunPodListPodsResponseSchema.parse(
      await this.requestJson('/pods', apiKey, RunPodListPodsResponseSchema)
    )
    const activePods = payload.pods.filter((pod) => ACTIVE_POD_STATES.has(pod.status))

    return {
      totalPods: payload.pods.length,
      activePods: activePods.length,
      activeHourlyCostUsd: roundCurrency(activePods.reduce((total, pod) => total + pod.cost, 0))
    }
  }

  async listGpuOptions(apiKey: string): Promise<CloudGpuOption[]> {
    const payload = RunPodGpuCatalogSchema.parse(
      await this.requestJson('/catalog/gpus', apiKey, RunPodGpuCatalogSchema)
    )

    const candidates = payload.gpus
      .filter(
        (gpu) =>
          gpu.manufacturer === 'NVIDIA' &&
          (gpu.memory >= 32 || gpu.id === 'NVIDIA GeForce RTX 4090')
      )
      .map((gpu) =>
        CloudGpuOptionSchema.parse({
          id: gpu.id,
          name: gpu.name,
          memoryGb: gpu.memory,
          secureHourlyUsd: gpu.price.secure ?? null,
          communityHourlyUsd: gpu.price.community ?? null,
          ltxCompatibility: gpu.memory >= 32 ? 'meets-baseline' : 'below-baseline'
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

    return rtx4090 ? [...compatible, rtx4090] : compatible
  }

  private async requestJson<T>(path: string, apiKey: string, schema: z.ZodType<T>): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        redirect: 'error'
      })

      if (!response.ok) {
        throw mapHttpError(response.status)
      }

      try {
        return schema.parse(await response.json())
      } catch {
        throw new RunPodConnectionError(
          'invalid-response',
          'RunPod returned an unexpected response. The key was not changed and no GPU was created.'
        )
      }
    } catch (error) {
      if (error instanceof RunPodConnectionError) {
        throw error
      }
      if (isAbortError(error) || controller.signal.aborted) {
        throw new RunPodConnectionError(
          'timed-out',
          'The RunPod check timed out. No GPU was created; check your connection and try again.'
        )
      }
      throw new RunPodConnectionError(
        'provider-unavailable',
        'RunPod could not be reached. No GPU was created; check your internet connection and try again.'
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

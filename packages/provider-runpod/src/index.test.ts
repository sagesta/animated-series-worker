import { describe, expect, it, vi } from 'vitest'
import { RunPodClient, RunPodConnectionError } from './index'

const secret = 'rpa_super_secret_value_that_must_never_leak'
const leaseId = '01ARZ3NDEKTSV4RRFFQ69G5FAV'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function pod(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pod-one',
    name: 'Studio worker',
    desiredStatus: 'RUNNING',
    costPerHr: '0.74',
    adjustedCostPerHr: 0.69,
    publicIp: '198.51.100.4',
    portMappings: { '8000': 32000 },
    env: {},
    image: 'registry.example/studio-worker@sha256:abc',
    gpu: { id: 'NVIDIA A100-SXM4-80GB', count: 1, displayName: 'A100 SXM' },
    ...overrides
  }
}

describe('RunPod REST lifecycle client', () => {
  it('validates with an official REST list call and reports existing active cost', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse([
          pod(),
          pod({ id: 'pod-two', desiredStatus: 'EXITED', adjustedCostPerHr: 1.2 }),
          pod({ id: 'pod-three', desiredStatus: 'TERMINATED', adjustedCostPerHr: 0 })
        ])
      )
    const client = new RunPodClient({ fetchImplementation })

    await expect(client.validateAccount(secret)).resolves.toEqual({
      totalPods: 3,
      activePods: 1,
      activeHourlyCostUsd: 0.69
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://rest.runpod.io/v1/pods?computeType=GPU',
      expect.objectContaining({ method: 'GET' })
    )
    expect(fetchImplementation.mock.calls[0]?.[1]?.body).toBeUndefined()
  })

  it('returns current GPU prices and marks the 24GB 4090 below the LTX baseline', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        gpus: [
          {
            id: 'NVIDIA GeForce RTX 4090',
            name: 'RTX 4090',
            manufacturer: 'NVIDIA',
            memory: 24,
            price: { secure: 0.44, community: 0.31 }
          },
          {
            id: 'NVIDIA A100-SXM4-80GB',
            name: 'A100 SXM',
            manufacturer: 'NVIDIA',
            memory: 80,
            price: { secure: 1.89, community: 1.39 }
          }
        ]
      })
    )
    const client = new RunPodClient({ fetchImplementation })

    await expect(client.listGpuOptions(secret)).resolves.toEqual([
      expect.objectContaining({ name: 'A100 SXM', ltxCompatibility: 'meets-baseline' }),
      expect.objectContaining({ name: 'RTX 4090', ltxCompatibility: 'below-baseline' })
    ])
  })

  it('reuses a matching lease instead of creating a duplicate Pod', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([pod({ env: { STUDIO_LEASE_ID: leaseId } })]))
    const client = new RunPodClient({ fetchImplementation })

    await expect(
      client.createPod(secret, {
        leaseId,
        name: 'Studio worker',
        imageName: 'registry.example/studio-worker@sha256:abc',
        gpuTypeIds: ['NVIDIA A100-SXM4-80GB'],
        gpuCount: 1,
        containerDiskInGb: 80,
        volumeInGb: 150,
        ports: ['8000/http'],
        environment: { STUDIO_HARD_DEADLINE: '2026-08-22T18:00:00.000Z' },
        interruptible: false
      })
    ).resolves.toMatchObject({ id: 'pod-one' })
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    expect(fetchImplementation).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('creates only after reconciliation and sends the lease marker in the protected body', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(pod({ env: { STUDIO_LEASE_ID: leaseId } })))
    const client = new RunPodClient({ fetchImplementation })

    await client.createPod(secret, {
      leaseId,
      name: 'Studio worker',
      imageName: 'registry.example/studio-worker@sha256:abc',
      gpuTypeIds: ['NVIDIA A100-SXM4-80GB'],
      gpuCount: 1,
      containerDiskInGb: 80,
      volumeInGb: 150,
      ports: ['8000/http'],
      environment: { STUDIO_GATEWAY_TOKEN_HASH: 'abc' },
      interruptible: false
    })

    const createInit = fetchImplementation.mock.calls[1]?.[1]
    expect(fetchImplementation.mock.calls[1]?.[0]).toBe('https://rest.runpod.io/v1/pods')
    expect(createInit?.method).toBe('POST')
    expect(JSON.parse(String(createInit?.body))).toMatchObject({
      env: { STUDIO_LEASE_ID: leaseId, STUDIO_GATEWAY_TOKEN_HASH: 'abc' },
      locked: false,
      ports: ['8000/http']
    })
  })

  it('blocks stop for network-volume Pods and explains termination', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse(pod({ networkVolume: { id: 'volume-one', name: 'models', size: 200 } }))
      )
    const client = new RunPodClient({ fetchImplementation })

    const error = await client.stopPod(secret, 'pod-one').catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'invalid-input' })
    expect(String(error)).toContain('terminate')
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
  })

  it('uses the official delete route for termination', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    const client = new RunPodClient({ fetchImplementation })

    await client.terminatePod(secret, 'pod-one')
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://rest.runpod.io/v1/pods/pod-one',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it.each([
    [401, 'invalid-key'],
    [403, 'insufficient-permissions'],
    [429, 'rate-limited'],
    [503, 'provider-unavailable']
  ] as const)('maps HTTP %s to a safe %s error without exposing the key', async (status, code) => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, status))
    const client = new RunPodClient({ fetchImplementation })

    const error = await client.validateAccount(secret).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(RunPodConnectionError)
    expect(error).toMatchObject({ code })
    expect(String(error)).not.toContain(secret)
  })

  it('times out safely and does not expose the key', async () => {
    const fetchImplementation = vi.fn<typeof fetch>((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        )
      })
    })
    const client = new RunPodClient({ fetchImplementation, timeoutMs: 5 })

    const error = await client.validateAccount(secret).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'timed-out' })
    expect(String(error)).not.toContain(secret)
  })
})

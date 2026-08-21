import { describe, expect, it, vi } from 'vitest'
import { RunPodClient, RunPodConnectionError } from './index'

const secret = 'rpa_super_secret_value_that_must_never_leak'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('RunPod API v2 client', () => {
  it('validates with a read-only list call and reports existing active cost', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        pods: [
          { id: 'one', status: 'RUNNING', cost: 0.74 },
          { id: 'two', status: 'STARTING', cost: 1.2 },
          { id: 'three', status: 'EXITED', cost: 0 }
        ]
      })
    )
    const client = new RunPodClient({ fetchImplementation })

    await expect(client.validateAccount(secret)).resolves.toEqual({
      totalPods: 3,
      activePods: 2,
      activeHourlyCostUsd: 1.94
    })
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://api.runpod.io/v2/pods',
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

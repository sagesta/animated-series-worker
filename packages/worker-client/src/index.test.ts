import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkerClient, WorkerClientError, createWorkerToken } from './index'

const token = 'a'.repeat(43)
const roots: string[] = []

function temporaryRoot(): string {
  const value = mkdtempSync(join(tmpdir(), 'studio-worker-client-'))
  roots.push(value)
  return value
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('authenticated worker client', () => {
  it('creates a random token and stores only its one-way hash in cloud configuration', () => {
    const one = createWorkerToken()
    const two = createWorkerToken()
    expect(one.token).not.toBe(two.token)
    expect(one.sha256).toBe(createHash('sha256').update(one.token).digest('hex'))
    expect(one.sha256).not.toContain(one.token)
  })

  it('requires HTTPS except for an explicit loopback development worker', () => {
    expect(() => new WorkerClient({ baseUrl: 'http://worker.example', token })).toThrow('HTTPS')
    expect(() => new WorkerClient({ baseUrl: 'http://127.0.0.1:8000', token })).not.toThrow()
  })

  it('sends the token in a header and never in the URL', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        status: 'ready',
        release: '0.9.0',
        leaseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        hardDeadline: '2026-08-22T18:00:00.000Z',
        comfyUi: 'ready',
        activeJobs: 0,
        secondsUntilHardStop: 120,
        secondsUntilIdleStop: 60
      })
    )
    const client = new WorkerClient({
      baseUrl: 'https://198.51.100.4:32000',
      token,
      fetchImplementation
    })
    await client.getHealth()
    const [url, init] = fetchImplementation.mock.calls[0] ?? []
    expect(String(url)).not.toContain(token)
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`)
  })

  it('rejects an input whose local hash changed before upload', async () => {
    const client = new WorkerClient({
      baseUrl: 'https://worker.example',
      token,
      fetchImplementation: vi.fn<typeof fetch>()
    })
    const error = await client
      .uploadAsset({
        jobId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        assetId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        fileName: 'frame.png',
        sha256: 'b'.repeat(64),
        bytes: new Uint8Array([1, 2, 3])
      })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(WorkerClientError)
    expect(error).toMatchObject({ code: 'integrity-failed' })
  })

  it('uploads a large file in bounded sequential chunks with matching receipts', async () => {
    const directory = temporaryRoot()
    const sourcePath = join(directory, 'large-input.bin')
    const chunkBytes = 1024
    const bytes = Buffer.alloc(chunkBytes + 7, 17)
    writeFileSync(sourcePath, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const ranges: string[] = []
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const headers = init?.headers as Record<string, string>
      const range = headers['Content-Range']
      ranges.push(range)
      for await (const chunk of init?.body as unknown as AsyncIterable<Uint8Array>) {
        // Drain the file stream so the test exercises the complete upload lifecycle.
        expect(chunk.byteLength).toBeGreaterThan(0)
      }
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range)
      if (!match) throw new Error('missing test range')
      const end = Number(match[2])
      const total = Number(match[3])
      return response(
        {
          ok: true,
          complete: end + 1 === total,
          nextOffset: end + 1,
          byteSize: total,
          sha256
        },
        end + 1 === total ? 201 : 202
      )
    })
    const client = new WorkerClient({
      baseUrl: 'https://worker.example',
      token,
      fetchImplementation,
      transferChunkBytes: chunkBytes
    })
    await client.uploadAssetFromPath({
      jobId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      assetId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      fileName: 'large-input.bin',
      sha256,
      sourcePath,
      byteSize: bytes.byteLength
    })
    expect(ranges).toEqual([
      `bytes 0-${chunkBytes - 1}/${bytes.byteLength}`,
      `bytes ${chunkBytes}-${bytes.byteLength - 1}/${bytes.byteLength}`
    ])
  })

  it('downloads a large artifact in bounded ranges and verifies the final hash', async () => {
    const directory = temporaryRoot()
    const destination = join(directory, 'download.bin')
    const chunkBytes = 1024
    const bytes = Buffer.alloc(chunkBytes + 11, 29)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const ranges: string[] = []
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const range = (init?.headers as Record<string, string>).Range
      ranges.push(range)
      const match = /^bytes=(\d+)-(\d+)$/.exec(range)
      if (!match) throw new Error('missing test range')
      const start = Number(match[1])
      const end = Number(match[2])
      const chunk = bytes.subarray(start, end + 1)
      return new Response(chunk, {
        status: 206,
        headers: {
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`
        }
      })
    })
    const client = new WorkerClient({
      baseUrl: 'https://worker.example',
      token,
      fetchImplementation,
      transferChunkBytes: chunkBytes
    })
    await client.downloadArtifact(
      {
        name: 'download.bin',
        mimeType: 'application/octet-stream',
        byteSize: bytes.byteLength,
        sha256,
        downloadPath: '/v1/artifacts/01ARZ3NDEKTSV4RRFFQ69G5FAV/download.bin'
      },
      destination
    )
    expect(readFileSync(destination)).toEqual(bytes)
    expect(ranges).toHaveLength(2)
  })
})

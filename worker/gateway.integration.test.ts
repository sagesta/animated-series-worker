import { createHash } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const children: ChildProcess[] = []

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studio-gateway-integration-'))
  roots.push(root)
  return root
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('No test port.'))
      server.close((error) => (error ? reject(error) : resolvePort(address.port)))
    })
  })
}

async function waitForGateway(url: string, token: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Gateway exited before startup (${child.exitCode}).`)
    try {
      const response = await fetch(`${url}/v1/health`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) return
    } catch {
      // Startup polling is bounded by the deadline below.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
  }
  throw new Error('Gateway did not become reachable before the test deadline.')
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null) child.kill()
    await new Promise((resolveExit) => {
      if (child.exitCode !== null) return resolveExit(undefined)
      child.once('exit', resolveExit)
      setTimeout(resolveExit, 2_000)
    })
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('GPU worker gateway boundary', () => {
  it('requires the raw bearer token while receiving only its hash at startup', async () => {
    const root = temporaryRoot()
    const port = await availablePort()
    const token = 'test_gateway_token_abcdefghijklmnopqrstuvwxyz1234'
    const packPath = join(root, 'workflow-pack.json')
    writeFileSync(packPath, JSON.stringify({ workflows: [] }))
    const child = spawn(process.execPath, [resolve(process.cwd(), 'worker', 'gateway.mjs')], {
      env: {
        ...process.env,
        STUDIO_GATEWAY_PORT: String(port),
        STUDIO_GATEWAY_TOKEN_HASH: createHash('sha256').update(token).digest('hex'),
        STUDIO_LEASE_ID: '01K37Q0Z000000000000000001',
        STUDIO_HARD_DEADLINE: new Date(Date.now() + 300_000).toISOString(),
        STUDIO_JOB_ROOT: join(root, 'jobs'),
        STUDIO_COMFY_INPUT_ROOT: join(root, 'comfy-input'),
        STUDIO_COMFY_OUTPUT_ROOT: join(root, 'comfy-output'),
        STUDIO_WORKFLOW_PACK: packPath,
        STUDIO_CAPABILITY_REPORT: join(root, 'missing-capability.json')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    children.push(child)
    const url = `http://127.0.0.1:${port}`
    await waitForGateway(url, token, child)

    const missing = await fetch(`${url}/v1/health`)
    expect(missing.status).toBe(401)
    expect(await missing.text()).not.toContain(token)

    const wrong = await fetch(`${url}/v1/health`, {
      headers: { Authorization: 'Bearer wrong_token_abcdefghijklmnopqrstuvwxyz1234' }
    })
    expect(wrong.status).toBe(401)

    const valid = await fetch(`${url}/v1/health`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(valid.status).toBe(200)
    expect(await valid.json()).toMatchObject({
      status: 'starting',
      leaseId: '01K37Q0Z000000000000000001',
      activeJobs: 0
    })

    const query = await fetch(`${url}/v1/health?debug=true`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(query.status).toBe(400)
  })

  it('fails a hash-locked graph containing a node outside its allowlist', async () => {
    const root = temporaryRoot()
    const port = await availablePort()
    const token = 'test_gateway_token_abcdefghijklmnopqrstuvwxyz5678'
    const workflowDirectory = join(root, 'workflows')
    mkdirSync(workflowDirectory)
    const templatePath = join(workflowDirectory, 'unsafe.api.json')
    const template = `${JSON.stringify({ '1': { class_type: 'ExecuteAnything', inputs: {} } }, null, 2)}\n`
    writeFileSync(templatePath, template)
    const packPath = join(root, 'workflow-pack.json')
    writeFileSync(
      packPath,
      JSON.stringify({
        workflows: [
          {
            workflowId: 'allowlist-fixture',
            version: '1.0.0',
            engine: 'comfyui',
            qualificationState: 'qualified',
            maximumRuntimeMinutes: 1,
            templatePath: 'workflows/unsafe.api.json',
            templateSha256: createHash('sha256').update(template).digest('hex'),
            allowedNodeTypes: ['SaveImage'],
            requiredModels: [],
            parameters: []
          }
        ]
      })
    )
    const child = spawn(process.execPath, [resolve(process.cwd(), 'worker', 'gateway.mjs')], {
      env: {
        ...process.env,
        STUDIO_GATEWAY_PORT: String(port),
        STUDIO_GATEWAY_TOKEN_HASH: createHash('sha256').update(token).digest('hex'),
        STUDIO_LEASE_ID: '01K37Q0Z000000000000000002',
        STUDIO_HARD_DEADLINE: new Date(Date.now() + 300_000).toISOString(),
        STUDIO_JOB_ROOT: join(root, 'jobs'),
        STUDIO_COMFY_INPUT_ROOT: join(root, 'comfy-input'),
        STUDIO_COMFY_OUTPUT_ROOT: join(root, 'comfy-output'),
        STUDIO_WORKFLOW_PACK: packPath,
        STUDIO_CAPABILITY_REPORT: join(root, 'missing-capability.json')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    children.push(child)
    const url = `http://127.0.0.1:${port}`
    await waitForGateway(url, token, child)
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
    const jobId = '01K37Q0Z000000000000000003'
    const queued = await fetch(`${url}/v1/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jobId,
        idempotencyKey: 'a'.repeat(64),
        workflowId: 'allowlist-fixture',
        workflowVersion: '1.0.0',
        parameters: {},
        inputAssets: []
      })
    })
    expect(queued.status).toBe(202)

    let state = 'queued'
    for (let attempt = 0; attempt < 30 && state !== 'failed'; attempt += 1) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50))
      const response = await fetch(`${url}/v1/jobs/${jobId}`, { headers })
      state = String((await response.json()).state)
    }
    expect(state).toBe('failed')
  })
})

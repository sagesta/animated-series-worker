/* eslint-disable @typescript-eslint/no-require-imports -- Electron launches this maintainer controller as CommonJS. */
const { app, safeStorage } = require('electron')
const { createHash, randomBytes, randomUUID } = require('node:crypto')
const { spawn } = require('node:child_process')
const { access, mkdir, readFile, rename, unlink, writeFile } = require('node:fs/promises')
const { dirname, join, resolve } = require('node:path')

const ACTION = process.argv[2] || 'status'
const PROJECT_ROOT = resolve(__dirname, '..')
const STATE_PATH = join(PROJECT_ROOT, 'qualification', 'live-runpod-qualification.json')
const IMAGE_DIGEST = '3b1142ede47d387a890b36e7e5e0ae212c3f2304387e128f4f7991ad5c33b0e9'
const IMAGE_NAME = `ghcr.io/sagesta/animated-series-worker@sha256:${IMAGE_DIGEST}`
const WORKER_RELEASE = '0.10.1-candidate.5'
const GPU_TYPE_ID = 'NVIDIA L40S'
const MAX_HOURLY_RATE_USD = 0.99
const MAX_RUNTIME_MINUTES = 115
const MAX_APPROVED_COST_USD = 2.06
const CONTAINER_DISK_GB = 50
const POD_VOLUME_GB = 350
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

app.setName('animated-series-studio')

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function leaseId() {
  return [...randomBytes(26)].map((value) => CROCKFORD[value & 31]).join('')
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, contents, { flag: 'wx', mode: 0o600 })
  await rename(temporary, path)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeJson(path, value) {
  await atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function decrypt(path) {
  if (!safeStorage.isAsyncEncryptionAvailable()) {
    throw new Error('Windows protected storage is unavailable.')
  }
  return (await safeStorage.decryptStringAsync(await readFile(path))).result
}

async function protectedContext() {
  const userDataRoot = app.getPath('userData')
  const apiKeyPath = join(userDataRoot, 'secure', 'runpod-api-key.bin')
  const tokenMapPath = join(userDataRoot, 'secure', 'worker-session-tokens.bin')
  return { userDataRoot, apiKeyPath, tokenMapPath, apiKey: await decrypt(apiKeyPath) }
}

async function readTokenMap(path) {
  if (!(await exists(path))) return {}
  const parsed = JSON.parse(await decrypt(path))
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('The protected worker token store is invalid.')
  }
  return parsed
}

async function writeTokenMap(path, values) {
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(values))
  await atomicWrite(path, encrypted)
}

async function storeToken(path, id, token) {
  const values = await readTokenMap(path)
  values[id] = token
  await writeTokenMap(path, values)
}

async function removeToken(path, id) {
  const values = await readTokenMap(path)
  delete values[id]
  if (Object.keys(values).length === 0) {
    if (await exists(path)) await unlink(path)
    return
  }
  await writeTokenMap(path, values)
}

async function runPod(path, apiKey, init = {}) {
  const response = await fetch(`https://rest.runpod.io/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) {
    let detail = ''
    try {
      const payload = JSON.parse(await response.text())
      detail = String(payload.error?.message ?? payload.error ?? payload.message ?? '')
        .replace(/\b(?:rpa|hf)_[A-Za-z0-9_-]+\b/g, '[redacted]')
        .slice(0, 500)
    } catch {
      // Provider error bodies are optional and never required for reconciliation.
    }
    throw new Error(
      `RunPod request failed with status ${response.status}${detail ? `: ${detail}` : ''}.`
    )
  }
  if (response.status === 204) return null
  return response.json()
}

async function listPods(apiKey) {
  const payload = await runPod('/pods?computeType=GPU', apiKey)
  return Array.isArray(payload) ? payload : payload.pods
}

async function gpuOption(apiKey) {
  const response = await fetch('https://api.runpod.io/v2/catalog/gpus', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`RunPod catalogue failed with status ${response.status}.`)
  const payload = await response.json()
  return payload.gpus.find((gpu) => gpu.id === GPU_TYPE_ID)
}

async function podRuntime(apiKey, podId) {
  const response = await fetch(`https://api.runpod.io/graphql?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query:
        `query { pod(input: { podId: "${podId}" }) { runtime { uptimeInSeconds gpus { id gpuUtilPercent memoryUtilPercent } container { cpuPercent memoryPercent } } } }`
    }),
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) return null
  const payload = await response.json()
  return payload.data?.pod?.runtime ?? null
}

function coreModelIds() {
  const pack = require(join(PROJECT_ROOT, 'config', 'workflow-pack.candidate.json'))
  const policy = require(join(PROJECT_ROOT, 'config', 'core-promotion-policy.json'))
  const manifest = require(join(PROJECT_ROOT, 'config', 'model-install-manifest.candidate.json'))
  const review = require(join(PROJECT_ROOT, 'config', 'model-license-review.candidate.json'))
  const excluded = new Set(policy.excludedWorkflowIds)
  const ids = new Set()
  for (const workflow of pack.workflows) {
    if (workflow.qualificationTier === 'advanced' || excluded.has(workflow.workflowId)) continue
    for (const model of workflow.requiredModels || []) ids.add(model.modelId)
  }
  const sorted = [...ids].sort()
  for (const id of sorted) {
    const model = manifest.models.find((candidate) => candidate.modelId === id)
    const source = review.sources.find(
      (candidate) =>
        candidate.manifestSource === true &&
        candidate.repository === model?.repository &&
        candidate.revision === model?.revision
    )
    if (!model || source?.decision?.status !== 'accepted') {
      throw new Error(`Qualification license is not accepted for ${id}.`)
    }
  }
  return { ids: sorted, pack }
}

function sanitizePod(pod) {
  return {
    id: pod.id,
    name: pod.name,
    desiredStatus: pod.desiredStatus,
    hourlyCostUsd: Number(pod.adjustedCostPerHr ?? pod.costPerHr ?? 0),
    image: pod.image,
    gpuTypeId: pod.gpu?.id ?? pod.machine?.gpuTypeId ?? null,
    gpuCount: pod.gpu?.count ?? 0,
    containerDiskGb: Number(pod.containerDiskInGb ?? 0),
    podVolumeGb: Number(pod.volumeInGb ?? 0),
    lastStartedAt: pod.lastStartedAt ?? null,
    lastStatusChange: pod.lastStatusChange ?? null
  }
}

async function createQualification() {
  if (await exists(STATE_PATH)) throw new Error('A live qualification state file already exists.')
  const context = await protectedContext()
  const active = (await listPods(context.apiKey)).filter((pod) => pod.desiredStatus === 'RUNNING')
  if (active.length !== 0) throw new Error('RunPod already has an active Pod; nothing was created.')
  const option = await gpuOption(context.apiKey)
  const secureRate = Number(option?.price?.secure)
  if (!option || Number(option.memory) !== 48 || !Number.isFinite(secureRate)) {
    throw new Error('The approved Secure Cloud L40S 48 GB option is unavailable.')
  }
  if (secureRate > MAX_HOURLY_RATE_USD) {
    throw new Error(
      `The L40S rate increased to $${secureRate.toFixed(2)}/hr; nothing was created.`
    )
  }

  const { ids } = coreModelIds()
  const id = leaseId()
  const token = randomBytes(32).toString('base64url')
  const createdAt = new Date()
  const deadline = new Date(createdAt.getTime() + MAX_RUNTIME_MINUTES * 60_000)
  await storeToken(context.tokenMapPath, id, token)
  let pod
  try {
    pod = await runPod('/pods', context.apiKey, {
      method: 'POST',
      body: JSON.stringify({
        name: `Animated Studio core qualification ${id.slice(-6)}`,
        cloudType: 'SECURE',
        computeType: 'GPU',
        imageName: IMAGE_NAME,
        gpuTypeIds: [GPU_TYPE_ID],
        gpuTypePriority: 'availability',
        gpuCount: 1,
        containerDiskInGb: CONTAINER_DISK_GB,
        volumeInGb: POD_VOLUME_GB,
        volumeMountPath: '/workspace',
        ports: ['8000/http'],
        env: {
          STUDIO_GATEWAY_TOKEN_HASH: tokenHash(token),
          STUDIO_LEASE_ID: id,
          STUDIO_HARD_DEADLINE: deadline.toISOString(),
          STUDIO_WORKER_IMAGE_DIGEST: IMAGE_DIGEST,
          STUDIO_WORKER_RELEASE: WORKER_RELEASE,
          STUDIO_MODEL_BOOTSTRAP_MODE: 'qualification',
          STUDIO_QUALIFICATION_MODE: 'controlled',
          STUDIO_REQUIRED_MODEL_IDS: ids.join(','),
          STUDIO_ACCEPTED_MODEL_LICENSES: ids.join(','),
          HF_TOKEN: '{{ RUNPOD_SECRET_huggingface_token }}',
          HF_HUB_OFFLINE: '0',
          TRANSFORMERS_OFFLINE: '0',
          STUDIO_IDLE_TIMEOUT_MINUTES: '10'
        },
        globalNetworking: true,
        supportPublicIp: false,
        interruptible: false,
        locked: false
      })
    })
  } catch (error) {
    await removeToken(context.tokenMapPath, id)
    throw error
  }

  let assignedPod = pod
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const assignedGpu = assignedPod.gpu?.id ?? assignedPod.machine?.gpuTypeId
    const assignedCount = Number(assignedPod.gpu?.count ?? 0)
    const assignedRate = Number(assignedPod.adjustedCostPerHr ?? assignedPod.costPerHr ?? 0)
    if (
      assignedGpu === GPU_TYPE_ID &&
      assignedCount === 1 &&
      assignedRate > 0 &&
      assignedRate <= MAX_HOURLY_RATE_USD
    ) {
      break
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3_000))
    assignedPod = await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey)
  }
  const actualRate = Number(assignedPod.adjustedCostPerHr ?? assignedPod.costPerHr ?? 0)
  const actualGpu = assignedPod.gpu?.id ?? assignedPod.machine?.gpuTypeId
  if (
    actualGpu !== GPU_TYPE_ID ||
    Number(assignedPod.gpu?.count ?? 0) !== 1 ||
    actualRate <= 0 ||
    actualRate > MAX_HOURLY_RATE_USD
  ) {
    await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, { method: 'DELETE' }).catch(
      () => null
    )
    await removeToken(context.tokenMapPath, id)
    throw new Error('RunPod created a worker outside the approved GPU/rate bounds; it was terminated.')
  }

  const state = {
    schemaVersion: 1,
    qualificationId: id,
    pod: sanitizePod(assignedPod),
    imageName: IMAGE_NAME,
    imageDigest: IMAGE_DIGEST,
    storage: {
      containerDiskGb: CONTAINER_DISK_GB,
      podVolumeGb: POD_VOLUME_GB,
      persistentAfterTermination: false
    },
    approvedMaximumHourlyRateUsd: MAX_HOURLY_RATE_USD,
    approvedMaximumRuntimeMinutes: MAX_RUNTIME_MINUTES,
    approvedMaximumCostUsd: MAX_APPROVED_COST_USD,
    createdAt: createdAt.toISOString(),
    hardDeadline: deadline.toISOString(),
    controllerStatus: 'monitoring'
  }
  await writeJson(STATE_PATH, state)

  const childEnvironment = { ...process.env }
  delete childEnvironment.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, [__filename, 'monitor'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: childEnvironment
  }).unref()
  return state
}

async function status() {
  const state = await readJson(STATE_PATH)
  const context = await protectedContext()
  const pods = await listPods(context.apiKey)
  const pod = pods.find((candidate) => candidate.id === state.pod.id) || null
  const runtime = pod?.desiredStatus === 'RUNNING' ? await podRuntime(context.apiKey, pod.id) : null
  const tokenMap = await readTokenMap(context.tokenMapPath)
  let gateway = { ready: false }
  if (pod?.desiredStatus === 'RUNNING' && tokenMap[state.qualificationId]) {
    try {
      const response = await fetch(`https://${pod.id}-8000.proxy.runpod.net/v1/capabilities`, {
        headers: { Authorization: `Bearer ${tokenMap[state.qualificationId]}` },
        signal: AbortSignal.timeout(15_000)
      })
      if (response.ok) {
        const capability = await response.json()
        gateway = { ready: true, capability }
        await writeJson(join(dirname(STATE_PATH), 'studio-capability.json'), capability)
      } else {
        gateway = { ready: false, status: response.status }
      }
    } catch {
      gateway = { ready: false }
    }
  }
  return {
    ...state,
    pod: pod ? sanitizePod(pod) : null,
    runtime: runtime
      ? {
          uptimeSeconds: Number(runtime.uptimeInSeconds ?? 0),
          gpuCount: Array.isArray(runtime.gpus) ? runtime.gpus.length : 0,
          gpuUtilPercent: Number(runtime.gpus?.[0]?.gpuUtilPercent ?? 0),
          gpuMemoryUtilPercent: Number(runtime.gpus?.[0]?.memoryUtilPercent ?? 0),
          containerCpuPercent: Number(runtime.container?.cpuPercent ?? 0),
          containerMemoryPercent: Number(runtime.container?.memoryPercent ?? 0)
        }
      : null,
    gateway: gateway.ready
      ? {
          ready: true,
          gpuName: gateway.capability.gpuName,
          vramGb: gateway.capability.vramGb,
          freeDiskGb: gateway.capability.freeDiskGb,
          smokeTestPassed: gateway.capability.smokeTestPassed,
          modelHashes: Object.keys(gateway.capability.modelHashes || {}).length
        }
      : gateway
  }
}

async function recoverQualification() {
  if (await exists(STATE_PATH)) return readJson(STATE_PATH)
  const context = await protectedContext()
  const pods = (await listPods(context.apiKey)).filter(
    (pod) =>
      pod.desiredStatus === 'RUNNING' &&
      pod.name?.startsWith('Animated Studio core qualification ') &&
      /^[0-9A-HJKMNP-TV-Z]{26}$/.test(pod.env?.STUDIO_LEASE_ID || '')
  )
  if (pods.length !== 1) {
    throw new Error(`Expected one active qualification Pod during recovery; found ${pods.length}.`)
  }
  const pod = pods[0]
  const actualRate = Number(pod.adjustedCostPerHr ?? pod.costPerHr ?? 0)
  if (actualRate <= 0 || actualRate > MAX_HOURLY_RATE_USD) {
    await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, { method: 'DELETE' })
    throw new Error('The recovered Pod exceeded the approved hourly rate and was terminated.')
  }
  const tokens = await readTokenMap(context.tokenMapPath)
  const id = pod.env.STUDIO_LEASE_ID
  if (!tokens[id]) {
    await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, { method: 'DELETE' })
    throw new Error('The recovered Pod had no protected worker token and was terminated.')
  }
  const hardDeadline = new Date(pod.env.STUDIO_HARD_DEADLINE)
  if (!Number.isFinite(hardDeadline.getTime()) || hardDeadline.getTime() <= Date.now()) {
    await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, { method: 'DELETE' })
    await removeToken(context.tokenMapPath, id)
    throw new Error('The recovered Pod deadline was invalid and the Pod was terminated.')
  }
  const state = {
    schemaVersion: 1,
    qualificationId: id,
    pod: sanitizePod(pod),
    imageName: IMAGE_NAME,
    imageDigest: IMAGE_DIGEST,
    storage: {
      containerDiskGb: CONTAINER_DISK_GB,
      podVolumeGb: POD_VOLUME_GB,
      persistentAfterTermination: false
    },
    approvedMaximumHourlyRateUsd: MAX_HOURLY_RATE_USD,
    approvedMaximumRuntimeMinutes: MAX_RUNTIME_MINUTES,
    approvedMaximumCostUsd: MAX_APPROVED_COST_USD,
    createdAt: pod.lastStartedAt ?? new Date().toISOString(),
    hardDeadline: hardDeadline.toISOString(),
    controllerStatus: 'monitoring-recovered'
  }
  await writeJson(STATE_PATH, state)
  const childEnvironment = { ...process.env }
  delete childEnvironment.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, [__filename, 'monitor'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: childEnvironment
  }).unref()
  return state
}

async function terminate(reason = 'operator-request') {
  const state = await readJson(STATE_PATH)
  const context = await protectedContext()
  const pods = await listPods(context.apiKey)
  const pod = pods.find((candidate) => candidate.id === state.pod.id)
  if (pod) await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, { method: 'DELETE' })
  await removeToken(context.tokenMapPath, state.qualificationId)
  state.controllerStatus = 'terminated'
  state.terminatedAt = new Date().toISOString()
  state.terminationReason = reason
  await writeJson(STATE_PATH, state)
  return state
}

async function resizeQualificationStorage() {
  const state = await readJson(STATE_PATH)
  const context = await protectedContext()
  const pods = await listPods(context.apiKey)
  const pod = pods.find((candidate) => candidate.id === state.pod.id)
  if (!pod || pod.desiredStatus !== 'RUNNING') {
    throw new Error('The approved qualification Pod is not running; storage was not changed.')
  }
  const actualRate = Number(pod.adjustedCostPerHr ?? pod.costPerHr ?? 0)
  if (actualRate <= 0 || actualRate > MAX_HOURLY_RATE_USD) {
    throw new Error('The qualification Pod is outside the approved rate; storage was not changed.')
  }
  const createdAt = Date.parse(state.createdAt)
  if (!Number.isFinite(createdAt)) throw new Error('The qualification start time is invalid.')
  const shortenedDeadline = new Date(createdAt + MAX_RUNTIME_MINUTES * 60_000)
  if (shortenedDeadline.getTime() <= Date.now()) {
    throw new Error('The shortened qualification deadline has already elapsed.')
  }
  const updated = await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ volumeInGb: POD_VOLUME_GB })
  })
  state.storage = {
    containerDiskGb: Number(updated.containerDiskInGb ?? CONTAINER_DISK_GB),
    podVolumeGb: Number(updated.volumeInGb ?? POD_VOLUME_GB),
    persistentAfterTermination: false
  }
  state.approvedMaximumRuntimeMinutes = MAX_RUNTIME_MINUTES
  state.hardDeadline = shortenedDeadline.toISOString()
  state.controllerStatus = 'monitoring-storage-corrected'
  await writeJson(STATE_PATH, state)
  return state
}

async function updateQualificationImage() {
  const state = await readJson(STATE_PATH)
  const context = await protectedContext()
  const pods = await listPods(context.apiKey)
  const pod = pods.find((candidate) => candidate.id === state.pod.id)
  if (!pod || pod.desiredStatus !== 'RUNNING') {
    throw new Error('The approved qualification Pod is not running; its image was not changed.')
  }
  const actualRate = Number(pod.adjustedCostPerHr ?? pod.costPerHr ?? 0)
  if (actualRate <= 0 || actualRate > MAX_HOURLY_RATE_USD) {
    throw new Error('The qualification Pod is outside the approved rate; its image was not changed.')
  }
  if (Date.parse(state.hardDeadline) <= Date.now()) {
    throw new Error('The qualification deadline has elapsed; its image was not changed.')
  }
  const updated = await runPod(`/pods/${encodeURIComponent(pod.id)}`, context.apiKey, {
    method: 'PATCH',
    body: JSON.stringify({
      imageName: IMAGE_NAME,
      env: {
        ...(pod.env || {}),
        STUDIO_WORKER_IMAGE_DIGEST: IMAGE_DIGEST,
        STUDIO_WORKER_RELEASE: WORKER_RELEASE
      }
    })
  })
  state.pod = sanitizePod(updated)
  state.imageName = IMAGE_NAME
  state.imageDigest = IMAGE_DIGEST
  state.controllerStatus = 'monitoring-image-corrected'
  state.imageUpdatedAt = new Date().toISOString()
  await writeJson(STATE_PATH, state)
  return state
}

async function startMonitor() {
  const state = await readJson(STATE_PATH)
  const childEnvironment = { ...process.env }
  delete childEnvironment.ELECTRON_RUN_AS_NODE
  spawn(process.execPath, [__filename, 'monitor'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: childEnvironment
  }).unref()
  return state
}

async function monitor() {
  const state = await readJson(STATE_PATH)
  const deadline = Date.parse(state.hardDeadline)
  while (Date.now() < deadline) {
    try {
      const snapshot = await status()
      if (!snapshot.pod || snapshot.pod.desiredStatus !== 'RUNNING') {
        await terminate('provider-worker-not-running')
        return
      }
    } catch {
      // Keep the independent deadline guard alive through transient provider failures.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 30_000))
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await terminate('hard-deadline')
      return
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 30_000))
    }
  }
}

app.whenReady().then(async () => {
  try {
    const result =
      ACTION === 'create'
        ? await createQualification()
        : ACTION === 'recover'
          ? await recoverQualification()
        : ACTION === 'terminate'
          ? await terminate()
        : ACTION === 'resize-storage'
            ? await resizeQualificationStorage()
          : ACTION === 'update-image'
            ? await updateQualificationImage()
          : ACTION === 'start-monitor'
            ? await startMonitor()
          : ACTION === 'monitor'
            ? await monitor()
            : await status()
    if (ACTION !== 'monitor') process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})

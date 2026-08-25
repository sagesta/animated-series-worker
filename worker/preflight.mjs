import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  statfsSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'

const comfyBaseUrl = 'http://127.0.0.1:8188'
const packPath = resolve(
  process.env.STUDIO_WORKFLOW_PACK ?? '/opt/studio/workflow-pack.candidate.json'
)
const reportPath = resolve(
  process.env.STUDIO_CAPABILITY_REPORT ?? '/workspace/studio-capability.json'
)
const modelRoot = resolve(process.env.STUDIO_MODEL_ROOT ?? '/workspace')
const imageDigest = process.env.STUDIO_WORKER_IMAGE_DIGEST ?? ''
const workerRelease = process.env.STUDIO_WORKER_RELEASE ?? 'development'
const SMOKE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAbSURBVBhXY/iwReO/yL59/xm+RgX8F1F2+w8AWtUJdcQQhKwAAAAASUVORK5CYII='

if (!/^[a-f0-9]{64}$/.test(imageDigest))
  throw new Error('A verified worker image digest is required.')
const pack = JSON.parse(readFileSync(packPath, 'utf8'))

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function waitForComfy() {
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${comfyBaseUrl}/system_stats`, { redirect: 'error' })
      if (response.ok) return await response.json()
    } catch {
      // ComfyUI is still loading.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
  }
  throw new Error('ComfyUI did not become ready within five minutes.')
}

async function shaFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function shaPath(path) {
  if (statSync(path).isFile()) return shaFile(path)
  if (!statSync(path).isDirectory()) throw new Error('Model path is not a file or directory.')
  const hash = createHash('sha256')
  async function visit(directory, relativeRoot = '') {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name)
    )) {
      const child = resolve(directory, entry.name)
      const relativeName = `${relativeRoot}${entry.name}`
      if (entry.isDirectory()) {
        hash.update(`directory\0${relativeName}\0`)
        await visit(child, `${relativeName}/`)
      } else if (entry.isFile()) {
        hash.update(`file\0${relativeName}\0${await shaFile(child)}\0`)
      } else {
        throw new Error('Model storage contains an unsupported filesystem entry.')
      }
    }
  }
  await visit(path)
  return hash.digest('hex')
}

async function objectInfo() {
  const response = await fetch(`${comfyBaseUrl}/object_info`, { redirect: 'error' })
  if (!response.ok) throw new Error('ComfyUI node inventory was unavailable.')
  return await response.json()
}

async function runSmokeTest() {
  const inputRoot = resolve(process.env.STUDIO_COMFY_INPUT_ROOT ?? '/opt/ComfyUI/input')
  mkdirSync(inputRoot, { recursive: true })
  const inputName = `studio-smoke-${Date.now()}.png`
  writeFileSync(resolve(inputRoot, inputName), Buffer.from(SMOKE_PNG_BASE64, 'base64'), {
    flag: 'wx'
  })
  const prompt = {
    1: { class_type: 'LoadImage', inputs: { image: inputName, upload: 'image' } },
    2: {
      class_type: 'SaveImage',
      inputs: { images: ['1', 0], filename_prefix: `studio-preflight-${Date.now()}` }
    }
  }
  const queued = await fetch(`${comfyBaseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: 'studio-preflight' }),
    redirect: 'error'
  })
  if (!queued.ok) return false
  const queuedBody = await queued.json()
  if (!queuedBody.prompt_id) return false
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
    const response = await fetch(
      `${comfyBaseUrl}/history/${encodeURIComponent(queuedBody.prompt_id)}`,
      { redirect: 'error' }
    )
    if (!response.ok) continue
    const body = await response.json()
    const history = body[queuedBody.prompt_id]
    if (history?.status?.status_str === 'error') return false
    if (history?.status?.completed) {
      return Object.values(history.outputs ?? {}).some(
        (output) => Array.isArray(output.images) && output.images.length > 0
      )
    }
  }
  return false
}

function command(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 10_000 }).trim()
  } catch {
    return 'unavailable'
  }
}

const systemStats = await waitForComfy()
const nodes = await objectInfo()
const nvidiaDriverVersion = command('nvidia-smi', [
  '--query-gpu=driver_version',
  '--format=csv,noheader'
])
const cudaVersion = command('python', ['-c', 'import torch; print(torch.version.cuda)'])
const modelHashes = {}
const workflowHashes = {}
for (const workflow of pack.workflows) {
  if (workflow.templatePath) {
    const path = resolve(dirname(packPath), workflow.templatePath)
    if (existsSync(path))
      workflowHashes[`${workflow.workflowId}@${workflow.version}`] = await shaFile(path)
  }
  for (const model of workflow.requiredModels ?? []) {
    if (!modelHashes[model.modelId]) {
      const path = resolve(modelRoot, model.relativePath)
      if (existsSync(path)) modelHashes[model.modelId] = await shaPath(path)
    }
  }
}

const device = systemStats.devices?.[0] ?? {}
const fileSystem = statfsSync('/workspace')
const report = {
  schemaVersion: 1,
  workerRelease,
  workerImageDigest: imageDigest,
  workflowPackFingerprint: createHash('sha256')
    .update(stableJson({ ...pack, workerImageDigest: null }))
    .digest('hex'),
  comfyUiCommit: pack.comfyUiCommit,
  gpuName: device.name ?? command('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader']),
  vramGb: Math.round(((device.vram_total ?? 0) / 1024 ** 3) * 10) / 10,
  freeDiskGb: Math.round(((fileSystem.bavail * fileSystem.bsize) / 1024 ** 3) * 10) / 10,
  pythonVersion: command('python', ['--version']),
  cudaVersion,
  nvidiaDriverVersion,
  latentsyncPythonVersion: command('/opt/latentsync-venv/bin/python', ['--version']),
  ltxTrainerPythonVersion: command('/opt/ltx-trainer-venv/bin/python', ['--version']),
  ltxTrainerTorchVersion: command('/opt/ltx-trainer-venv/bin/python', [
    '-c',
    'import torch; print(torch.__version__)'
  ]),
  ltxTrainerCudaVersion: command('/opt/ltx-trainer-venv/bin/python', [
    '-c',
    'import torch; print(torch.version.cuda)'
  ]),
  installedNodeTypes: Object.keys(nodes).sort(),
  modelHashes,
  workflowHashes,
  smokeTestPassed: await runSmokeTest(),
  checkedAt: new Date().toISOString()
}
mkdirSync(dirname(reportPath), { recursive: true })
const temporary = `${reportPath}.tmp`
writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
renameSync(temporary, reportPath)

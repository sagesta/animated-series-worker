import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import http from 'node:http'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'

const port = Number.parseInt(process.env.STUDIO_GATEWAY_PORT ?? '8000', 10)
const tokenHash = process.env.STUDIO_GATEWAY_TOKEN_HASH ?? ''
const leaseId = process.env.STUDIO_LEASE_ID ?? ''
const release = process.env.STUDIO_WORKER_RELEASE ?? 'development'
const hardDeadline = process.env.STUDIO_HARD_DEADLINE ?? ''
const root = resolve(process.env.STUDIO_JOB_ROOT ?? '/workspace/studio-jobs')
const comfyBaseUrl = process.env.STUDIO_COMFY_URL ?? 'http://127.0.0.1:8188'
const comfyInputRoot = resolve(process.env.STUDIO_COMFY_INPUT_ROOT ?? '/opt/ComfyUI/input')
const comfyOutputRoot = resolve(process.env.STUDIO_COMFY_OUTPUT_ROOT ?? '/opt/ComfyUI/output')
const packPath = resolve(
  process.env.STUDIO_WORKFLOW_PACK ?? '/opt/studio/workflow-pack.production.json'
)
const capabilityPath = resolve(
  process.env.STUDIO_CAPABILITY_REPORT ?? '/workspace/studio-capability.json'
)
const modelRoot = resolve(process.env.STUDIO_MODEL_ROOT ?? '/workspace')
const ttsPythonSetting = process.env.STUDIO_TTS_PYTHON ?? '/opt/tts-venv/bin/python'
const ttsPython = resolve(ttsPythonSetting)
const ltxTrainerPythonSetting =
  process.env.STUDIO_LTX_TRAINER_PYTHON ?? '/opt/ltx-trainer-venv/bin/python'
const ltxTrainerPython = resolve(ltxTrainerPythonSetting)
const maxUploadBytes = Number.parseInt(
  process.env.STUDIO_MAX_UPLOAD_BYTES ?? String(20 * 1024 ** 3),
  10
)
const maxTransferChunkBytes = 4 * 1024 ** 2
const idleTimeoutMinutes = Number.parseInt(process.env.STUDIO_IDLE_TIMEOUT_MINUTES ?? '10', 10)
const qualificationMode = process.env.STUDIO_QUALIFICATION_MODE === 'controlled'

if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw new Error('STUDIO_GATEWAY_TOKEN_HASH is required.')
if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(leaseId)) throw new Error('STUDIO_LEASE_ID is required.')
if (!Number.isFinite(Date.parse(hardDeadline))) throw new Error('STUDIO_HARD_DEADLINE is required.')
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid gateway port.')
if (!Number.isInteger(idleTimeoutMinutes) || idleTimeoutMinutes < 2 || idleTimeoutMinutes > 60)
  throw new Error('STUDIO_IDLE_TIMEOUT_MINUTES must be between 2 and 60.')
if (comfyBaseUrl !== 'http://127.0.0.1:8188')
  throw new Error('ComfyUI must stay on loopback port 8188.')
if (ttsPythonSetting !== '/opt/tts-venv/bin/python')
  throw new Error('The text-to-speech runtime path is fixed by the worker image.')
if (ltxTrainerPythonSetting !== '/opt/ltx-trainer-venv/bin/python')
  throw new Error('The LTX trainer runtime path is fixed by the worker image.')

mkdirSync(root, { recursive: true })
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
if (
  qualificationMode &&
  (!String(pack.packVersion).includes('-candidate') ||
    process.env.STUDIO_MODEL_BOOTSTRAP_MODE !== 'qualification')
) {
  throw new Error(
    'Controlled qualification requires a candidate pack and qualification model bootstrap.'
  )
}
const jobs = new Map()
const jobProcesses = new Map()
let lastAuthenticatedActivityAt = Date.now()

function stopProcess(child) {
  if (!child?.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function shaFile(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

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

function safeEqual(left, right) {
  const one = Buffer.from(left)
  const two = Buffer.from(right)
  return one.length === two.length && timingSafeEqual(one, two)
}

function authorised(request) {
  const header = request.headers.authorization ?? ''
  const match = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(header)
  return Boolean(match && safeEqual(sha(match[1]), tokenHash))
}

function inside(rootPath, candidatePath) {
  const fromRoot = relative(rootPath, candidatePath)
  return fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..')
}

function send(response, status, value, headers = {}) {
  const body = value === null ? '' : `${JSON.stringify(value)}\n`
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  })
  response.end(body)
}

async function readJson(request, maximumBytes = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maximumBytes)
      throw Object.assign(new Error('Request is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
}

function jobPath(jobId) {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(jobId))
    throw Object.assign(new Error('Invalid job identity.'), { status: 400 })
  const path = resolve(root, jobId)
  if (!inside(root, path)) throw Object.assign(new Error('Unsafe job path.'), { status: 400 })
  return path
}

function persist(job) {
  const directory = jobPath(job.jobId)
  mkdirSync(directory, { recursive: true })
  const temporary = resolve(directory, `job.${randomUUID()}.tmp`)
  writeFileSync(temporary, `${JSON.stringify(job, null, 2)}\n`, { flag: 'wx' })
  renameSync(temporary, resolve(directory, 'job.json'))
  jobs.set(job.jobId, job)
}

function loadExistingJobs() {
  if (!existsSync(root)) return
  for (const entry of listDirectories(root)) {
    try {
      const record = JSON.parse(readFileSync(resolve(root, entry, 'job.json'), 'utf8'))
      if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(record.jobId)) jobs.set(record.jobId, record)
    } catch {
      // A damaged record is never guessed or executed.
    }
  }
}

function listDirectories(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

function listFiles(path) {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
}

function workflowFor(job) {
  const matches = pack.workflows.filter(
    (candidate) =>
      candidate.workflowId === job.workflowId && candidate.version === job.workflowVersion
  )
  if (matches.length !== 1)
    throw Object.assign(new Error('Workflow is not in the approved pack.'), { status: 422 })
  const workflow = matches[0]
  if (
    workflow.qualificationState !== 'qualified' &&
    !(qualificationMode && workflow.qualificationState === 'candidate')
  ) {
    throw Object.assign(new Error('Workflow has not passed production qualification.'), {
      status: 422
    })
  }
  const hasTemplatePath =
    typeof workflow.templatePath === 'string' && workflow.templatePath.length > 0
  const hasTemplateHash = /^[a-f0-9]{64}$/.test(workflow.templateSha256 ?? '')
  if (hasTemplatePath !== hasTemplateHash)
    throw Object.assign(new Error('Workflow contract is only partially locked.'), { status: 422 })
  if (workflow.engine === 'comfyui' && !hasTemplatePath)
    throw Object.assign(new Error('Workflow template is not locked.'), { status: 422 })
  if (hasTemplatePath) {
    const contractPath = resolve(dirname(packPath), workflow.templatePath)
    if (
      !inside(dirname(packPath), contractPath) ||
      !existsSync(contractPath) ||
      !safeEqual(sha(readFileSync(contractPath)), workflow.templateSha256)
    ) {
      throw Object.assign(new Error('Workflow contract integrity check failed.'), { status: 422 })
    }
  }
  if (!['comfyui', 'worker-python'].includes(workflow.engine))
    throw Object.assign(new Error('This workflow engine is not available on the GPU worker.'), {
      status: 422
    })
  return workflow
}

function validateParameters(workflow, input) {
  if (!input || Array.isArray(input) || typeof input !== 'object')
    throw Object.assign(new Error('Workflow settings are required.'), { status: 400 })
  const allowed = new Map(workflow.parameters.map((parameter) => [parameter.key, parameter]))
  for (const key of Object.keys(input))
    if (!allowed.has(key))
      throw Object.assign(new Error(`Unknown workflow setting: ${key}.`), { status: 422 })
  const result = {}
  for (const definition of workflow.parameters) {
    const value = input[definition.key] ?? definition.defaultValue
    if (value === undefined && definition.required)
      throw Object.assign(new Error(`${definition.label} is required.`), { status: 422 })
    if (value === undefined) continue
    if (definition.type === 'string' && typeof value !== 'string')
      throw Object.assign(new Error(`${definition.label} must be text.`), { status: 422 })
    if (definition.type === 'boolean' && typeof value !== 'boolean')
      throw Object.assign(new Error(`${definition.label} must be yes or no.`), { status: 422 })
    if (
      (definition.type === 'number' || definition.type === 'integer') &&
      (typeof value !== 'number' || !Number.isFinite(value))
    )
      throw Object.assign(new Error(`${definition.label} must be a number.`), { status: 422 })
    if (definition.type === 'integer' && !Number.isInteger(value))
      throw Object.assign(new Error(`${definition.label} must be a whole number.`), { status: 422 })
    if (definition.maximumLength && value.length > definition.maximumLength)
      throw Object.assign(new Error(`${definition.label} is too long.`), { status: 422 })
    if (definition.minimum !== undefined && value < definition.minimum)
      throw Object.assign(new Error(`${definition.label} is below its safe minimum.`), {
        status: 422
      })
    if (definition.maximum !== undefined && value > definition.maximum)
      throw Object.assign(new Error(`${definition.label} is above its safe maximum.`), {
        status: 422
      })
    result[definition.key] = value
  }
  return result
}

function substitute(value, parameters, jobDirectory, inputAssets, comfyInputs) {
  if (Array.isArray(value))
    return value.map((item) => substitute(item, parameters, jobDirectory, inputAssets, comfyInputs))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        substitute(item, parameters, jobDirectory, inputAssets, comfyInputs)
      ])
    )
  if (typeof value !== 'string') return value
  if (value.startsWith('$PARAM:')) {
    const key = value.slice(7)
    if (!(key in parameters))
      throw Object.assign(new Error(`Missing workflow setting: ${key}.`), { status: 422 })
    return parameters[key]
  }
  if (value.startsWith('$INPUT:')) {
    const selector = value.slice(7)
    const selected = /^\d+$/.test(selector)
      ? inputAssets[Number(selector)]
      : inputAssets.find((asset) => asset.assetId === selector)
    if (!selected)
      throw Object.assign(new Error(`Required input is missing: ${selector}.`), { status: 422 })
    const path = comfyInputs.get(selected.assetId)
    if (!path)
      throw Object.assign(new Error(`Required input is missing: ${selector}.`), { status: 422 })
    return path
  }
  return value
}

function compile(job, workflow, comfyInputs) {
  const templatePath = resolve(dirname(packPath), workflow.templatePath)
  if (!inside(dirname(packPath), templatePath))
    throw Object.assign(new Error('Unsafe workflow path.'), { status: 422 })
  const source = readFileSync(templatePath)
  if (!safeEqual(sha(source), workflow.templateSha256))
    throw Object.assign(new Error('Workflow integrity check failed.'), { status: 422 })
  const parameters = validateParameters(workflow, job.parameters)
  const prompt = substitute(
    JSON.parse(source.toString('utf8')),
    parameters,
    jobPath(job.jobId),
    job.inputAssets ?? [],
    comfyInputs
  )
  const usedNodes = new Set(
    Object.values(prompt)
      .map((node) => node?.class_type)
      .filter(Boolean)
  )
  for (const node of usedNodes)
    if (!workflow.allowedNodeTypes.includes(node))
      throw Object.assign(new Error(`Unapproved workflow node: ${node}.`), { status: 422 })
  return { prompt, promptSha256: sha(stableJson(prompt)) }
}

async function comfy(path, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${comfyBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {})
      },
      redirect: 'error',
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`ComfyUI returned ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function outputMime(path) {
  const extension = extname(path).toLowerCase()
  return (
    {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.json': 'application/json'
    }[extension] ?? 'application/octet-stream'
  )
}

function comfyOutputFiles(history) {
  const files = []
  for (const output of Object.values(history.outputs ?? {})) {
    for (const group of ['images', 'audio', 'gifs']) {
      for (const item of output[group] ?? []) if (item?.filename) files.push(item)
    }
  }
  return files
}

async function collectArtifacts(job, history) {
  const destinationRoot = resolve(jobPath(job.jobId), 'artifacts')
  mkdirSync(destinationRoot, { recursive: true })
  const artifacts = []
  for (const file of comfyOutputFiles(history)) {
    const source = resolve(comfyOutputRoot, file.subfolder ?? '', file.filename)
    if (!inside(comfyOutputRoot, source) || !existsSync(source))
      throw new Error('ComfyUI output was missing or outside its output folder.')
    const name = `${artifacts.length + 1}-${basename(file.filename).replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const destination = resolve(destinationRoot, name)
    const hash = createHash('sha256')
    const stream = createReadStream(source)
    stream.on('data', (chunk) => hash.update(chunk))
    await pipeline(stream, createWriteStream(destination, { flags: 'wx' }))
    artifacts.push({
      name,
      mimeType: outputMime(name),
      byteSize: statSync(destination).size,
      sha256: hash.digest('hex'),
      downloadPath: `/v1/artifacts/${job.jobId}/${name}`
    })
  }
  if (artifacts.length === 0) throw new Error('The workflow finished without a supported output.')
  return artifacts
}

async function collectDirectoryArtifacts(job, sourceRoot) {
  const destinationRoot = resolve(jobPath(job.jobId), 'artifacts')
  mkdirSync(destinationRoot, { recursive: true })
  const artifacts = []
  for (const fileName of listFiles(sourceRoot).sort()) {
    const source = resolve(sourceRoot, fileName)
    if (!inside(sourceRoot, source) || !existsSync(source))
      throw new Error('Worker output was outside its approved folder.')
    const name = `${artifacts.length + 1}-${basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const destination = resolve(destinationRoot, name)
    const hash = createHash('sha256')
    const stream = createReadStream(source)
    stream.on('data', (chunk) => hash.update(chunk))
    await pipeline(stream, createWriteStream(destination, { flags: 'wx' }))
    const byteSize = statSync(destination).size
    if (byteSize < 1) throw new Error('Worker output was empty.')
    artifacts.push({
      name,
      mimeType: outputMime(name),
      byteSize,
      sha256: hash.digest('hex'),
      downloadPath: `/v1/artifacts/${job.jobId}/${name}`
    })
  }
  if (artifacts.length === 0) throw new Error('The workflow finished without a supported output.')
  return artifacts
}

function uploadedInputPaths(job) {
  const uploadDirectory = resolve(jobPath(job.jobId), 'uploads')
  return (job.inputAssets ?? []).map((asset) => {
    const path = resolve(uploadDirectory, `${asset.assetId}-${asset.fileName}`)
    if (!existsSync(path)) throw new Error(`Approved input is unavailable: ${asset.assetId}.`)
    if (!inside(uploadDirectory, path)) throw new Error('Approved input path is unsafe.')
    return path
  })
}

async function verifyJobInputs(jobId, inputAssets) {
  if (!Array.isArray(inputAssets) || inputAssets.length > 50) {
    throw Object.assign(new Error('The approved input list is invalid.'), { status: 400 })
  }
  const seen = new Set()
  const uploadDirectory = resolve(jobPath(jobId), 'uploads')
  for (const asset of inputAssets) {
    if (
      !asset ||
      !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(asset.assetId ?? '') ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(asset.fileName ?? '') ||
      !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '') ||
      !Number.isInteger(asset.byteSize) ||
      asset.byteSize < 1 ||
      asset.byteSize > maxUploadBytes ||
      seen.has(asset.assetId)
    ) {
      throw Object.assign(new Error('An approved input declaration is invalid.'), { status: 400 })
    }
    seen.add(asset.assetId)
    const path = resolve(uploadDirectory, `${asset.assetId}-${asset.fileName}`)
    if (!inside(uploadDirectory, path) || !existsSync(path)) {
      throw Object.assign(new Error(`Approved input is missing: ${asset.assetId}.`), {
        status: 422
      })
    }
    if (statSync(path).size !== asset.byteSize || !safeEqual(await shaFile(path), asset.sha256)) {
      throw Object.assign(new Error(`Approved input failed verification: ${asset.assetId}.`), {
        status: 422
      })
    }
  }
}

function comfyInputDirectory(jobId) {
  const directory = resolve(comfyInputRoot, 'animated-series-studio', leaseId, jobId)
  if (!inside(comfyInputRoot, directory)) throw new Error('ComfyUI input staging path is unsafe.')
  return directory
}

async function prepareComfyInputs(job) {
  const destinationRoot = comfyInputDirectory(job.jobId)
  mkdirSync(destinationRoot, { recursive: true })
  const prepared = new Map()
  for (const asset of job.inputAssets ?? []) {
    const source = resolve(jobPath(job.jobId), 'uploads', `${asset.assetId}-${asset.fileName}`)
    const destination = resolve(destinationRoot, `${asset.assetId}-${asset.fileName}`)
    if (
      !inside(destinationRoot, destination) ||
      !inside(resolve(jobPath(job.jobId), 'uploads'), source)
    ) {
      throw new Error('ComfyUI input staging was refused.')
    }
    if (!existsSync(destination)) {
      await pipeline(createReadStream(source), createWriteStream(destination, { flags: 'wx' }))
    }
    if (
      statSync(destination).size !== asset.byteSize ||
      !safeEqual(await shaFile(destination), asset.sha256)
    ) {
      throw new Error('A ComfyUI staged input failed verification.')
    }
    prepared.set(asset.assetId, relative(comfyInputRoot, destination).split(sep).join('/'))
  }
  return prepared
}

function verifiedModelPaths(workflow) {
  const capability = qualificationMode ? JSON.parse(readFileSync(capabilityPath, 'utf8')) : null
  return Object.fromEntries(
    (workflow.requiredModels ?? []).map((model) => {
      const path = resolve(modelRoot, model.relativePath)
      const expectedHash = model.sha256 ?? capability?.modelHashes?.[model.modelId]
      if (
        !inside(modelRoot, path) ||
        !existsSync(path) ||
        !/^[a-f0-9]{64}$/.test(expectedHash ?? '')
      ) {
        throw new Error(`Verified model is unavailable: ${model.modelId}.`)
      }
      return [model.modelId, path]
    })
  )
}

async function runWorkerPython(job, workflow) {
  const directory = jobPath(job.jobId)
  const outputDirectory = resolve(directory, 'runner-output')
  if (existsSync(outputDirectory)) throw new Error('Worker output directory already exists.')
  mkdirSync(outputDirectory, { recursive: true })
  const specPath = resolve(directory, 'runner-input.json')
  writeFileSync(
    specPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        workflowId: workflow.workflowId,
        workflowVersion: workflow.version,
        parameters: validateParameters(workflow, job.parameters),
        inputPaths: uploadedInputPaths(job),
        modelPaths: verifiedModelPaths(workflow),
        outputDirectory
      },
      null,
      2
    )}\n`,
    { flag: 'wx' }
  )
  const deadline = Math.min(
    Date.parse(hardDeadline) - 30_000,
    Date.now() + workflow.maximumRuntimeMinutes * 60_000
  )
  const runnerPython = workflow.workflowId.startsWith('qwen3-tts-')
    ? ttsPython
    : workflow.workflowId === 'ltx25-project-lora-adaptation'
      ? ltxTrainerPython
      : '/usr/bin/python3'
  if (workflow.workflowId.startsWith('qwen3-tts-') && !existsSync(runnerPython)) {
    throw new Error('The isolated text-to-speech runtime is unavailable.')
  }
  if (workflow.workflowId === 'ltx25-project-lora-adaptation' && !existsSync(runnerPython)) {
    throw new Error('The pinned LTX trainer runtime is unavailable.')
  }
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(runnerPython, ['/opt/studio/python_runner.py', specPath], {
      cwd: directory,
      env: { ...process.env },
      detached: true,
      shell: false,
      stdio: ['ignore', 'ignore', 'ignore']
    })
    jobProcesses.set(job.jobId, child)
    const timeout = setTimeout(
      () => {
        stopProcess(child)
        rejectPromise(new Error('The allowlisted Python workflow reached its runtime limit.'))
      },
      Math.max(1, deadline - Date.now())
    )
    child.once('error', (error) => {
      clearTimeout(timeout)
      jobProcesses.delete(job.jobId)
      rejectPromise(error)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      jobProcesses.delete(job.jobId)
      if (job.state === 'cancelled') return resolvePromise()
      if (code !== 0)
        return rejectPromise(
          new Error(`The allowlisted Python workflow stopped (${signal ?? code}).`)
        )
      resolvePromise()
    })
  })
  if (job.state === 'cancelled') return []
  return collectDirectoryArtifacts(job, outputDirectory)
}

async function execute(job, workflow) {
  try {
    job.state = 'running'
    job.message = 'The approved workflow is running.'
    job.updatedAt = new Date().toISOString()
    persist(job)
    if (workflow.engine === 'worker-python') {
      const artifacts = await runWorkerPython(job, workflow)
      if (job.state === 'cancelled') return
      job.state = 'verifying'
      job.message = 'The worker is checking every output file.'
      job.updatedAt = new Date().toISOString()
      persist(job)
      job.artifacts = await artifacts
      job.state = 'succeeded'
      job.progressPercent = 100
      job.message = 'Outputs passed the worker integrity checks.'
      job.updatedAt = new Date().toISOString()
      persist(job)
      return
    }
    const compiled = compile(job, workflow, await prepareComfyInputs(job))
    const queued = await comfy('/prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt: compiled.prompt, client_id: `studio-${leaseId}` })
    })
    if (!queued.prompt_id) throw new Error('ComfyUI did not return a prompt identity.')
    job.comfyPromptId = queued.prompt_id
    const deadline = Math.min(
      Date.parse(hardDeadline) - 30_000,
      Date.now() + workflow.maximumRuntimeMinutes * 60_000
    )
    while (Date.now() < deadline) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
      const historyPayload = await comfy(`/history/${encodeURIComponent(queued.prompt_id)}`)
      const history = historyPayload[queued.prompt_id]
      if (!history) continue
      if (history.status?.status_str === 'error')
        throw new Error('ComfyUI reported a workflow error.')
      if (!history.status?.completed) continue
      job.state = 'verifying'
      job.message = 'The worker is checking every output file.'
      job.updatedAt = new Date().toISOString()
      persist(job)
      job.artifacts = await collectArtifacts(job, history)
      job.state = 'succeeded'
      job.progressPercent = 100
      job.message = 'Outputs passed the worker integrity checks.'
      job.updatedAt = new Date().toISOString()
      persist(job)
      return
    }
    throw new Error('The workflow reached its hard runtime limit.')
  } catch (error) {
    job.state = job.state === 'cancelled' ? 'cancelled' : 'failed'
    job.errorCode = error?.name === 'AbortError' ? 'worker-timeout' : 'workflow-failed'
    job.message = 'The worker stopped this job safely. No automatic creative retry was started.'
    job.updatedAt = new Date().toISOString()
    persist(job)
  }
}

async function upload(request, response, jobId, assetId) {
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(assetId))
    throw Object.assign(new Error('Invalid asset identity.'), { status: 400 })
  const fileName = String(request.headers['x-studio-file-name'] ?? '')
  const expectedHash = String(request.headers['x-studio-sha256'] ?? '')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(fileName) || !/^[a-f0-9]{64}$/.test(expectedHash))
    throw Object.assign(new Error('Upload headers are invalid.'), { status: 400 })
  const declaredSize = Number(request.headers['content-length'])
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(request.headers['content-range'] ?? ''))
  if (!range)
    throw Object.assign(new Error('A verified upload range is required.'), { status: 400 })
  const start = Number(range[1])
  const end = Number(range[2])
  const total = Number(range[3])
  if (
    !Number.isInteger(declaredSize) ||
    declaredSize < 1 ||
    declaredSize > maxTransferChunkBytes ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    !Number.isInteger(total) ||
    total < 1 ||
    total > maxUploadBytes ||
    end < start ||
    end - start + 1 !== declaredSize ||
    end >= total
  )
    throw Object.assign(new Error('Upload range is not allowed.'), { status: 413 })
  const directory = resolve(jobPath(jobId), 'uploads')
  mkdirSync(directory, { recursive: true })
  const destination = resolve(directory, `${assetId}-${fileName}`)
  if (!inside(directory, destination))
    throw Object.assign(new Error('Upload path is unsafe.'), { status: 400 })
  const temporary = `${destination}.partial`
  const metadataPath = `${destination}.upload.json`
  if (existsSync(destination)) {
    if (
      statSync(destination).size !== total ||
      !safeEqual(await shaFile(destination), expectedHash)
    ) {
      throw Object.assign(new Error('An existing upload has different verified content.'), {
        status: 409
      })
    }
    request.resume()
    return send(response, 200, {
      ok: true,
      complete: true,
      nextOffset: total,
      byteSize: total,
      sha256: expectedHash
    })
  }
  const expectedMetadata = {
    schemaVersion: 1,
    jobId,
    assetId,
    fileName,
    total,
    sha256: expectedHash
  }
  if (start === 0 && !existsSync(temporary) && !existsSync(metadataPath)) {
    writeFileSync(metadataPath, `${JSON.stringify(expectedMetadata)}\n`, { flag: 'wx' })
  }
  let storedMetadata
  try {
    storedMetadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
  } catch {
    throw Object.assign(new Error('Upload recovery metadata is unavailable.'), { status: 409 })
  }
  if (!safeEqual(stableJson(storedMetadata), stableJson(expectedMetadata))) {
    throw Object.assign(new Error('Upload identity changed during transfer.'), { status: 409 })
  }
  let actualSize = 0
  request.on('data', (chunk) => {
    actualSize += chunk.length
    if (actualSize > maxTransferChunkBytes) request.destroy()
  })
  try {
    const currentSize = existsSync(temporary) ? statSync(temporary).size : 0
    if (currentSize === end + 1) {
      request.resume()
      if (end + 1 === total) {
        if (!safeEqual(await shaFile(temporary), expectedHash))
          throw new Error('Recovered upload integrity check failed.')
        renameSync(temporary, destination)
        rmSync(metadataPath, { force: true })
      }
      return send(response, 200, {
        ok: true,
        complete: end + 1 === total,
        nextOffset: end + 1,
        byteSize: total,
        sha256: expectedHash
      })
    }
    if (currentSize !== start)
      throw Object.assign(new Error(`Upload must resume at byte ${currentSize}.`), { status: 409 })
    await pipeline(request, createWriteStream(temporary, { flags: start === 0 ? 'wx' : 'a' }))
    if (actualSize !== declaredSize || statSync(temporary).size !== end + 1)
      throw new Error('Upload chunk size changed in transit.')
    const complete = end + 1 === total
    if (complete) {
      if (!safeEqual(await shaFile(temporary), expectedHash))
        throw new Error('Upload integrity check failed.')
      renameSync(temporary, destination)
      rmSync(metadataPath, { force: true })
    }
    send(response, complete ? 201 : 202, {
      ok: true,
      complete,
      nextOffset: end + 1,
      byteSize: total,
      sha256: expectedHash
    })
  } catch (error) {
    if (!Number.isInteger(error?.status)) {
      rmSync(temporary, { force: true })
      rmSync(metadataPath, { force: true })
    }
    throw error
  }
}

function health() {
  const remaining = Math.max(0, Math.floor((Date.parse(hardDeadline) - Date.now()) / 1000))
  const activeJobs = [...jobs.values()].filter((job) =>
    ['queued', 'running', 'verifying'].includes(job.state)
  ).length
  const idleRemaining = activeJobs
    ? idleTimeoutMinutes * 60
    : Math.max(
        0,
        Math.floor((lastAuthenticatedActivityAt + idleTimeoutMinutes * 60_000 - Date.now()) / 1000)
      )
  return {
    status:
      remaining < 120
        ? 'draining'
        : activeJobs
          ? 'busy'
          : existsSync(capabilityPath)
            ? 'ready'
            : 'starting',
    release,
    leaseId,
    hardDeadline,
    comfyUi: existsSync(capabilityPath) ? 'ready' : 'starting',
    activeJobs,
    secondsUntilHardStop: remaining,
    secondsUntilIdleStop: idleRemaining
  }
}

loadExistingJobs()
for (const job of jobs.values()) {
  if (['queued', 'running', 'verifying'].includes(job.state)) {
    job.state = 'failed'
    job.errorCode = 'worker-restarted'
    job.message = 'The worker restarted. Reconcile this job before deciding whether to retry.'
    job.updatedAt = new Date().toISOString()
    persist(job)
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (!authorised(request))
      return send(response, 401, {
        error: { code: 'unauthorized', message: 'A valid short-lived worker token is required.' }
      })
    lastAuthenticatedActivityAt = Date.now()
    const url = new URL(request.url ?? '/', 'http://worker.invalid')
    if (url.search || url.hash)
      return send(response, 400, {
        error: { code: 'invalid-route', message: 'Query parameters are not accepted.' }
      })

    if (request.method === 'GET' && url.pathname === '/v1/health')
      return send(response, 200, health())
    if (request.method === 'GET' && url.pathname === '/v1/capabilities') {
      if (!existsSync(capabilityPath))
        return send(response, 503, {
          error: { code: 'starting', message: 'Worker preflight is still running.' }
        })
      return send(response, 200, JSON.parse(readFileSync(capabilityPath, 'utf8')))
    }
    let match = /^\/v1\/uploads\/([0-9A-HJKMNP-TV-Z]{26})\/([0-9A-HJKMNP-TV-Z]{26})$/.exec(
      url.pathname
    )
    if (request.method === 'PUT' && match)
      return await upload(request, response, match[1], match[2])
    if (request.method === 'POST' && url.pathname === '/v1/jobs') {
      const input = await readJson(request)
      if (
        !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(input.jobId) ||
        !/^[a-f0-9]{64}$/.test(input.idempotencyKey)
      )
        throw Object.assign(new Error('Job identity is invalid.'), { status: 400 })
      const existing = jobs.get(input.jobId)
      if (existing) {
        if (!safeEqual(existing.idempotencyKey, input.idempotencyKey))
          throw Object.assign(new Error('Job identity is already used for different work.'), {
            status: 409
          })
        return send(response, 200, existing)
      }
      await verifyJobInputs(input.jobId, input.inputAssets ?? [])
      const workflow = workflowFor(input)
      validateParameters(workflow, input.parameters)
      const now = new Date().toISOString()
      const job = {
        jobId: input.jobId,
        idempotencyKey: input.idempotencyKey,
        workflowId: input.workflowId,
        workflowVersion: input.workflowVersion,
        parameters: input.parameters,
        inputAssets: input.inputAssets ?? [],
        state: 'queued',
        progressPercent: null,
        message: 'The approved workflow is queued.',
        comfyPromptId: null,
        artifacts: [],
        errorCode: null,
        createdAt: now,
        updatedAt: now
      }
      persist(job)
      void execute(job, workflow)
      return send(response, 202, job)
    }
    match = /^\/v1\/jobs\/([0-9A-HJKMNP-TV-Z]{26})$/.exec(url.pathname)
    if (request.method === 'GET' && match) {
      const job = jobs.get(match[1])
      return job
        ? send(response, 200, job)
        : send(response, 404, { error: { code: 'not-found', message: 'Job was not found.' } })
    }
    if (request.method === 'DELETE' && match) {
      const job = jobs.get(match[1])
      if (!job) {
        rmSync(comfyInputDirectory(match[1]), { recursive: true, force: true })
        return send(response, 204, null)
      }
      if (['queued', 'running', 'verifying'].includes(job.state))
        throw Object.assign(new Error('Running work must be cancelled before purge.'), {
          status: 409
        })
      rmSync(jobPath(match[1]), { recursive: true, force: true })
      rmSync(comfyInputDirectory(match[1]), { recursive: true, force: true })
      jobs.delete(match[1])
      return send(response, 204, null)
    }
    match = /^\/v1\/jobs\/([0-9A-HJKMNP-TV-Z]{26})\/cancel$/.exec(url.pathname)
    if (request.method === 'POST' && match) {
      const job = jobs.get(match[1])
      if (!job)
        return send(response, 404, { error: { code: 'not-found', message: 'Job was not found.' } })
      if (!['queued', 'running'].includes(job.state)) return send(response, 200, job)
      if (job.comfyPromptId)
        await comfy('/queue', {
          method: 'POST',
          body: JSON.stringify({ delete: [job.comfyPromptId] })
        }).catch(() => undefined)
      stopProcess(jobProcesses.get(job.jobId))
      job.state = 'cancelled'
      job.message = 'Cancellation was recorded. No retry will start automatically.'
      job.updatedAt = new Date().toISOString()
      persist(job)
      return send(response, 200, job)
    }
    match = /^\/v1\/artifacts\/([0-9A-HJKMNP-TV-Z]{26})\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,199})$/.exec(
      url.pathname
    )
    if (request.method === 'GET' && match) {
      const job = jobs.get(match[1])
      const artifact = job?.artifacts?.find((candidate) => candidate.name === match[2])
      if (!artifact)
        return send(response, 404, {
          error: { code: 'not-found', message: 'Artifact was not found.' }
        })
      const path = resolve(jobPath(match[1]), 'artifacts', match[2])
      if (!inside(resolve(jobPath(match[1]), 'artifacts'), path) || !existsSync(path))
        return send(response, 404, {
          error: { code: 'not-found', message: 'Artifact file is unavailable.' }
        })
      const rangeHeader = String(request.headers.range ?? '')
      const range = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader)
      if (!range)
        return send(
          response,
          416,
          {
            error: {
              code: 'range-required',
              message: 'Artifact downloads require a bounded byte range.'
            }
          },
          { 'Accept-Ranges': 'bytes' }
        )
      const start = Number(range[1])
      const end = Math.min(Number(range[2]), artifact.byteSize - 1)
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        start >= artifact.byteSize ||
        end - start + 1 > maxTransferChunkBytes
      )
        return send(
          response,
          416,
          { error: { code: 'invalid-range', message: 'Artifact byte range is not allowed.' } },
          { 'Accept-Ranges': 'bytes' }
        )
      response.writeHead(206, {
        'Content-Type': artifact.mimeType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${artifact.byteSize}`,
        'Accept-Ranges': 'bytes',
        'X-Studio-Sha256': artifact.sha256,
        'Cache-Control': 'no-store'
      })
      return createReadStream(path, { start, end }).pipe(response)
    }
    return send(response, 404, {
      error: { code: 'not-found', message: 'Worker route was not found.' }
    })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    return send(response, status, {
      error: {
        code: status >= 500 ? 'worker-error' : 'refused',
        message: status >= 500 ? 'The worker stopped this request safely.' : error.message
      }
    })
  }
})

server.requestTimeout = 60_000
server.headersTimeout = 10_000
server.listen(port, '0.0.0.0')

setInterval(() => {
  if (Date.now() >= Date.parse(hardDeadline)) {
    server.close(() => process.exit(70))
    setTimeout(() => process.exit(70), 5_000).unref()
    return
  }
  const activeJobs = [...jobs.values()].some((job) =>
    ['queued', 'running', 'verifying'].includes(job.state)
  )
  if (!activeJobs && Date.now() >= lastAuthenticatedActivityAt + idleTimeoutMinutes * 60_000) {
    server.close(() => process.exit(71))
    setTimeout(() => process.exit(71), 5_000).unref()
  }
}, 1_000).unref()

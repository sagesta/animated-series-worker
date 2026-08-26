/* eslint-disable @typescript-eslint/no-require-imports -- Electron launches this maintainer runner as CommonJS. */
const { app, nativeImage, safeStorage } = require('electron')
const { execFile } = require('node:child_process')
const { createHash, randomBytes, randomUUID } = require('node:crypto')
const { mkdir, readFile, rename, writeFile } = require('node:fs/promises')
const https = require('node:https')
const { basename, dirname, join, resolve } = require('node:path')
const { promisify } = require('node:util')
const {
  compareMaskedBitmaps,
  validateDurationProbe,
  verifyBaselineArtifacts,
  verifyUnaffectedWorkflowDefinitions
} = require('./targeted-gpu-evidence.cjs')

const PROJECT_ROOT = resolve(__dirname, '..')
const STATE_PATH = join(PROJECT_ROOT, 'qualification', 'live-runpod-qualification.json')
const RESULT_ROOT = join(PROJECT_ROOT, 'qualification', 'live-core-benchmark')
const TARGETED_RESULT_ROOT = join(PROJECT_ROOT, 'qualification', 'live-targeted-fix')
const CHUNK_BYTES = 4 * 1024 ** 2
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const MODE = process.argv[2] || 'all'
const execFileAsync = promisify(execFile)
const TARGETED_PARENT_SHA256 = 'd29e24c81779cfa3a2b24519a0ac658d86072bb9e0a607505a66081eee85e9df'
const TARGETED_SCARF_MASK_SHA256 =
  '5cbb0a510c6200e030d6caea61f92772813e477ecfa433523279df70a15cff7e'

app.setName('animated-series-studio')

function identity() {
  return [...randomBytes(26)].map((value) => CROCKFORD[value & 31]).join('')
}

function sha(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, value, { flag: 'wx' })
  await rename(temporary, path)
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

async function context() {
  const state = JSON.parse(await readFile(STATE_PATH, 'utf8'))
  const tokenPath = join(app.getPath('userData'), 'secure', 'worker-session-tokens.bin')
  const tokens = JSON.parse(await decrypt(tokenPath))
  const token = tokens[state.qualificationId]
  if (!token) throw new Error('The protected qualification token is unavailable.')
  return {
    state,
    token,
    baseUrl: `https://${state.pod.id}-8000.proxy.runpod.net`
  }
}

async function request(run, path, init = {}, expected = [200]) {
  const response = await fetch(`${run.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${run.token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(init.timeoutMs ?? 100_000)
  })
  if (!expected.includes(response.status)) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`Worker ${path} returned ${response.status}: ${detail}`)
  }
  if (response.status === 204) return null
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('application/json') ? response.json() : Buffer.from(await response.arrayBuffer())
}

async function waitForCapability(run, capabilityPath) {
  while (Date.now() < Date.parse(run.state.hardDeadline) - 45 * 60_000) {
    try {
      const capability = await request(run, '/v1/capabilities')
      await writeJson(capabilityPath, capability)
      return capability
    } catch (error) {
      const message = String(error?.message || error)
      if (!/returned (502|503|404)/.test(message)) throw error
      process.stdout.write(`${JSON.stringify({ phase: 'bootstrap', checkedAt: new Date().toISOString() })}\n`)
      await new Promise((resolveWait) => setTimeout(resolveWait, 30_000))
    }
  }
  throw new Error('Model bootstrap did not leave enough time for the controlled benchmarks.')
}

async function upload(run, jobId, path) {
  const bytes = await readFile(path)
  const asset = {
    assetId: identity(),
    fileName: basename(path).replace(/[^a-zA-Z0-9._-]/g, '-'),
    byteSize: bytes.byteLength,
    sha256: sha(bytes)
  }
  for (let start = 0; start < bytes.byteLength; start += CHUNK_BYTES) {
    const end = Math.min(bytes.byteLength, start + CHUNK_BYTES) - 1
    const chunk = bytes.subarray(start, end + 1)
    const response = await fetch(
      `${run.baseUrl}/v1/uploads/${jobId}/${asset.assetId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${run.token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`,
          'X-Studio-File-Name': asset.fileName,
          'X-Studio-Sha256': asset.sha256
        },
        body: chunk,
        signal: AbortSignal.timeout(100_000)
      }
    )
    if (![200, 201, 202].includes(response.status)) {
      throw new Error(`Upload returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }
  }
  return asset
}

async function downloadArtifact(run, jobId, artifact, destination) {
  const chunks = []
  for (let start = 0; start < artifact.byteSize; start += CHUNK_BYTES) {
    const end = Math.min(artifact.byteSize, start + CHUNK_BYTES) - 1
    const response = await new Promise((resolveRequest, rejectRequest) => {
      const outgoing = https.get(`${run.baseUrl}${artifact.downloadPath}`, {
        headers: {
          Authorization: `Bearer ${run.token}`,
          Range: `bytes=${start}-${end}`,
          'X-Studio-Range': `bytes=${start}-${end}`
        }
      })
      outgoing.setTimeout(100_000, () => outgoing.destroy(new Error('Artifact download timed out.')))
      outgoing.once('error', rejectRequest)
      outgoing.once('response', (incoming) => {
        const received = []
        incoming.on('data', (chunk) => received.push(chunk))
        incoming.once('error', rejectRequest)
        incoming.once('end', () =>
          resolveRequest({ status: incoming.statusCode, bytes: Buffer.concat(received) })
        )
      })
    })
    if (response.status !== 206) {
      throw new Error(
        `Artifact download returned ${response.status}: ${response.bytes.toString('utf8').slice(0, 300)}`
      )
    }
    chunks.push(response.bytes)
  }
  const bytes = Buffer.concat(chunks)
  if (bytes.byteLength !== artifact.byteSize || sha(bytes) !== artifact.sha256) {
    throw new Error('Downloaded artifact failed its size or hash check.')
  }
  await atomicWrite(destination, bytes)
  return destination
}

function workflowVersion(workflowId) {
  const pack = require(join(PROJECT_ROOT, 'config', 'workflow-pack.candidate.json'))
  const workflow = pack.workflows.find((candidate) => candidate.workflowId === workflowId)
  if (!workflow) throw new Error(`The candidate pack does not contain ${workflowId}.`)
  return workflow.version
}

async function runJob(run, definition, inputs = [], resultRoot = RESULT_ROOT) {
  const jobId = identity()
  const inputAssets = []
  for (const input of inputs) inputAssets.push(await upload(run, jobId, input))
  const body = {
    jobId,
    idempotencyKey: sha(
      JSON.stringify({
        qualificationId: run.state.qualificationId,
        workflowId: definition.workflowId,
        parameters: definition.parameters,
        inputs: inputAssets.map((asset) => asset.sha256)
      })
    ),
    workflowId: definition.workflowId,
    workflowVersion: definition.workflowVersion || workflowVersion(definition.workflowId),
    parameters: definition.parameters,
    inputAssets
  }
  const startedAt = new Date().toISOString()
  process.stdout.write(
    `${JSON.stringify({ phase: 'benchmark-start', workflowId: definition.workflowId, jobId })}\n`
  )
  let receipt = await request(run, '/v1/jobs', { method: 'POST', body: JSON.stringify(body) }, [200, 202])
  const deadline = Math.min(
    Date.parse(run.state.hardDeadline) - 90_000,
    Date.now() + definition.maximumRuntimeMinutes * 60_000 + 120_000
  )
  while (['queued', 'running', 'verifying'].includes(receipt.state) && Date.now() < deadline) {
    process.stdout.write(
      `${JSON.stringify({ phase: 'benchmark', workflowId: definition.workflowId, state: receipt.state })}\n`
    )
    await new Promise((resolveWait) => setTimeout(resolveWait, 5_000))
    receipt = await request(run, `/v1/jobs/${jobId}`)
  }
  if (receipt.state !== 'succeeded') {
    await writeJson(join(resultRoot, `${definition.workflowId}-failure.json`), receipt)
    throw new Error(
      `${definition.workflowId} stopped in state ${receipt.state}; prompt=${receipt.comfyPromptId || 'not-queued'}; job=${jobId}: ${receipt.message}`
        + `${receipt.qualificationDiagnostic ? ` Diagnostic: ${receipt.qualificationDiagnostic}` : ''}`
    )
  }
  const directory = join(resultRoot, definition.resultDirectoryName || definition.workflowId)
  await mkdir(directory, { recursive: true })
  const artifacts = []
  for (const artifact of receipt.artifacts) {
    const destination = join(directory, artifact.name)
    await downloadArtifact(run, jobId, artifact, destination)
    artifacts.push({ ...artifact, localPath: destination })
  }
  const result = {
    testId: definition.testId,
    workflowId: definition.workflowId,
    jobId,
    startedAt,
    finishedAt: new Date().toISOString(),
    state: receipt.state,
    inputAssets,
    artifacts
  }
  await writeJson(join(directory, 'receipt.json'), result)
  return result
}

async function probeVideo(path) {
  const { stdout } = await execFileAsync(
    'ffprobe',
    [
      '-v',
      'error',
      '-count_frames',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=nb_read_frames,duration,r_frame_rate',
      '-of',
      'json',
      path
    ],
    { windowsHide: true, timeout: 30_000 }
  )
  const payload = JSON.parse(stdout)
  const stream = payload.streams?.[0] || {}
  const [rateNumerator, rateDenominator] = String(stream.r_frame_rate || '').split('/').map(Number)
  const framesPerSecond = rateDenominator > 0 ? rateNumerator / rateDenominator : Number.NaN
  const frameCount = Number(stream.nb_read_frames)
  const durationSeconds = Number.isFinite(Number(stream.duration))
    ? Number(stream.duration)
    : frameCount / framesPerSecond
  return {
    durationSeconds,
    frameCount,
    framesPerSecond
  }
}

function targetedEditAnalysis(parentPath, editedPath, maskPath) {
  const parent = nativeImage.createFromPath(parentPath)
  const edited = nativeImage.createFromPath(editedPath)
  const mask = nativeImage.createFromPath(maskPath)
  if (parent.isEmpty() || edited.isEmpty() || mask.isEmpty()) {
    throw new Error('The targeted image evidence could not be decoded.')
  }
  const size = parent.getSize()
  if (
    edited.getSize().width !== size.width ||
    edited.getSize().height !== size.height ||
    mask.getSize().width !== size.width ||
    mask.getSize().height !== size.height
  ) {
    throw new Error('The parent, edited output, and mask dimensions do not match.')
  }
  return compareMaskedBitmaps(
    parent.getBitmap(),
    edited.getBitmap(),
    mask.getBitmap(),
    size.width,
    size.height
  )
}

async function runTargetedFixes(run) {
  const parentPath = resolve(process.argv[3] || '')
  const maskPath = resolve(process.argv[4] || '')
  if (!process.argv[3] || !process.argv[4]) {
    throw new Error('Targeted fixes require the approved parent image and scarf mask paths.')
  }
  const [parentBytes, maskBytes] = await Promise.all([readFile(parentPath), readFile(maskPath)])
  if (sha(parentBytes) !== TARGETED_PARENT_SHA256 || sha(maskBytes) !== TARGETED_SCARF_MASK_SHA256) {
    throw new Error('The targeted rerun inputs do not match the approved parent and scarf mask.')
  }
  await mkdir(TARGETED_RESULT_ROOT, { recursive: true })

  const editResult = await runJob(
    run,
    {
      testId: 'BENCH-IMAGE-EDIT-TARGETED-FIX',
      workflowId: 'qwen-image-targeted-edit',
      maximumRuntimeMinutes: 12,
      parameters: {
        instruction:
          'Preserve the same character identity, face, hair, glasses, pose, lighting, and background. Change only the scarf from red to deep blue.',
        seed: 260827,
        strength: 1
      }
    },
    [parentPath, maskPath],
    TARGETED_RESULT_ROOT
  )
  const editedImage = editResult.artifacts.find((artifact) => artifact.mimeType.startsWith('image/'))
  if (!editedImage) throw new Error('The targeted edit rerun did not produce an image.')
  const editAnalysis = targetedEditAnalysis(parentPath, editedImage.localPath, maskPath)
  if (!editAnalysis.passed) {
    throw new Error('The targeted edit failed the scarf-region image-diff acceptance check.')
  }

  const durations = []
  for (const requestedDurationSeconds of [1, 2, 4]) {
    const result = await runJob(
      run,
      {
        testId: `BENCH-LTX-FINAL-${requestedDurationSeconds}S-TARGETED-FIX`,
        workflowId: 'ltx2-image-to-video-final',
        resultDirectoryName: `ltx2-image-to-video-final-${requestedDurationSeconds}s`,
        maximumRuntimeMinutes: 60,
        parameters: {
          motionPrompt:
            'The character breathes naturally and glances toward the river. Very subtle camera push-in, stable facial identity, stable clothing and background, polished animation.',
          durationSeconds: requestedDurationSeconds,
          seed: 260831,
          framesPerSecond: 24
        }
      },
      [parentPath],
      TARGETED_RESULT_ROOT
    )
    const video = result.artifacts.find((artifact) => artifact.mimeType.startsWith('video/'))
    if (!video) throw new Error(`The ${requestedDurationSeconds}s LTX rerun did not produce video.`)
    const analysis = validateDurationProbe(
      await probeVideo(video.localPath),
      requestedDurationSeconds,
      24
    )
    if (!analysis.passed) {
      throw new Error(`The ${requestedDurationSeconds}s LTX rerun exceeded the one-frame tolerance.`)
    }
    durations.push({ result, analysis })
  }

  const summary = {
    schemaVersion: 1,
    qualificationId: run.state.qualificationId,
    workerImageDigest: run.state.imageDigest,
    completedAt: new Date().toISOString(),
    humanReviewRequired: true,
    promotionAuthorized: false,
    targetedEdit: { result: editResult, analysis: editAnalysis },
    ltxDurationTests: durations
  }
  await writeJson(join(TARGETED_RESULT_ROOT, 'summary.json'), summary)
  process.stdout.write(
    `${JSON.stringify({ phase: 'targeted-fixes-complete', summaryPath: join(TARGETED_RESULT_ROOT, 'summary.json') })}\n`
  )
}

function assertLiveTargetedPack(capability) {
  const pack = require(join(PROJECT_ROOT, 'config', 'workflow-pack.candidate.json'))
  const expectedFingerprint = sha(stableJson({ ...pack, workerImageDigest: null }))
  if (capability.workflowPackFingerprint !== expectedFingerprint) {
    throw new Error(
      'The live worker does not embed the integrated candidate pack; targeted verification stopped.'
    )
  }
  for (const workflowId of ['qwen-image-targeted-edit', 'ltx2-image-to-video-final']) {
    const workflow = pack.workflows.find((candidate) => candidate.workflowId === workflowId)
    if (!workflow || workflow.version !== '1.0.1' || !workflow.templateSha256) {
      throw new Error(`${workflowId} is not present as immutable workflow version 1.0.1.`)
    }
    if (capability.workflowHashes?.[`${workflowId}@1.0.1`] !== workflow.templateSha256) {
      throw new Error(`The live worker does not expose the exact ${workflowId}@1.0.1 hash.`)
    }
  }
}

function modelReceipt(capability) {
  const manifest = require(join(PROJECT_ROOT, 'config', 'model-install-manifest.candidate.json'))
  const required = Object.keys(capability.modelHashes || {}).sort()
  const models = required.map((modelId) => {
    const entry = manifest.models.find((candidate) => candidate.modelId === modelId)
    if (!entry) throw new Error(`The capability contains an unknown model: ${modelId}.`)
    return {
      modelId,
      repository: entry.repository,
      revision: entry.revision,
      destination: entry.destination,
      sha256: capability.modelHashes[modelId],
      licenseUrl: entry.licenseUrl
    }
  })
  return {
    schemaVersion: 1,
    manifest: 'model-install-manifest.runtime.json',
    qualificationMode: true,
    recoveryBasis: 'live-capability-hashes-plus-immutable-manifest',
    models
  }
}

async function securityChecks(run) {
  const unauthorised = await fetch(`${run.baseUrl}/v1/capabilities`, {
    signal: AbortSignal.timeout(30_000)
  })
  const queryRejected = await fetch(`${run.baseUrl}/v1/health?debug=true`, {
    headers: { Authorization: `Bearer ${run.token}` },
    signal: AbortSignal.timeout(30_000)
  })
  return {
    gatewayAuthentication: unauthorised.status === 401,
    queryParametersRejected: queryRejected.status === 400,
    checkedAt: new Date().toISOString()
  }
}

async function main() {
  if (MODE === 'verify-baseline-artifacts') {
    const summaryPath = resolve(process.argv[3] || '')
    if (!process.argv[3]) throw new Error('A baseline qualification summary path is required.')
    const summary = JSON.parse(await readFile(summaryPath, 'utf8'))
    const capabilityPath = process.argv[4]
      ? resolve(process.argv[4])
      : resolve(dirname(summaryPath), '..', 'studio-capability.json')
    const capability = JSON.parse(await readFile(capabilityPath, 'utf8'))
    const outputArtifacts = await verifyBaselineArtifacts(summary, [
      'BENCH-IMAGE-EDIT',
      'BENCH-LTX-FINAL'
    ])
    const pack = require(join(PROJECT_ROOT, 'config', 'workflow-pack.candidate.json'))
    const workflowDefinitions = verifyUnaffectedWorkflowDefinitions(pack, capability, [
      'qwen-image-character-board',
      'qwen3-tts-voice-design',
      'qwen3-tts-line-book',
      'ltx2-image-to-video-draft',
      'assistive-creative-qc'
    ])
    const report = {
      passed: outputArtifacts.passed && workflowDefinitions.passed,
      outputArtifacts,
      workflowDefinitions
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (!report.passed || outputArtifacts.tests.length !== 5) {
      throw new Error('The five unaffected baseline artifact sets did not pass hash verification.')
    }
    return
  }
  const run = await context()
  const activeResultRoot = MODE === 'targeted-fixes' ? TARGETED_RESULT_ROOT : RESULT_ROOT
  await mkdir(activeResultRoot, { recursive: true })
  const capabilityPath =
    MODE === 'targeted-fixes'
      ? join(TARGETED_RESULT_ROOT, 'studio-capability.json')
      : join(PROJECT_ROOT, 'qualification', 'studio-capability.json')
  const modelReceiptPath =
    MODE === 'targeted-fixes'
      ? join(TARGETED_RESULT_ROOT, 'studio-model-qualification.json')
      : join(PROJECT_ROOT, 'qualification', 'studio-model-qualification.json')
  const capability = await waitForCapability(run, capabilityPath)
  if (
    capability.workerImageDigest !== run.state.imageDigest ||
    !String(capability.gpuName).includes('NVIDIA L40S') ||
    capability.vramGb < 44 ||
    capability.smokeTestPassed !== true ||
    Object.keys(capability.modelHashes || {}).length !== 11
  ) {
    throw new Error('The live capability report does not match the controlled core qualification.')
  }
  await writeJson(modelReceiptPath, modelReceipt(capability))
  await writeJson(join(activeResultRoot, 'security-checks.json'), await securityChecks(run))

  if (MODE === 'targeted-fixes') {
    assertLiveTargetedPack(capability)
    await runTargetedFixes(run)
    return
  }

  if (MODE === 'inspect-job') {
    const jobId = process.argv[3]
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(jobId || '')) throw new Error('A valid job ID is required.')
    process.stdout.write(`${JSON.stringify(await request(run, `/v1/jobs/${jobId}`), null, 2)}\n`)
    return
  }

  if (MODE === 'download-job') {
    const jobId = process.argv[3]
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(jobId || '')) throw new Error('A valid job ID is required.')
    const receipt = await request(run, `/v1/jobs/${jobId}`)
    const directory = join(RESULT_ROOT, receipt.workflowId)
    await mkdir(directory, { recursive: true })
    for (const artifact of receipt.artifacts || []) {
      await downloadArtifact(run, jobId, artifact, join(directory, artifact.name))
    }
    process.stdout.write(`${JSON.stringify({ phase: 'download-complete', workflowId: receipt.workflowId })}\n`)
    return
  }

  if (MODE === 'voice') {
    const voiceResult = await runJob(run, {
      testId: 'BENCH-TTS-VOICE',
      workflowId: 'qwen3-tts-voice-design',
      maximumRuntimeMinutes: 8,
      parameters: {
        text: 'The old map ends here, but the river is still telling us where to go.',
        language: 'English',
        voiceDescription:
          'An original adult feminine animation voice, warm and curious, clear mid-range tone, gentle Nigerian English cadence, calm confidence, no imitation of any real person.',
        seed: 260828
      }
    })
    const voiceAudio = voiceResult.artifacts.find((artifact) => artifact.mimeType.startsWith('audio/'))
    if (!voiceAudio) throw new Error('The voice benchmark did not produce audio.')
    const lineBookResult = await runJob(
      run,
      {
        testId: 'BENCH-TTS-LINE-BOOK',
        workflowId: 'qwen3-tts-line-book',
        maximumRuntimeMinutes: 20,
        parameters: {
          lineBookJson: JSON.stringify([
            { id: 'line-one', text: 'Hold the lantern higher; these symbols are new.' },
            { id: 'line-two', text: 'Good. Now we follow the river before the rain arrives.' }
          ]),
          language: 'English',
          referenceText: 'The old map ends here, but the river is still telling us where to go.',
          seed: 260829
        }
      },
      [voiceAudio.localPath]
    )
    await writeJson(join(RESULT_ROOT, 'voice-summary.json'), {
      schemaVersion: 1,
      qualificationId: run.state.qualificationId,
      completedAt: new Date().toISOString(),
      humanReviewRequired: true,
      tests: [voiceResult, lineBookResult]
    })
    process.stdout.write(`${JSON.stringify({ phase: 'voice-complete' })}\n`)
    return
  }

  const identityResult = await runJob(run, {
    testId: 'BENCH-IMAGE-IDENTITY',
    workflowId: 'qwen-image-character-board',
    maximumRuntimeMinutes: 12,
    parameters: {
      prompt:
        'Original animated character identity board for Nia, a young adult cartographer with warm brown skin, short coiled black hair, round brass glasses, a teal field jacket, and a red scarf. Clean neutral studio background, consistent front three-quarter portrait, expressive but natural face, no text, no logos.',
      negativePrompt: 'photorealistic celebrity, watermark, text, extra fingers, duplicate face',
      seed: 260826,
      width: 512,
      height: 512
    }
  })
  const identityImage = identityResult.artifacts.find((artifact) => artifact.mimeType.startsWith('image/'))
  if (!identityImage) throw new Error('The identity benchmark did not produce an image.')

  const editResult = await runJob(
    run,
    {
      testId: 'BENCH-IMAGE-EDIT',
      workflowId: 'qwen-image-targeted-edit',
      maximumRuntimeMinutes: 12,
      parameters: {
        instruction:
          'Preserve the same character identity, face, hair, glasses, pose, lighting, and background. Change only the scarf from red to deep blue.',
        seed: 260827,
        strength: 0.3
      }
    },
    [identityImage.localPath]
  )

  const voiceResult = await runJob(run, {
    testId: 'BENCH-TTS-VOICE',
    workflowId: 'qwen3-tts-voice-design',
    maximumRuntimeMinutes: 8,
    parameters: {
      text: 'The old map ends here, but the river is still telling us where to go.',
      language: 'English',
      voiceDescription:
        'An original adult feminine animation voice, warm and curious, clear mid-range tone, gentle Nigerian English cadence, calm confidence, no imitation of any real person.',
      seed: 260828
    }
  })
  const voiceAudio = voiceResult.artifacts.find((artifact) => artifact.mimeType.startsWith('audio/'))
  if (!voiceAudio) throw new Error('The voice benchmark did not produce audio.')

  const lineBookResult = await runJob(
    run,
    {
      testId: 'BENCH-TTS-LINE-BOOK',
      workflowId: 'qwen3-tts-line-book',
      maximumRuntimeMinutes: 20,
      parameters: {
        lineBookJson: JSON.stringify([
          { id: 'line-one', text: 'Hold the lantern higher; these symbols are new.' },
          { id: 'line-two', text: 'Good. Now we follow the river before the rain arrives.' }
        ]),
        language: 'English',
        referenceText: 'The old map ends here, but the river is still telling us where to go.',
        seed: 260829
      }
    },
    [voiceAudio.localPath]
  )

  const draftResult = await runJob(
    run,
    {
      testId: 'BENCH-LTX-DRAFT',
      workflowId: 'ltx2-image-to-video-draft',
      maximumRuntimeMinutes: 30,
      parameters: {
        motionPrompt:
          'The character breathes naturally and glances from the map toward the river. Very subtle camera push-in, stable facial identity, stable clothing and background.',
        durationSeconds: 1,
        seed: 260830,
        framesPerSecond: 12
      }
    },
    [identityImage.localPath]
  )

  const finalResult = await runJob(
    run,
    {
      testId: 'BENCH-LTX-FINAL',
      workflowId: 'ltx2-image-to-video-final',
      maximumRuntimeMinutes: 60,
      parameters: {
        motionPrompt:
          'The character breathes naturally and glances from the map toward the river. Very subtle camera push-in, stable facial identity, stable clothing and background, polished animation.',
        durationSeconds: 1,
        seed: 260831,
        framesPerSecond: 12
      }
    },
    [identityImage.localPath]
  )
  const finalVideo = finalResult.artifacts.find((artifact) => artifact.mimeType.startsWith('video/'))
  if (!finalVideo) throw new Error('The final LTX benchmark did not produce video.')

  const qcResult = await runJob(
    run,
    {
      testId: 'BENCH-CREATIVE-QC',
      workflowId: 'assistive-creative-qc',
      maximumRuntimeMinutes: 15,
      parameters: {
        checks: 'codec, duration, resolution, frame rate, identity continuity, motion stability, flicker',
        expectedDialogue: ''
      }
    },
    [finalVideo.localPath]
  )

  const summary = {
    schemaVersion: 1,
    qualificationId: run.state.qualificationId,
    workerImageDigest: run.state.imageDigest,
    capabilityPath: join(PROJECT_ROOT, 'qualification', 'studio-capability.json'),
    modelReceiptPath: join(PROJECT_ROOT, 'qualification', 'studio-model-qualification.json'),
    completedAt: new Date().toISOString(),
    humanReviewRequired: true,
    tests: [
      identityResult,
      editResult,
      voiceResult,
      lineBookResult,
      draftResult,
      finalResult,
      qcResult
    ].map(({ testId, workflowId, jobId, startedAt, finishedAt, state, artifacts }) => ({
      testId,
      workflowId,
      jobId,
      startedAt,
      finishedAt,
      state,
      artifacts
    }))
  }
  await writeJson(join(RESULT_ROOT, 'summary.json'), summary)
  process.stdout.write(`${JSON.stringify({ phase: 'complete', summaryPath: join(RESULT_ROOT, 'summary.json') })}\n`)
}

app.whenReady().then(async () => {
  try {
    await main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})

#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const REQUIRED_TESTS = new Set([
  'BENCH-IMAGE-IDENTITY',
  'BENCH-IMAGE-EDIT',
  'BENCH-TTS-VOICE',
  'BENCH-TTS-LINE-BOOK',
  'BENCH-LTX-DRAFT',
  'BENCH-LTX-FINAL',
  'BENCH-CREATIVE-QC',
  'SECURITY-GATEWAY-AUTH',
  'SECURITY-COMFY-LOOPBACK',
  'SECURITY-NODE-ALLOWLIST',
  'RECOVERY-UPLOAD-RESUME',
  'RECOVERY-DOWNLOAD-RESUME',
  'RECOVERY-RECONCILE',
  'SHUTDOWN-IDLE',
  'SHUTDOWN-HARD-DEADLINE',
  'SHUTDOWN-PROVIDER-TERMINATION',
  'LOCAL-FINISHING-SUITE',
  'COST-RECEIPT'
])

function fail(message) {
  throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
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

function parseArguments() {
  const values = Object.create(null)
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!key?.startsWith('--') || !value) fail('Arguments must be --name value pairs.')
    values[key.slice(2)] = value
  }
  for (const required of ['model-receipt', 'capability-report', 'evidence']) {
    if (!values[required]) fail(`Missing --${required}.`)
  }
  return values
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    fail(`${label} is missing or is not valid JSON.`)
  }
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} must be a SHA-256 value.`)
}

function writePromotion(outputs) {
  for (const { path } of outputs) {
    if (existsSync(path)) fail(`${path} already exists. Archive or deliberately remove the earlier promotion before retrying.`)
  }
  const temporaries = outputs.map(({ path, value }) => ({ path, value, temporary: `${path}.${process.pid}.tmp` }))
  const created = []
  try {
    for (const output of temporaries) writeFileSync(output.temporary, output.value, { encoding: 'utf8', flag: 'wx' })
    for (const output of temporaries) {
      renameSync(output.temporary, output.path)
      created.push(output.path)
    }
  } catch (error) {
    for (const output of temporaries) {
      if (existsSync(output.temporary)) unlinkSync(output.temporary)
    }
    for (const path of created) unlinkSync(path)
    throw error
  }
}

const args = parseArguments()
const root = resolve(import.meta.dirname, '..')
const candidatePackPath = resolve(root, args['candidate-pack'] ?? 'config/workflow-pack.candidate.json')
const candidateManifestPath = resolve(root, args['candidate-manifest'] ?? 'config/model-install-manifest.candidate.json')
const promotionPolicyPath = resolve(root, args['promotion-policy'] ?? 'config/core-promotion-policy.json')
const productionPackPath = resolve(root, args['production-pack'] ?? 'config/workflow-pack.production.json')
const productionManifestPath = resolve(root, args['production-manifest'] ?? 'config/model-install-manifest.production.json')
const readinessPath = resolve(root, args['readiness'] ?? 'config/production-readiness.json')
const candidatePack = readJson(candidatePackPath, 'Candidate workflow pack')
const candidateManifest = readJson(candidateManifestPath, 'Candidate model manifest')
const promotionPolicy = readJson(promotionPolicyPath, 'Core promotion policy')
const modelReceipt = readJson(resolve(args['model-receipt']), 'Model qualification receipt')
const capability = readJson(resolve(args['capability-report']), 'Worker capability report')
const evidence = readJson(resolve(args.evidence), 'GPU qualification evidence')

if (candidatePack.schemaVersion !== 1 || candidateManifest.schemaVersion !== 1) fail('Candidate schemas are unsupported.')
if (!Array.isArray(candidatePack.workflows) || !Array.isArray(candidateManifest.models)) fail('Candidate files are incomplete.')
if (modelReceipt.schemaVersion !== 1 || modelReceipt.qualificationMode !== true || !Array.isArray(modelReceipt.models)) {
  fail('The model receipt was not produced by qualification mode.')
}
if (capability.schemaVersion !== 1 || capability.smokeTestPassed !== true) fail('Worker preflight or its smoke workflow did not pass.')
if (evidence.schemaVersion !== 1 || evidence.provider !== 'runpod') fail('Qualification evidence is incomplete.')
assertSha(evidence.workerImageDigest, 'Evidence worker digest')
if (capability.workerImageDigest !== evidence.workerImageDigest) fail('Capability and evidence worker digests differ.')
if (typeof evidence.workerImage !== 'string' || !evidence.workerImage.includes(':')) fail('A versioned production image name is required.')
if (!['network-volume', 'worker-image'].includes(evidence.modelStorageMethod)) fail('Model storage method is invalid.')
if (!evidence.reviewer || Number.isNaN(Date.parse(evidence.testedAt))) fail('Reviewer and test time are required.')

const fingerprint = sha256(stableJson({ ...candidatePack, workerImageDigest: null }))
if (capability.workflowPackFingerprint !== fingerprint) fail('The tested worker used a different workflow pack.')
if (capability.comfyUiCommit !== candidatePack.comfyUiCommit) fail('The tested ComfyUI commit differs from the pack.')
if (
  promotionPolicy.schemaVersion !== 1 ||
  promotionPolicy.decision?.status !== 'accepted' ||
  !promotionPolicy.decision?.decidedBy ||
  Number.isNaN(Date.parse(promotionPolicy.decision?.decidedAt))
) {
  fail('The core promotion exclusion policy is not an accepted, named, dated decision.')
}
const excludedWorkflowIds = new Set(promotionPolicy.excludedWorkflowIds ?? [])
const declaredCoreWorkflows = candidatePack.workflows.filter(
  (workflow) => workflow.qualificationTier !== 'advanced'
)
for (const workflowId of excludedWorkflowIds) {
  if (!declaredCoreWorkflows.some((workflow) => workflow.workflowId === workflowId)) {
    fail(`Core promotion policy excludes an unknown or non-core workflow: ${workflowId}.`)
  }
}
const coreWorkflows = declaredCoreWorkflows.filter(
  (workflow) => !excludedWorkflowIds.has(workflow.workflowId)
)
const advancedWorkflows = candidatePack.workflows.filter(
  (workflow) => workflow.qualificationTier === 'advanced'
)
if (coreWorkflows.length === 0) fail('The candidate pack must contain core workflows.')
if (advancedWorkflows.length === 0) fail('The candidate pack must retain separately locked advanced workflows.')
const maximumVram = Math.max(
  ...coreWorkflows.map((workflow) => workflow.minimumVramGb ?? 0)
)
if (!(capability.vramGb >= maximumVram)) fail(`The core qualification GPU must prove at least ${maximumVram} GB VRAM.`)

const testResults = new Map()
for (const item of evidence.tests ?? []) {
  if (testResults.has(item.testId)) fail(`Qualification test ${item.testId} is duplicated.`)
  testResults.set(item.testId, item)
}
for (const testId of REQUIRED_TESTS) {
  const result = testResults.get(testId)
  if (!result || result.passed !== true || typeof result.evidence !== 'string' || result.evidence.trim().length < 3) {
    fail(`Qualification test ${testId} has no passing evidence.`)
  }
}

const approvals = new Map()
for (const approval of evidence.licenseApprovals ?? []) {
  if (!approval?.modelId || approval.decision !== 'accepted' || !approval.reviewer || Number.isNaN(Date.parse(approval.reviewedAt))) {
    fail('Every model license needs an accepted, dated, named review decision.')
  }
  approvals.set(approval.modelId, approval)
}
const receiptModels = new Map(modelReceipt.models.map((model) => [model.modelId, model]))
const modelHashes = new Map()
const coreModelIds = new Set(
  coreWorkflows.flatMap((workflow) =>
    (workflow.requiredModels ?? []).map((model) => model.modelId)
  )
)
const candidateModels = candidateManifest.models.filter((model) => coreModelIds.has(model.modelId))
if (candidateModels.length !== coreModelIds.size) fail('A core workflow uses a model missing from the candidate manifest.')
const productionModels = candidateModels.map((model) => {
  const receipt = receiptModels.get(model.modelId)
  if (!receipt || receipt.repository !== model.repository || receipt.revision !== model.revision || receipt.destination !== model.destination) {
    fail(`Model qualification does not match the locked source for ${model.modelId}.`)
  }
  assertSha(receipt.sha256, `Model ${model.modelId}`)
  if (!approvals.has(model.modelId)) fail(`License approval is missing for ${model.modelId}.`)
  if (capability.modelHashes?.[model.modelId] !== receipt.sha256) fail(`Worker preflight did not verify ${model.modelId}.`)
  modelHashes.set(model.modelId, receipt.sha256)
  return { ...model, sha256: receipt.sha256, licenseReview: 'accepted' }
})
if (receiptModels.size !== productionModels.length) fail('The model receipt contains an undeclared or missing model entry.')

const installedNodes = new Set(capability.installedNodeTypes ?? [])
const productionWorkflows = coreWorkflows.map((workflow) => {
  let templateSha256 = workflow.templateSha256
  let allowedNodeTypes = workflow.allowedNodeTypes
  if (workflow.engine === 'comfyui') {
    if (!workflow.templatePath) fail(`ComfyUI template is missing for ${workflow.workflowId}.`)
    const templatePath = resolve(dirname(candidatePackPath), workflow.templatePath)
    const templateBytes = readFileSync(templatePath)
    templateSha256 = sha256(templateBytes)
    if (workflow.templateSha256 !== templateSha256) fail(`Candidate template hash is stale for ${workflow.workflowId}.`)
    const prompt = JSON.parse(templateBytes.toString('utf8'))
    const nodes = [...new Set(Object.values(prompt).map((node) => node?.class_type).filter((node) => typeof node === 'string'))].sort()
    if (nodes.length === 0 || nodes.some((node) => !workflow.allowedNodeTypes.includes(node))) fail(`Node allowlist is incomplete for ${workflow.workflowId}.`)
    if (nodes.some((node) => !installedNodes.has(node))) fail(`The worker is missing a node used by ${workflow.workflowId}.`)
    if (capability.workflowHashes?.[`${workflow.workflowId}@${workflow.version}`] !== templateSha256) fail(`Worker preflight did not verify ${workflow.workflowId}.`)
    allowedNodeTypes = nodes
  }
  const requiredModels = (workflow.requiredModels ?? []).map((model) => {
    const hash = modelHashes.get(model.modelId)
    if (!hash) fail(`Workflow ${workflow.workflowId} uses an undeclared model.`)
    return { ...model, sha256: hash, licenseReview: 'accepted' }
  })
  return {
    ...workflow,
    qualificationState: 'qualified',
    templateSha256,
    allowedNodeTypes,
    requiredModels
  }
})

const productionPack = {
  ...candidatePack,
  packVersion: candidatePack.packVersion.replace(/-candidate(?:\.[a-z0-9.-]+)?$/, ''),
  workerImage: evidence.workerImage,
  workerImageDigest: evidence.workerImageDigest,
  workflows: productionWorkflows
}
if (!/^\d+\.\d+\.\d+$/.test(productionPack.packVersion)) fail('Candidate pack version cannot be promoted safely.')
const productionManifest = {
  ...candidateManifest,
  manifestVersion: productionPack.packVersion,
  models: productionModels
}
const productionPackOutput = `${JSON.stringify(productionPack, null, 2)}\n`
const readiness = {
  schemaVersion: 1,
  qualificationId: evidence.qualificationId,
  provider: 'runpod',
  workflowPackSha256: sha256(productionPackOutput),
  workerImageDigest: evidence.workerImageDigest,
  modelStorage: {
    verified: true,
    method: evidence.modelStorageMethod,
    modelHashesVerified: productionModels.length
  },
  workerImage: { pulledByDigest: true, preflightPassed: true, smokeWorkflowPassed: true },
  promotionPolicy: {
    version: promotionPolicy.policyVersion,
    excludedCandidateWorkflows: [...excludedWorkflowIds].sort()
  },
  automaticShutdown: {
    idleExitPassed: true,
    hardDeadlineExitPassed: true,
    providerTerminationPassed: true
  },
  testedAt: evidence.testedAt,
  notes: [...(evidence.notes ?? []), `Reviewed by ${evidence.reviewer}.`]
}

writePromotion([
  { path: productionManifestPath, value: `${JSON.stringify(productionManifest, null, 2)}\n` },
  { path: productionPackPath, value: productionPackOutput },
  { path: readinessPath, value: `${JSON.stringify(readiness, null, 2)}\n` }
])
console.log('GPU worker promotion completed from verified external evidence.')
console.log(productionPackPath)
console.log(productionManifestPath)
console.log(readinessPath)

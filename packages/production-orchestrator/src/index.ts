import { basename } from 'node:path'
import { z } from 'zod'
import {
  ProductionCancelJobInputSchema,
  ProductionJobActionResultSchema,
  ProductionQueueJobInputSchema,
  ProductionWorkflowEstimateInputSchema,
  ProductionWorkflowEstimateResultSchema,
  ProductionWorkflowSummarySchema,
  type CloudConnectionStatus,
  type MediaAssetKind,
  type ProductionCancelJobInput,
  type ProductionJobActionResult,
  type ProductionJobDetails,
  type ProductionQueueJobInput,
  type ProductionWorkflowEstimateInput,
  type ProductionWorkflowEstimateResult,
  type ProductionWorkflowSummary
} from '@studio/contracts'
import { createUlid } from '@studio/domain'
import {
  RunPodConnectionError,
  type RunPodCreatePodInput,
  type RunPodPod
} from '@studio/provider-runpod'
import { ProductionStore, ProductionStoreError } from '@studio/production-store'
import { WorkerClient, WorkerClientError, createWorkerToken } from '@studio/worker-client'
import {
  WorkflowRegistry,
  WorkflowRegistryError,
  type CapabilityReport,
  type WorkflowDefinition
} from '@studio/workflow-registry'

interface CloudControl {
  getStatus(): Promise<CloudConnectionStatus>
  refresh(): Promise<CloudConnectionStatus>
}

interface SecretReader {
  readSecret(): Promise<string>
}

interface LeaseTokenVault {
  storeSecret(key: string, secret: string): Promise<void>
  readSecret(key: string): Promise<string>
  removeSecret(key: string): Promise<void>
}

interface RunPodLifecycle {
  createPod(apiKey: string, input: RunPodCreatePodInput): Promise<RunPodPod>
  getPod(apiKey: string, podId: string): Promise<RunPodPod>
  findPodByLease(apiKey: string, leaseId: string): Promise<RunPodPod | null>
  terminatePod(apiKey: string, podId: string): Promise<void>
}

interface WorkerGateway {
  getHealth(): Promise<{
    status: 'starting' | 'ready' | 'busy' | 'draining'
    leaseId: string
    hardDeadline: string
  }>
  getCapabilities(): Promise<CapabilityReport>
  uploadAssetFromPath(input: {
    jobId: string
    assetId: string
    fileName: string
    sha256: string
    sourcePath: string
    byteSize: number
  }): Promise<void>
  submitJob(input: {
    jobId: string
    idempotencyKey: string
    workflowId: string
    workflowVersion: string
    parameters: Record<string, string | number | boolean>
    inputAssets: Array<{
      assetId: string
      fileName: string
      sha256: string
      byteSize: number
    }>
  }): Promise<{
    state: 'queued' | 'running' | 'verifying' | 'succeeded' | 'failed' | 'cancelled'
  }>
  getJob(jobId: string): Promise<{
    state: 'queued' | 'running' | 'verifying' | 'succeeded' | 'failed' | 'cancelled'
    message: string
    errorCode: string | null
    artifacts: Array<{
      name: string
      mimeType: string
      byteSize: number
      sha256: string
      downloadPath: string
    }>
  }>
  cancelJob(jobId: string): Promise<unknown>
  downloadArtifact(
    artifact: {
      name: string
      mimeType: string
      byteSize: number
      sha256: string
      downloadPath: string
    },
    destinationPath: string
  ): Promise<void>
  purgeJob(jobId: string): Promise<void>
}

export interface ProductionOrchestratorOptions {
  workflowRegistry: WorkflowRegistry
  productionStore: ProductionStore
  cloud: CloudControl
  runPodCredential: SecretReader
  leaseTokenVault: LeaseTokenVault
  runPod: RunPodLifecycle
  workerFactory?: (baseUrl: string, token: string) => WorkerGateway
  now?: () => Date
}

const reservedParameterKeys = new Set([
  'studioGpuTypeId',
  'studioPriceTier',
  'studioNetworkVolumeId',
  'studioContainerDiskInGb',
  'studioVolumeInGb',
  'studioOutputKind'
])

function resultError(
  code:
    | 'invalid-input'
    | 'not-found'
    | 'stale-data'
    | 'approval-required'
    | 'budget-exceeded'
    | 'invalid-state'
    | 'unsafe-path'
    | 'integrity-failed'
    | 'project-error'
    | 'unknown',
  message: string
): ProductionJobActionResult {
  return ProductionJobActionResultSchema.parse({ ok: false, error: { code, message } })
}

function workflowBlockers(definition: WorkflowDefinition, imageDigest: string | null): string[] {
  const blockers: string[] = []
  if (definition.qualificationState !== 'qualified') {
    blockers.push('The workflow still needs its locked GPU benchmark and human quality sign-off.')
  }
  if (definition.engine === 'comfyui' && !definition.templateSha256) {
    blockers.push('The exact ComfyUI API workflow has not been hash-locked yet.')
  }
  if (
    definition.requiredModels.some((model) => !model.sha256 || model.licenseReview !== 'accepted')
  ) {
    blockers.push('One or more model files still need license review and exact hash verification.')
  }
  if (!imageDigest && ['comfyui', 'worker-python'].includes(definition.engine)) {
    blockers.push('The production worker image has not been built and digest-locked yet.')
  }
  return blockers
}

function toSummary(
  definition: WorkflowDefinition,
  workerImageDigest: string | null
): ProductionWorkflowSummary {
  const blockers = workflowBlockers(definition, workerImageDigest)
  return ProductionWorkflowSummarySchema.parse({
    workflowId: definition.workflowId,
    version: definition.version,
    label: definition.label,
    jobKind: definition.jobKind,
    engine: definition.engine,
    qualificationState: definition.qualificationState,
    minimumVramGb: definition.minimumVramGb,
    expectedRuntimeMinutes: definition.expectedRuntimeMinutes,
    maximumRuntimeMinutes: definition.maximumRuntimeMinutes,
    outputKind: definition.outputKind,
    requiresGpu: ['comfyui', 'worker-python'].includes(definition.engine),
    readyForPaidWork: blockers.length === 0,
    blockers,
    notes: definition.notes
  })
}

function productionParameters(
  parameters: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(parameters).filter(
      (entry): entry is [string, string | number | boolean] =>
        !reservedParameterKeys.has(entry[0]) && entry[1] !== null
    )
  )
}

function outputKind(jobKind: string, configured: unknown): MediaAssetKind {
  const allowed = z.enum([
    'character-board',
    'style-board',
    'environment-board',
    'storyboard-frame',
    'start-frame-control',
    'end-frame-control',
    'pose-control',
    'depth-control',
    'edge-control',
    'segmentation-control',
    'region-mask',
    'motion-track',
    'reference-clip',
    'foreground-layer',
    'subject-layer',
    'background-layer',
    'voice-line',
    'ambience',
    'effect',
    'animatic',
    'video-take',
    'caption',
    'thumbnail',
    'master-video',
    'adaptation-dataset',
    'adaptation-artifact',
    'document'
  ])
  const selected = allowed.safeParse(configured)
  if (selected.success) return selected.data
  if (jobKind === 'qwen3-tts') return 'voice-line'
  if (jobKind.startsWith('ltx') || jobKind === 'lip-sync') return 'video-take'
  if (jobKind === 'creative-qc') return 'document'
  if (jobKind === 'foley') return 'effect'
  if (jobKind === 'adaptation-train') return 'adaptation-artifact'
  return 'character-board'
}

function safeFileName(value: string): string {
  return basename(value)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-200)
}

function elapsedProviderEstimate(pod: RunPodPod, now: Date): number {
  if (!pod.lastStartedAt || pod.hourlyCostUsd <= 0) return 0
  const startedAt = Date.parse(pod.lastStartedAt)
  const stoppedAt =
    pod.desiredStatus === 'RUNNING'
      ? now.getTime()
      : pod.lastStatusChange
        ? Date.parse(pod.lastStatusChange)
        : now.getTime()
  if (!Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt <= startedAt) return 0
  return Math.round(((stoppedAt - startedAt) / 3_600_000) * pod.hourlyCostUsd * 10_000) / 10_000
}

export class ProductionOrchestrator {
  private readonly workflowRegistry: WorkflowRegistry
  private readonly productionStore: ProductionStore
  private readonly cloud: CloudControl
  private readonly runPodCredential: SecretReader
  private readonly leaseTokenVault: LeaseTokenVault
  private readonly runPod: RunPodLifecycle
  private readonly workerFactory: (baseUrl: string, token: string) => WorkerGateway
  private readonly now: () => Date

  constructor(options: ProductionOrchestratorOptions) {
    this.workflowRegistry = options.workflowRegistry
    this.productionStore = options.productionStore
    this.cloud = options.cloud
    this.runPodCredential = options.runPodCredential
    this.leaseTokenVault = options.leaseTokenVault
    this.runPod = options.runPod
    this.workerFactory =
      options.workerFactory ?? ((baseUrl, token) => new WorkerClient({ baseUrl, token }))
    this.now = options.now ?? (() => new Date())
  }

  listWorkflows(): ProductionWorkflowSummary[] {
    const runtime = this.workflowRegistry.runtime()
    return this.workflowRegistry
      .list()
      .map((workflow) => toSummary(workflow, runtime.workerImageDigest))
  }

  async estimateWorkflow(
    unknownInput: ProductionWorkflowEstimateInput
  ): Promise<ProductionWorkflowEstimateResult> {
    try {
      const input = ProductionWorkflowEstimateInputSchema.parse(unknownInput)
      this.productionStore.getWorkspace(input.projectId)
      const definition = this.workflowRegistry.get(input.workflowId, input.workflowVersion)
      const summary = toSummary(definition, this.workflowRegistry.runtime().workerImageDigest)
      if (!summary.requiresGpu) {
        if (input.gpuCount !== 0 || input.gpuTypeId || input.priceTier) {
          throw new WorkflowRegistryError(
            'invalid-parameter',
            'This local workflow does not use a rented GPU.'
          )
        }
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: true,
          workflow: summary,
          estimate: this.workflowRegistry.estimate(
            input.workflowId,
            input.workflowVersion,
            0,
            0,
            definition.maximumRuntimeMinutes,
            this.now()
          )
        })
      }
      if (input.gpuCount !== 1) {
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: false,
          error: {
            code: 'invalid-input',
            message:
              'One render uses one GPU. To use two or three GPUs, schedule separate shots concurrently.'
          }
        })
      }
      const status = await this.cloud.getStatus()
      if (status.connectionState !== 'connected') {
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: false,
          error: {
            code: 'not-connected',
            message: 'Connect RunPod in Settings before estimating rented GPU work.'
          }
        })
      }
      const gpu = status.gpuOptions.find((option) => option.id === input.gpuTypeId)
      if (!gpu || !input.priceTier) {
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: false,
          error: {
            code: 'not-found',
            message: 'Choose one of the GPU options currently shown by the studio.'
          }
        })
      }
      if (gpu.memoryGb < definition.minimumVramGb) {
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: false,
          error: {
            code: 'invalid-input',
            message: `${summary.label} needs at least ${definition.minimumVramGb} GB VRAM.`
          }
        })
      }
      const hourlyRate = input.priceTier === 'secure' ? gpu.secureHourlyUsd : gpu.communityHourlyUsd
      if (hourlyRate === null) {
        return ProductionWorkflowEstimateResultSchema.parse({
          ok: false,
          error: {
            code: 'price-unavailable',
            message: 'That GPU tier has no current price. Choose another option or refresh RunPod.'
          }
        })
      }
      return ProductionWorkflowEstimateResultSchema.parse({
        ok: true,
        workflow: summary,
        estimate: this.workflowRegistry.estimate(
          input.workflowId,
          input.workflowVersion,
          hourlyRate,
          1,
          status.guardrails.maxRuntimeMinutes,
          this.now()
        )
      })
    } catch (error) {
      const message =
        error instanceof WorkflowRegistryError || error instanceof ProductionStoreError
          ? error.message
          : 'The workflow estimate could not be prepared safely.'
      return ProductionWorkflowEstimateResultSchema.parse({
        ok: false,
        error: {
          code: error instanceof WorkflowRegistryError ? 'invalid-input' : 'unknown',
          message
        }
      })
    }
  }

  async queueApprovedJob(
    unknownInput: ProductionQueueJobInput
  ): Promise<ProductionJobActionResult> {
    try {
      const input = ProductionQueueJobInputSchema.parse(unknownInput)
      const details = this.productionStore.getProjectJob(input.projectId, input.jobId)
      const { job } = details
      if (job.state !== 'approved')
        return resultError(
          'invalid-state',
          'Approve the exact cost estimate before starting this job.'
        )
      if (job.estimate.estimateId !== input.expectedEstimateId)
        return resultError(
          'stale-data',
          'The job estimate changed. Review it again before starting.'
        )
      const definition = this.workflowRegistry.get(job.workflowId, job.workflowVersion)
      const runtime = this.workflowRegistry.runtime()
      const summary = toSummary(definition, runtime.workerImageDigest)
      if (!summary.readyForPaidWork || !runtime.workerImageDigest) {
        return resultError(
          'approval-required',
          summary.blockers[0] ?? 'This workflow is still locked.'
        )
      }
      if (!summary.requiresGpu) {
        return resultError(
          'invalid-state',
          'This local workflow belongs to the local render queue, not RunPod.'
        )
      }
      const status = await this.cloud.refresh()
      if (status.connectionState !== 'connected' || !status.guardrailsSaved) {
        return resultError(
          'approval-required',
          'Connect RunPod and save the spending limits before starting a worker.'
        )
      }
      if (status.generationState !== 'ready') {
        return resultError('approval-required', status.generationReason)
      }
      if (status.account && status.account.activePods >= status.guardrails.maxConcurrentGpus) {
        return resultError('budget-exceeded', 'The saved concurrent-GPU limit is already reached.')
      }
      const gpuTypeId = z.string().min(1).max(191).parse(job.parameters.studioGpuTypeId)
      const priceTier = z.enum(['secure', 'community']).parse(job.parameters.studioPriceTier)
      const gpu = status.gpuOptions.find((option) => option.id === gpuTypeId)
      const currentRate = priceTier === 'secure' ? gpu?.secureHourlyUsd : gpu?.communityHourlyUsd
      if (!gpu || currentRate === null || currentRate === undefined)
        return resultError(
          'stale-data',
          'The selected GPU price is no longer available. Create a fresh estimate.'
        )
      if (currentRate > job.estimate.hourlyRateUsdPerGpu)
        return resultError(
          'stale-data',
          'The GPU price increased. Review a fresh estimate before starting.'
        )
      const maximumMinutes = Math.min(
        job.estimate.maximumRuntimeMinutes,
        status.guardrails.maxRuntimeMinutes
      )
      const deadline = new Date(this.now().getTime() + maximumMinutes * 60_000).toISOString()
      const leaseId = createUlid(this.now().getTime())
      const workerToken = createWorkerToken()
      await this.leaseTokenVault.storeSecret(leaseId, workerToken.token)
      let queued: ProductionJobDetails
      try {
        queued = this.productionStore.assignWorker(input.projectId, input.jobId, leaseId, deadline)
      } catch (error) {
        await this.leaseTokenVault.removeSecret(leaseId)
        throw error
      }
      const apiKey = await this.runPodCredential.readSecret()
      const createInput: RunPodCreatePodInput = {
        leaseId,
        name: `Animated Studio ${input.projectId.slice(-6)} ${input.jobId.slice(-6)}`,
        imageName: `${runtime.workerImage}@sha256:${runtime.workerImageDigest}`,
        gpuTypeIds: [gpuTypeId],
        gpuCount: 1,
        containerDiskInGb: z
          .number()
          .int()
          .min(20)
          .max(2000)
          .catch(100)
          .parse(job.parameters.studioContainerDiskInGb),
        volumeInGb: z
          .number()
          .int()
          .min(0)
          .max(2000)
          .catch(150)
          .parse(job.parameters.studioVolumeInGb),
        ...(typeof job.parameters.studioNetworkVolumeId === 'string' &&
        job.parameters.studioNetworkVolumeId
          ? {
              networkVolumeId: z
                .string()
                .min(1)
                .max(191)
                .parse(job.parameters.studioNetworkVolumeId)
            }
          : {}),
        ports: ['8000/http'],
        environment: {
          STUDIO_GATEWAY_TOKEN_HASH: workerToken.sha256,
          STUDIO_HARD_DEADLINE: deadline,
          STUDIO_WORKER_IMAGE_DIGEST: runtime.workerImageDigest,
          STUDIO_WORKER_RELEASE: runtime.packVersion,
          STUDIO_WORKFLOW_PACK: '/opt/studio/workflow-pack.runtime.json',
          STUDIO_MODEL_BOOTSTRAP_MODE: 'production',
          STUDIO_REQUIRED_MODEL_IDS: definition.requiredModels
            .map((model) => model.modelId)
            .join(','),
          STUDIO_IDLE_TIMEOUT_MINUTES: String(status.guardrails.idleTimeoutMinutes)
        },
        interruptible: false
      }
      try {
        const pod = await this.runPod.createPod(apiKey, createInput)
        return ProductionJobActionResultSchema.parse({
          ok: true,
          details: this.productionStore.attachProviderPod(input.projectId, input.jobId, pod.id)
        })
      } catch (error) {
        this.productionStore.recordRecoverableError(
          input.projectId,
          input.jobId,
          error instanceof RunPodConnectionError ? error.code : 'provider-create-uncertain',
          'The worker create result is uncertain. The studio will reconcile this lease before any retry.'
        )
        return ProductionJobActionResultSchema.parse({ ok: true, details: queued })
      }
    } catch (error) {
      if (error instanceof ProductionStoreError) return resultError(error.code, error.message)
      if (error instanceof WorkflowRegistryError) return resultError('invalid-input', error.message)
      return resultError(
        'unknown',
        'The worker was not queued safely. No automatic retry was started.'
      )
    }
  }

  async reconcileJob(projectId: string, jobId: string): Promise<ProductionJobActionResult> {
    try {
      let details = this.productionStore.getProjectJob(projectId, jobId)
      const job = details.job
      if (!job.workerLeaseId)
        return resultError('invalid-state', 'This job has no worker lease to reconcile.')
      const apiKey = await this.runPodCredential.readSecret()
      const pod = job.workerPodId
        ? await this.runPod.getPod(apiKey, job.workerPodId)
        : await this.runPod.findPodByLease(apiKey, job.workerLeaseId)
      if (!pod) {
        this.productionStore.recordRecoverableError(
          projectId,
          jobId,
          'worker-not-found',
          'No provider worker currently matches this protected lease.'
        )
        return resultError(
          'not-found',
          'No RunPod worker matches this job. Nothing new was created.'
        )
      }
      if (!job.workerPodId)
        details = this.productionStore.attachProviderPod(projectId, jobId, pod.id)
      const elapsedEstimate = elapsedProviderEstimate(pod, this.now())
      if (elapsedEstimate > 0) {
        details = this.productionStore.recordElapsedCostEstimate(projectId, jobId, elapsedEstimate)
      }
      if (pod.desiredStatus !== 'RUNNING') {
        await this.leaseTokenVault.removeSecret(job.workerLeaseId).catch(() => undefined)
        if (['queued', 'provisioning', 'running', 'cancel-requested'].includes(details.job.state)) {
          details = this.productionStore.transitionJob(
            projectId,
            jobId,
            'terminated',
            'RunPod reports that this worker is no longer running.',
            null
          )
          details = this.productionStore.markWorkerClosed(
            projectId,
            jobId,
            'The provider worker is closed; its identity remains in the audit record.'
          )
          return ProductionJobActionResultSchema.parse({
            ok: true,
            details
          })
        }
        details = this.productionStore.markWorkerClosed(
          projectId,
          jobId,
          'The provider worker is closed; its identity remains in the audit record.'
        )
        return ProductionJobActionResultSchema.parse({ ok: true, details })
      }
      if (
        ['awaiting-review', 'succeeded', 'failed', 'cancelled', 'terminated'].includes(
          details.job.state
        )
      ) {
        await this.runPod.terminatePod(apiKey, pod.id)
        await this.leaseTokenVault.removeSecret(job.workerLeaseId).catch(() => undefined)
        details = this.productionStore.markWorkerClosed(
          projectId,
          jobId,
          'The terminal job worker was terminated and is no longer running.'
        )
        return ProductionJobActionResultSchema.parse({ ok: true, details })
      }
      const token = await this.leaseTokenVault.readSecret(job.workerLeaseId)
      const gateway = this.workerFactory(`https://${pod.id}-8000.proxy.runpod.net`, token)
      if (details.job.state === 'provisioning') {
        const [health, capabilities] = await Promise.all([
          gateway.getHealth(),
          gateway.getCapabilities()
        ])
        if (
          health.leaseId !== job.workerLeaseId ||
          health.hardDeadline !== job.workerHardDeadline
        ) {
          await this.runPod.terminatePod(apiKey, pod.id)
          await this.leaseTokenVault.removeSecret(job.workerLeaseId)
          this.productionStore.transitionJob(
            projectId,
            jobId,
            'terminated',
            'The worker identity did not match the protected lease.',
            null
          )
          this.productionStore.markWorkerClosed(
            projectId,
            jobId,
            'The mismatched provider worker was terminated and closed.'
          )
          return resultError(
            'integrity-failed',
            'The worker identity did not match the protected lease, so it was terminated.'
          )
        }
        if (health.status === 'draining') {
          await this.runPod.terminatePod(apiKey, pod.id)
          await this.leaseTokenVault.removeSecret(job.workerLeaseId)
          this.productionStore.transitionJob(
            projectId,
            jobId,
            'terminated',
            'The worker reached its shutdown window before accepting production work.',
            null
          )
          this.productionStore.markWorkerClosed(
            projectId,
            jobId,
            'The draining provider worker was terminated and closed.'
          )
          return resultError(
            'invalid-state',
            'The worker was too close to automatic shutdown and was terminated before work started.'
          )
        }
        const qualification = this.workflowRegistry.qualify(
          job.workflowId,
          job.workflowVersion,
          capabilities
        )
        if (!qualification.ready) {
          await this.runPod.terminatePod(apiKey, pod.id)
          await this.leaseTokenVault.removeSecret(job.workerLeaseId)
          this.productionStore.transitionJob(
            projectId,
            jobId,
            'terminated',
            'Worker preflight failed and the Pod was terminated before the production workflow ran.',
            null
          )
          this.productionStore.markWorkerClosed(
            projectId,
            jobId,
            'The incompatible provider worker was terminated and closed.'
          )
          return resultError(
            'integrity-failed',
            qualification.blockers[0] ?? 'Worker preflight failed.'
          )
        }
        const workspace = this.productionStore.getWorkspace(projectId)
        const inputAssets = workspace.media.filter((asset) =>
          job.inputAssetIds.includes(asset.assetId)
        )
        for (const asset of inputAssets) {
          const source = this.productionStore.resolveMediaPath(projectId, asset.assetId)
          await gateway.uploadAssetFromPath({
            jobId,
            assetId: asset.assetId,
            fileName: safeFileName(asset.relativePath),
            sha256: asset.sha256,
            sourcePath: source.path,
            byteSize: asset.byteSize
          })
        }
        await gateway.submitJob({
          jobId,
          idempotencyKey: job.idempotencyKey,
          workflowId: job.workflowId,
          workflowVersion: job.workflowVersion,
          parameters: productionParameters(job.parameters),
          inputAssets: inputAssets.map((asset) => ({
            assetId: asset.assetId,
            fileName: safeFileName(asset.relativePath),
            sha256: asset.sha256,
            byteSize: asset.byteSize
          }))
        })
        return ProductionJobActionResultSchema.parse({
          ok: true,
          details: this.productionStore.transitionJob(
            projectId,
            jobId,
            'running',
            'The secured worker passed preflight and accepted the allowlisted workflow.',
            5
          )
        })
      }
      if (details.job.state === 'running') {
        const workerJob = await gateway.getJob(jobId)
        if (workerJob.state === 'failed') {
          details = this.productionStore.transitionJob(
            projectId,
            jobId,
            'failed',
            workerJob.message,
            null
          )
          await this.runPod.terminatePod(apiKey, pod.id)
          await this.leaseTokenVault.removeSecret(job.workerLeaseId)
          details = this.productionStore.markWorkerClosed(
            projectId,
            jobId,
            'The failed job worker was terminated and closed.'
          )
          return ProductionJobActionResultSchema.parse({ ok: true, details })
        }
        if (workerJob.state === 'cancelled') {
          this.productionStore.transitionJob(
            projectId,
            jobId,
            'cancel-requested',
            'The worker confirmed cancellation.',
            null
          )
          return ProductionJobActionResultSchema.parse({
            ok: true,
            details: this.productionStore.transitionJob(
              projectId,
              jobId,
              'cancelled',
              'The job was cancelled without an automatic retry.',
              null
            )
          })
        }
        if (workerJob.state === 'succeeded') {
          this.productionStore.transitionJob(
            projectId,
            jobId,
            'downloading',
            'Verified worker outputs are downloading to this project.',
            90
          )
          const kind = outputKind(job.kind, job.parameters.studioOutputKind)
          for (const [index, artifact] of workerJob.artifacts.entries()) {
            const destination = this.productionStore.prepareArtifactDownload(
              projectId,
              jobId,
              artifact.name
            )
            await gateway.downloadArtifact(artifact, destination)
            if (index === 0)
              this.productionStore.transitionJob(
                projectId,
                jobId,
                'verifying',
                'The studio is checking downloaded hashes, file types, and project paths.',
                95
              )
            this.productionStore.registerGeneratedMedia({
              projectId,
              jobId,
              label: `${job.label} · take ${index + 1}`,
              kind,
              stagingPath: destination,
              fileName: artifact.name,
              mimeType: artifact.mimeType,
              byteSize: artifact.byteSize,
              sha256: artifact.sha256,
              parentAssetIds: job.inputAssetIds
            })
          }
          await gateway.purgeJob(jobId)
          details = this.productionStore.transitionJob(
            projectId,
            jobId,
            'awaiting-review',
            'The outputs are local candidates. Review them before approval.',
            100
          )
          try {
            await this.runPod.terminatePod(apiKey, pod.id)
            await this.leaseTokenVault.removeSecret(job.workerLeaseId)
            details = this.productionStore.markWorkerClosed(
              projectId,
              jobId,
              'The completed job worker was terminated after verified local download.'
            )
          } catch {
            details = this.productionStore.recordRecoverableError(
              projectId,
              jobId,
              'worker-stop-unconfirmed',
              'Outputs are safe locally, but worker shutdown is not confirmed. Reconcile immediately.'
            )
          }
          return ProductionJobActionResultSchema.parse({ ok: true, details })
        }
      }
      return ProductionJobActionResultSchema.parse({ ok: true, details })
    } catch (error) {
      if (error instanceof ProductionStoreError) return resultError(error.code, error.message)
      if (error instanceof WorkerClientError) {
        this.productionStore.recordRecoverableError(
          projectId,
          jobId,
          error.code,
          'The worker connection needs reconciliation. No new worker or retry was started.'
        )
        return resultError('unknown', error.message)
      }
      return resultError('unknown', 'The job could not be reconciled safely. No retry was started.')
    }
  }

  async cancelJob(unknownInput: ProductionCancelJobInput): Promise<ProductionJobActionResult> {
    try {
      const input = ProductionCancelJobInputSchema.parse(unknownInput)
      let details = this.productionStore.getProjectJob(input.projectId, input.jobId)
      if (['succeeded', 'failed', 'cancelled', 'terminated'].includes(details.job.state)) {
        return ProductionJobActionResultSchema.parse({ ok: true, details })
      }
      if (['queued', 'provisioning', 'running', 'downloading'].includes(details.job.state)) {
        details = this.productionStore.transitionJob(
          input.projectId,
          input.jobId,
          'cancel-requested',
          `Cancellation requested: ${input.reason}`,
          null
        )
      }
      const job = details.job
      if (job.workerLeaseId && job.workerPodId) {
        const [apiKey, token] = await Promise.all([
          this.runPodCredential.readSecret(),
          this.leaseTokenVault.readSecret(job.workerLeaseId).catch(() => null)
        ])
        if (token) {
          const gateway = this.workerFactory(
            `https://${job.workerPodId}-8000.proxy.runpod.net`,
            token
          )
          await gateway.cancelJob(job.jobId).catch(() => undefined)
        }
        const pod = await this.runPod.getPod(apiKey, job.workerPodId).catch(() => null)
        if (pod) {
          const elapsedEstimate = elapsedProviderEstimate(pod, this.now())
          if (elapsedEstimate > 0) {
            details = this.productionStore.recordElapsedCostEstimate(
              input.projectId,
              input.jobId,
              elapsedEstimate
            )
          }
        }
        await this.runPod.terminatePod(apiKey, job.workerPodId)
        await this.leaseTokenVault.removeSecret(job.workerLeaseId)
        details = this.productionStore.markWorkerClosed(
          input.projectId,
          input.jobId,
          'The cancelled job worker was terminated and closed.'
        )
        return ProductionJobActionResultSchema.parse({
          ok: true,
          details: this.productionStore.transitionJob(
            input.projectId,
            input.jobId,
            'terminated',
            'The RunPod worker was terminated after cancellation.',
            null
          )
        })
      }
      return ProductionJobActionResultSchema.parse({
        ok: true,
        details: this.productionStore.transitionJob(
          input.projectId,
          input.jobId,
          'cancelled',
          'The queued job was cancelled before a worker started.',
          null
        )
      })
    } catch (error) {
      if (error instanceof ProductionStoreError) return resultError(error.code, error.message)
      return resultError(
        'unknown',
        'Cancellation could not be confirmed. Check the worker status before retrying.'
      )
    }
  }
}

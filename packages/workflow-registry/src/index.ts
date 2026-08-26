import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import {
  CostEstimateSchema,
  ProductionJobKindSchema,
  type CostEstimate,
  type ProductionJobKind
} from '@studio/contracts'
import { createUlid } from '@studio/domain'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

export const WorkflowParameterSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-zA-Z0-9]{0,79}$/),
    label: z.string().min(1).max(120),
    type: z.enum(['string', 'integer', 'number', 'boolean']),
    required: z.boolean(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    maximumLength: z.number().int().positive().optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional()
  })
  .strict()
export type WorkflowParameter = z.infer<typeof WorkflowParameterSchema>

export const WorkflowDefinitionSchema = z
  .object({
    workflowId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    label: z.string().min(2).max(160),
    jobKind: ProductionJobKindSchema,
    engine: z.enum(['comfyui', 'worker-python', 'local-ffmpeg', 'local-package']),
    qualificationState: z.enum(['candidate', 'qualified', 'retired']),
    qualificationTier: z.enum(['core', 'advanced']).default('core'),
    minimumVramGb: z.number().int().nonnegative(),
    expectedRuntimeMinutes: z.number().int().positive(),
    maximumRuntimeMinutes: z.number().int().positive(),
    outputKind: z.enum(['image', 'audio', 'video', 'document', 'package']),
    templatePath: z.string().min(1).nullable(),
    templateSha256: Sha256Schema.nullable(),
    allowedNodeTypes: z.array(z.string().min(1)).max(100),
    requiredModels: z
      .array(
        z
          .object({
            modelId: z.string().min(1).max(240),
            relativePath: z.string().min(1).max(500),
            sha256: Sha256Schema.nullable(),
            licenseReview: z.enum(['required', 'accepted'])
          })
          .strict()
      )
      .max(30),
    parameters: z.array(WorkflowParameterSchema).max(60),
    notes: z.array(z.string().min(1).max(300)).max(20)
  })
  .strict()
  .superRefine((value, context) => {
    if (value.maximumRuntimeMinutes < value.expectedRuntimeMinutes) {
      context.addIssue({
        code: 'custom',
        path: ['maximumRuntimeMinutes'],
        message: 'Maximum runtime must not be below expected runtime.'
      })
    }
    if (value.qualificationState === 'qualified') {
      if (value.engine === 'comfyui' && !value.templateSha256) {
        context.addIssue({
          code: 'custom',
          path: ['templateSha256'],
          message: 'Qualified workflow needs a template hash.'
        })
      }
      value.requiredModels.forEach((model, index) => {
        if (!model.sha256 || model.licenseReview !== 'accepted') {
          context.addIssue({
            code: 'custom',
            path: ['requiredModels', index],
            message: 'Qualified workflow needs a reviewed license and model hash.'
          })
        }
      })
    }
  })
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const WorkflowPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    packId: z.string().min(1),
    packVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/),
    comfyUiCommit: z.string().regex(/^[a-f0-9]{40}$/),
    workerImage: z.string().min(1),
    workerImageDigest: Sha256Schema.nullable(),
    workflows: z.array(WorkflowDefinitionSchema).min(1)
  })
  .strict()
export type WorkflowPack = z.infer<typeof WorkflowPackSchema>

export const CapabilityReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    workerRelease: z.string().min(1),
    workerImageDigest: Sha256Schema,
    workflowPackFingerprint: Sha256Schema,
    comfyUiCommit: z.string().regex(/^[a-f0-9]{40}$/),
    gpuName: z.string().min(1),
    vramGb: z.number().positive(),
    gpuClassVramGb: z.number().positive().optional(),
    freeDiskGb: z.number().nonnegative(),
    pythonVersion: z.string().min(1),
    cudaVersion: z.string().min(1),
    nvidiaDriverVersion: z.string().min(1).default('unavailable'),
    latentsyncPythonVersion: z.string().min(1).default('unavailable'),
    ltxTrainerPythonVersion: z.string().min(1).default('unavailable'),
    ltxTrainerTorchVersion: z.string().min(1).default('unavailable'),
    ltxTrainerCudaVersion: z.string().min(1).default('unavailable'),
    installedNodeTypes: z.array(z.string().min(1)),
    modelHashes: z.record(z.string(), Sha256Schema),
    workflowHashes: z.record(z.string(), Sha256Schema),
    smokeTestPassed: z.boolean(),
    checkedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type CapabilityReport = z.infer<typeof CapabilityReportSchema>

export interface WorkflowQualification {
  ready: boolean
  blockers: string[]
}

export interface CompiledWorkflow {
  workflowId: string
  workflowVersion: string
  workflowSha256: string
  prompt: Record<string, unknown>
}

export class WorkflowRegistryError extends Error {
  constructor(
    readonly code:
      | 'unknown-workflow'
      | 'not-qualified'
      | 'invalid-parameter'
      | 'integrity-failed'
      | 'capability-mismatch',
    message: string
  ) {
    super(message)
    this.name = 'WorkflowRegistryError'
  }
}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function workflowPackFingerprint(pack: WorkflowPack): string {
  return hash(stableJson({ ...pack, workerImageDigest: null }))
}

function validateParameter(
  parameter: WorkflowParameter,
  value: unknown
): string | number | boolean {
  if (parameter.type === 'string') {
    const parsed = z.string().parse(value)
    if (parameter.maximumLength && parsed.length > parameter.maximumLength) {
      throw new WorkflowRegistryError('invalid-parameter', `${parameter.label} is too long.`)
    }
    return parsed
  }
  if (parameter.type === 'boolean') return z.boolean().parse(value)
  const number =
    parameter.type === 'integer' ? z.number().int().parse(value) : z.number().finite().parse(value)
  if (parameter.minimum !== undefined && number < parameter.minimum) {
    throw new WorkflowRegistryError(
      'invalid-parameter',
      `${parameter.label} is below its safe minimum.`
    )
  }
  if (parameter.maximum !== undefined && number > parameter.maximum) {
    throw new WorkflowRegistryError(
      'invalid-parameter',
      `${parameter.label} is above its safe maximum.`
    )
  }
  return number
}

function substitute(
  value: unknown,
  parameters: Record<string, string | number | boolean>
): unknown {
  if (Array.isArray(value)) return value.map((item) => substitute(item, parameters))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        substitute(item, parameters)
      ])
    )
  }
  if (typeof value === 'string' && value.startsWith('$PARAM:')) {
    const key = value.slice('$PARAM:'.length)
    if (!(key in parameters)) {
      throw new WorkflowRegistryError(
        'invalid-parameter',
        `The workflow parameter “${key}” is missing.`
      )
    }
    return parameters[key]
  }
  return value
}

export class WorkflowRegistry {
  private readonly pack: WorkflowPack
  private readonly rootPath: string

  constructor(packPath: string) {
    this.rootPath = resolve(packPath, '..')
    this.pack = WorkflowPackSchema.parse(JSON.parse(readFileSync(packPath, 'utf8')))
  }

  list(kind?: ProductionJobKind): WorkflowDefinition[] {
    return this.pack.workflows
      .filter((workflow) => !kind || workflow.jobKind === kind)
      .map((workflow) => ({ ...workflow }))
  }

  runtime(): Pick<
    WorkflowPack,
    'packId' | 'packVersion' | 'workerImage' | 'workerImageDigest' | 'comfyUiCommit'
  > {
    return {
      packId: this.pack.packId,
      packVersion: this.pack.packVersion,
      workerImage: this.pack.workerImage,
      workerImageDigest: this.pack.workerImageDigest,
      comfyUiCommit: this.pack.comfyUiCommit
    }
  }

  fingerprint(): string {
    return workflowPackFingerprint(this.pack)
  }

  get(workflowId: string, version: string): WorkflowDefinition {
    const workflow = this.pack.workflows.find(
      (candidate) => candidate.workflowId === workflowId && candidate.version === version
    )
    if (!workflow) {
      throw new WorkflowRegistryError(
        'unknown-workflow',
        'That production workflow is not in the approved registry.'
      )
    }
    return workflow
  }

  qualify(
    workflowId: string,
    version: string,
    unknownReport: CapabilityReport
  ): WorkflowQualification {
    const workflow = this.get(workflowId, version)
    const report = CapabilityReportSchema.parse(unknownReport)
    const blockers: string[] = []
    if (workflow.qualificationState !== 'qualified')
      blockers.push('This workflow candidate has not passed the locked benchmark pack.')
    if (!this.pack.workerImageDigest || report.workerImageDigest !== this.pack.workerImageDigest)
      blockers.push('The worker image does not match the approved digest.')
    if (report.workflowPackFingerprint !== workflowPackFingerprint(this.pack))
      blockers.push('The worker workflow pack does not match the approved production pack.')
    if (report.comfyUiCommit !== this.pack.comfyUiCommit)
      blockers.push('ComfyUI does not match the approved commit.')
    if ((report.gpuClassVramGb ?? report.vramGb) < workflow.minimumVramGb)
      blockers.push(`This workflow needs at least ${workflow.minimumVramGb} GB of GPU memory.`)
    if (!report.smokeTestPassed) blockers.push('The worker smoke test has not passed.')
    for (const nodeType of workflow.allowedNodeTypes) {
      if (!report.installedNodeTypes.includes(nodeType))
        blockers.push(`Required worker node is missing: ${nodeType}.`)
    }
    for (const model of workflow.requiredModels) {
      if (!model.sha256 || report.modelHashes[model.modelId] !== model.sha256)
        blockers.push(`Model is missing or unverified: ${model.modelId}.`)
    }
    if (workflow.templateSha256) {
      const key = `${workflow.workflowId}@${workflow.version}`
      if (report.workflowHashes[key] !== workflow.templateSha256)
        blockers.push('The worker workflow file does not match the approved hash.')
    }
    return { ready: blockers.length === 0, blockers: [...new Set(blockers)] }
  }

  compile(
    workflowId: string,
    version: string,
    unknownParameters: Record<string, unknown>,
    options: { allowCandidate?: boolean } = {}
  ): CompiledWorkflow {
    const workflow = this.get(workflowId, version)
    if (workflow.engine !== 'comfyui' || !workflow.templatePath || !workflow.templateSha256) {
      throw new WorkflowRegistryError(
        'not-qualified',
        'That workflow has no verified ComfyUI template.'
      )
    }
    if (workflow.qualificationState !== 'qualified' && !options.allowCandidate) {
      throw new WorkflowRegistryError(
        'not-qualified',
        'That workflow is still a candidate and cannot spend GPU time.'
      )
    }
    const declared = new Set(workflow.parameters.map((parameter) => parameter.key))
    for (const key of Object.keys(unknownParameters)) {
      if (!declared.has(key))
        throw new WorkflowRegistryError('invalid-parameter', `Unknown workflow setting: ${key}.`)
    }
    const parameters: Record<string, string | number | boolean> = {}
    for (const parameter of workflow.parameters) {
      const value = unknownParameters[parameter.key] ?? parameter.defaultValue
      if (value === undefined) {
        if (parameter.required)
          throw new WorkflowRegistryError('invalid-parameter', `${parameter.label} is required.`)
        continue
      }
      parameters[parameter.key] = validateParameter(parameter, value)
    }
    const templatePath = resolve(this.rootPath, workflow.templatePath)
    const source = readFileSync(templatePath)
    if (hash(source) !== workflow.templateSha256) {
      throw new WorkflowRegistryError(
        'integrity-failed',
        'The workflow template failed its integrity check.'
      )
    }
    const prompt = substitute(JSON.parse(source.toString('utf8')), parameters) as Record<
      string,
      unknown
    >
    const usedNodeTypes = new Set(
      Object.values(prompt)
        .filter((node): node is Record<string, unknown> =>
          Boolean(node && typeof node === 'object')
        )
        .map((node) => node.class_type)
        .filter((node): node is string => typeof node === 'string')
    )
    for (const node of usedNodeTypes) {
      if (!workflow.allowedNodeTypes.includes(node)) {
        throw new WorkflowRegistryError(
          'integrity-failed',
          `Workflow contains an unapproved node: ${node}.`
        )
      }
    }
    return {
      workflowId,
      workflowVersion: version,
      workflowSha256: hash(stableJson(prompt)),
      prompt
    }
  }

  estimate(
    workflowId: string,
    version: string,
    hourlyRateUsdPerGpu: number,
    gpuCount: number,
    guardrailMaximumMinutes: number,
    now = new Date()
  ): CostEstimate {
    const workflow = this.get(workflowId, version)
    const safeRate = z.number().nonnegative().parse(hourlyRateUsdPerGpu)
    const safeGpuCount = z.number().int().min(0).max(3).parse(gpuCount)
    const maximumRuntimeMinutes = Math.min(workflow.maximumRuntimeMinutes, guardrailMaximumMinutes)
    const expectedComputeUsd = (workflow.expectedRuntimeMinutes / 60) * safeRate * safeGpuCount
    const maximumComputeUsd = (maximumRuntimeMinutes / 60) * safeRate * safeGpuCount
    return CostEstimateSchema.parse({
      estimateId: createUlid(now.getTime()),
      currency: 'USD',
      gpuCount: safeGpuCount,
      hourlyRateUsdPerGpu: safeRate,
      expectedRuntimeMinutes: workflow.expectedRuntimeMinutes,
      maximumRuntimeMinutes,
      expectedComputeUsd,
      maximumComputeUsd,
      storageUsd: 0,
      providerExtrasUsd: 0,
      expectedTotalUsd: expectedComputeUsd,
      maximumTotalUsd: maximumComputeUsd,
      explanation: [
        `${safeGpuCount} GPU${safeGpuCount === 1 ? '' : 's'} at $${safeRate.toFixed(2)} per GPU-hour.`,
        `Expected ${workflow.expectedRuntimeMinutes} minutes; hard limit ${maximumRuntimeMinutes} minutes.`,
        'Storage and transfer are shown separately when a persistent volume is selected.'
      ],
      priceSource: 'RunPod catalogue snapshot selected in the studio',
      pricedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString()
    })
  }
}

export function idempotencyKey(value: unknown): string {
  return hash(stableJson(value))
}

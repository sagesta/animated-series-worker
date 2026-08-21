import { z } from 'zod'

export const ProjectTypeSchema = z.enum(['series', 'film'])
export type ProjectType = z.infer<typeof ProjectTypeSchema>

export const ProjectStatusSchema = z.enum([
  'development',
  'production',
  'paused',
  'completed',
  'archived'
])
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>

export const VisualDirectionSchema = z.enum(['2d', '3d-look', 'mixed', 'undecided'])
export type VisualDirection = z.infer<typeof VisualDirectionSchema>

export const SourceModeSchema = z.enum([
  'original',
  'source-document',
  'upstream-import',
  'existing-studio'
])
export type SourceMode = z.infer<typeof SourceModeSchema>

export const UlidSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'The project identity is not valid.')

export const ProjectCodeSchema = z
  .string()
  .min(1)
  .max(24)
  .regex(
    /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
    'Use letters, numbers, and single dashes for the short code.'
  )

export const CreateProjectInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Enter a production title.').max(120),
    code: z.string().trim().max(24).optional(),
    type: ProjectTypeSchema,
    language: z.string().trim().min(2, 'Enter a primary language.').max(40),
    targetDurationMinutes: z
      .number()
      .int()
      .min(1, 'Duration must be at least one minute.')
      .max(240, 'Duration must be four hours or less.'),
    visualDirection: VisualDirectionSchema,
    sourceMode: SourceModeSchema,
    pilotBrief: z.string().trim().max(4000).optional().default('')
  })
  .strict()
export type CreateProjectInput = z.input<typeof CreateProjectInputSchema>
export type ParsedCreateProjectInput = z.output<typeof CreateProjectInputSchema>

export const ProjectManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: UlidSchema,
    code: ProjectCodeSchema,
    type: ProjectTypeSchema,
    title: z.string().min(2).max(120),
    status: ProjectStatusSchema,
    language: z.string().min(2).max(40),
    targetDurationMinutes: z.number().int().min(1).max(240),
    visualDirection: VisualDirectionSchema,
    sourceMode: SourceModeSchema,
    pilotBrief: z.string().max(4000),
    deliveryProfileId: z.string().min(1),
    budgetPolicyId: z.string().min(1),
    folderName: z.string().min(1).max(100),
    cloudGpuState: z.literal('not-configured'),
    safeCheckpoint: z.object({
      label: z.string().min(1).max(120),
      createdAt: z.string().datetime({ offset: true })
    }),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ProjectManifest = z.infer<typeof ProjectManifestSchema>

export const ProjectSummarySchema = z
  .object({
    id: UlidSchema,
    code: ProjectCodeSchema,
    title: z.string(),
    type: ProjectTypeSchema,
    status: ProjectStatusSchema,
    targetDurationMinutes: z.number().int(),
    visualDirection: VisualDirectionSchema,
    safeCheckpointAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    workspacePath: z.string()
  })
  .strict()
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>

export const ProjectDetailsSchema = z
  .object({
    manifest: ProjectManifestSchema,
    workspacePath: z.string()
  })
  .strict()
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'The file checksum is not valid.')

export const ProjectBackupFileSchema = z
  .object({
    relativePath: z
      .string()
      .min(1)
      .max(512)
      .regex(
        /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+$/,
        'The backup contains an unsafe file path.'
      ),
    byteSize: z.number().int().nonnegative(),
    sha256: Sha256Schema
  })
  .strict()
export type ProjectBackupFile = z.infer<typeof ProjectBackupFileSchema>

export const ProjectBackupManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    backupId: UlidSchema,
    projectId: UlidSchema,
    projectCode: ProjectCodeSchema,
    projectTitle: z.string().min(2).max(120),
    projectFolderName: z.string().min(1).max(100),
    projectManifestSha256: Sha256Schema,
    studioVersion: z.string().min(1).max(80),
    createdAt: z.string().datetime({ offset: true }),
    fileCount: z.number().int().positive(),
    totalBytes: z.number().int().nonnegative(),
    files: ProjectBackupFileSchema.array().min(1).max(250_000)
  })
  .strict()
export type ProjectBackupManifest = z.infer<typeof ProjectBackupManifestSchema>

export const ProjectBackupSummarySchema = z
  .object({
    backupId: UlidSchema,
    projectId: UlidSchema,
    projectCode: ProjectCodeSchema,
    projectTitle: z.string().min(2).max(120),
    createdAt: z.string().datetime({ offset: true }),
    fileCount: z.number().int().positive(),
    totalBytes: z.number().int().nonnegative(),
    backupPath: z.string().min(1),
    verificationState: z.literal('verified')
  })
  .strict()
export type ProjectBackupSummary = z.infer<typeof ProjectBackupSummarySchema>

export const ProjectRestoreResultSchema = z
  .object({
    backupId: UlidSchema,
    restoredAt: z.string().datetime({ offset: true }),
    project: ProjectDetailsSchema
  })
  .strict()
export type ProjectRestoreResult = z.infer<typeof ProjectRestoreResultSchema>

export const SupportContextValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null()
])

export const SupportEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.string().uuid(),
    correlationId: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }),
    level: z.enum(['info', 'warning', 'error']),
    area: z.enum(['application', 'project', 'backup', 'cloud', 'security', 'renderer']),
    eventName: z
      .string()
      .regex(/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)*$/)
      .max(100),
    message: z.string().min(1).max(500),
    context: z.record(z.string().min(1).max(80), SupportContextValueSchema).default({})
  })
  .strict()
export type SupportEvent = z.infer<typeof SupportEventSchema>

export const RendererErrorInputSchema = z
  .object({
    message: z.string().min(1).max(500),
    componentStack: z.string().max(4_000).optional()
  })
  .strict()
export type RendererErrorInput = z.infer<typeof RendererErrorInputSchema>

export const SupportBundleSummarySchema = z
  .object({
    bundleId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    eventCount: z.number().int().nonnegative(),
    bundlePath: z.string().min(1),
    redactionState: z.literal('passed')
  })
  .strict()
export type SupportBundleSummary = z.infer<typeof SupportBundleSummarySchema>

export const SystemStatusSchema = z
  .object({
    appVersion: z.string(),
    electronVersion: z.string(),
    nodeVersion: z.string(),
    storagePath: z.string(),
    indexedProjects: z.number().int().nonnegative(),
    catalogState: z.literal('ready'),
    cloudGpuState: z.enum(['not-configured', 'account-connected', 'attention']),
    generationState: z.literal('locked'),
    generationReason: z.string()
  })
  .strict()
export type SystemStatus = z.infer<typeof SystemStatusSchema>

export const RunPodApiKeySchema = z
  .string()
  .trim()
  .min(20, 'Paste the complete RunPod API key.')
  .max(512, 'That API key is longer than expected.')
  .regex(/^\S+$/, 'The API key cannot contain spaces or line breaks.')

export const CloudGuardrailsSchema = z
  .object({
    maxSessionCostUsd: z
      .number()
      .min(1, 'The session limit must be at least $1.')
      .max(1000, 'The session limit must be $1,000 or less.'),
    maxRuntimeMinutes: z
      .number()
      .int()
      .min(15, 'Maximum runtime must be at least 15 minutes.')
      .max(1440, 'Maximum runtime must be 24 hours or less.'),
    idleTimeoutMinutes: z
      .number()
      .int()
      .min(2, 'Idle shutdown must be at least 2 minutes.')
      .max(60, 'Idle shutdown must be 60 minutes or less.'),
    maxConcurrentGpus: z
      .number()
      .int()
      .min(1, 'At least one GPU must be allowed.')
      .max(3, 'Version 1 supports no more than three GPUs.')
  })
  .strict()
export type CloudGuardrails = z.infer<typeof CloudGuardrailsSchema>

export const DEFAULT_CLOUD_GUARDRAILS: CloudGuardrails = Object.freeze({
  maxSessionCostUsd: 10,
  maxRuntimeMinutes: 120,
  idleTimeoutMinutes: 10,
  maxConcurrentGpus: 1
})

export const CloudConnectInputSchema = z
  .object({
    apiKey: RunPodApiKeySchema
  })
  .strict()
export type CloudConnectInput = z.infer<typeof CloudConnectInputSchema>

export const CloudGpuOptionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    memoryGb: z.number().int().positive(),
    secureHourlyUsd: z.number().nonnegative().nullable(),
    communityHourlyUsd: z.number().nonnegative().nullable(),
    ltxCompatibility: z.enum(['below-baseline', 'meets-baseline'])
  })
  .strict()
export type CloudGpuOption = z.infer<typeof CloudGpuOptionSchema>

export const CloudAccountSnapshotSchema = z
  .object({
    checkedAt: z.string().datetime({ offset: true }),
    totalPods: z.number().int().nonnegative(),
    activePods: z.number().int().nonnegative(),
    activeHourlyCostUsd: z.number().nonnegative()
  })
  .strict()
export type CloudAccountSnapshot = z.infer<typeof CloudAccountSnapshotSchema>

export const CloudSetupChecklistSchema = z
  .object({
    accountConnected: z.boolean(),
    guardrailsSaved: z.boolean(),
    modelStorageReady: z.literal(false),
    workerImageReady: z.literal(false),
    automaticShutdownTested: z.literal(false)
  })
  .strict()

export const CloudConnectionStatusSchema = z
  .object({
    provider: z.literal('runpod'),
    connectionState: z.enum(['not-configured', 'connected', 'attention']),
    credentialStored: z.boolean(),
    guardrails: CloudGuardrailsSchema,
    guardrailsSaved: z.boolean(),
    account: CloudAccountSnapshotSchema.nullable(),
    gpuCatalogCheckedAt: z.string().datetime({ offset: true }).nullable(),
    gpuOptions: CloudGpuOptionSchema.array().max(12),
    catalogMessage: z.string().nullable(),
    validationCostUsd: z.literal(0),
    setupChecklist: CloudSetupChecklistSchema,
    generationState: z.literal('locked'),
    generationReason: z.string()
  })
  .strict()
export type CloudConnectionStatus = z.infer<typeof CloudConnectionStatusSchema>

export const CloudErrorCodeSchema = z.enum([
  'invalid-key',
  'insufficient-permissions',
  'timed-out',
  'rate-limited',
  'provider-unavailable',
  'invalid-response',
  'secure-storage-unavailable',
  'secure-storage-error',
  'settings-error',
  'not-connected',
  'invalid-input',
  'unknown'
])
export type CloudErrorCode = z.infer<typeof CloudErrorCodeSchema>

export const CloudActionResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      status: CloudConnectionStatusSchema
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: CloudErrorCodeSchema,
          message: z.string().min(1)
        })
        .strict()
    })
    .strict()
])
export type CloudActionResult = z.infer<typeof CloudActionResultSchema>

export const IPC_CHANNELS = {
  systemGetStatus: 'studio:system:get-status',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsOpen: 'studio:projects:open',
  projectsListBackups: 'studio:projects:list-backups',
  projectsBackup: 'studio:projects:backup',
  projectsRestore: 'studio:projects:restore',
  supportRecordRendererError: 'studio:support:record-renderer-error',
  supportCreateBundle: 'studio:support:create-bundle',
  cloudGetStatus: 'studio:cloud:get-status',
  cloudConnect: 'studio:cloud:connect',
  cloudRefresh: 'studio:cloud:refresh',
  cloudDisconnect: 'studio:cloud:disconnect',
  cloudSaveGuardrails: 'studio:cloud:save-guardrails'
} as const

export interface StudioApi {
  system: {
    getStatus(): Promise<SystemStatus>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(input: CreateProjectInput): Promise<ProjectDetails>
    open(projectId: string): Promise<ProjectDetails>
    listBackups(): Promise<ProjectBackupSummary[]>
    backup(projectId: string): Promise<ProjectBackupSummary>
    restore(backupId: string): Promise<ProjectRestoreResult>
  }
  support: {
    recordRendererError(input: RendererErrorInput): Promise<void>
    createBundle(): Promise<SupportBundleSummary>
  }
  cloud: {
    getStatus(): Promise<CloudConnectionStatus>
    connect(input: CloudConnectInput): Promise<CloudActionResult>
    refresh(): Promise<CloudActionResult>
    disconnect(): Promise<CloudActionResult>
    saveGuardrails(guardrails: CloudGuardrails): Promise<CloudActionResult>
  }
}

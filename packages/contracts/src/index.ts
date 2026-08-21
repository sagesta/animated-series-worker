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

const ProjectManifestFields = {
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
}

export const ProjectManifestV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    ...ProjectManifestFields
  })
  .strict()
export type ProjectManifestV1 = z.infer<typeof ProjectManifestV1Schema>

export const ProjectPreArchiveStatusSchema = z.enum([
  'development',
  'production',
  'paused',
  'completed'
])

export const ProjectLifecycleSchema = z
  .object({
    archivedAt: z.string().datetime({ offset: true }).nullable(),
    statusBeforeArchive: ProjectPreArchiveStatusSchema.nullable()
  })
  .strict()
export type ProjectLifecycle = z.infer<typeof ProjectLifecycleSchema>

export const ProjectManifestV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    ...ProjectManifestFields,
    lifecycle: ProjectLifecycleSchema
  })
  .strict()
export type ProjectManifestV2 = z.infer<typeof ProjectManifestV2Schema>

export const ProjectManifestSchema = z.discriminatedUnion('schemaVersion', [
  ProjectManifestV1Schema,
  ProjectManifestV2Schema
])
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

export const ProjectMigrationPreviewSchema = z
  .object({
    migrationId: z.literal('project-manifest-v1-to-v2'),
    projectId: UlidSchema,
    projectTitle: z.string().min(2).max(120),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    fromVersion: z.literal(1),
    toVersion: z.literal(2),
    backupRequired: z.literal(true),
    dataLossExpected: z.literal(false),
    filesChanged: z.literal(1),
    changes: z.array(z.string().min(1).max(180)).min(1).max(10)
  })
  .strict()
export type ProjectMigrationPreview = z.infer<typeof ProjectMigrationPreviewSchema>

export const ProjectMigrationInputSchema = z
  .object({
    projectId: UlidSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ProjectMigrationInput = z.infer<typeof ProjectMigrationInputSchema>

export const ProjectMigrationResultSchema = z
  .object({
    migrationId: z.literal('project-manifest-v1-to-v2'),
    migratedAt: z.string().datetime({ offset: true }),
    backup: ProjectBackupSummarySchema,
    project: ProjectDetailsSchema
  })
  .strict()
export type ProjectMigrationResult = z.infer<typeof ProjectMigrationResultSchema>

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
    area: z.enum(['application', 'project', 'backup', 'cloud', 'writing', 'security', 'renderer']),
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

export const WritingProviderSchema = z.enum(['openai', 'anthropic'])
export type WritingProvider = z.infer<typeof WritingProviderSchema>

export const WritingApiKeySchema = z
  .string()
  .trim()
  .min(20, 'Paste the complete API key.')
  .max(512, 'That API key is longer than expected.')
  .regex(/^\S+$/, 'The API key cannot contain spaces or line breaks.')

export const WritingModelOptionSchema = z
  .object({
    id: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200)
  })
  .strict()
export type WritingModelOption = z.infer<typeof WritingModelOptionSchema>

export const WritingProviderConnectionStatusSchema = z
  .object({
    provider: WritingProviderSchema,
    connectionState: z.enum(['not-configured', 'connected', 'disabled', 'attention']),
    credentialStored: z.boolean(),
    enabled: z.boolean(),
    checkedAt: z.string().datetime({ offset: true }).nullable(),
    models: WritingModelOptionSchema.array().max(100),
    validationCostUsd: z.literal(0)
  })
  .strict()
export type WritingProviderConnectionStatus = z.infer<typeof WritingProviderConnectionStatusSchema>

export const WritingProfileSchema = z.enum(['balanced', 'best-draft', 'custom'])
export type WritingProfile = z.infer<typeof WritingProfileSchema>

export const WritingDefaultProfileSchema = z
  .object({
    provider: WritingProviderSchema,
    model: z.string().min(1).max(200),
    profile: WritingProfileSchema
  })
  .strict()
export type WritingDefaultProfile = z.infer<typeof WritingDefaultProfileSchema>

export const WritingSettingsStatusSchema = z
  .object({
    providers: z
      .object({
        openai: WritingProviderConnectionStatusSchema,
        anthropic: WritingProviderConnectionStatusSchema
      })
      .strict(),
    defaultProfile: WritingDefaultProfileSchema.nullable(),
    paidDraftsRequireConfirmation: z.literal(true)
  })
  .strict()
export type WritingSettingsStatus = z.infer<typeof WritingSettingsStatusSchema>

export const WritingConnectInputSchema = z
  .object({
    provider: WritingProviderSchema,
    apiKey: WritingApiKeySchema
  })
  .strict()
export type WritingConnectInput = z.infer<typeof WritingConnectInputSchema>

export const WritingProviderInputSchema = z.object({ provider: WritingProviderSchema }).strict()
export type WritingProviderInput = z.infer<typeof WritingProviderInputSchema>

export const WritingProviderEnabledInputSchema = z
  .object({
    provider: WritingProviderSchema,
    enabled: z.boolean()
  })
  .strict()
export type WritingProviderEnabledInput = z.infer<typeof WritingProviderEnabledInputSchema>

export const WritingTaskKindSchema = z.enum([
  'develop_character',
  'build_world',
  'outline_episode',
  'draft_scene',
  'rewrite_dialogue',
  'check_continuity'
])
export type WritingTaskKind = z.infer<typeof WritingTaskKindSchema>

export const WritingContextSelectionSchema = z
  .object({
    includeProjectBrief: z.boolean(),
    includeProductionSettings: z.boolean()
  })
  .strict()
export type WritingContextSelection = z.infer<typeof WritingContextSelectionSchema>

export const CreativeDraftSectionSchema = z
  .object({
    heading: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(20_000)
  })
  .strict()

export const CreativeDraftContentSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(4_000),
    sections: CreativeDraftSectionSchema.array().min(1).max(20),
    continuityQuestions: z.array(z.string().trim().min(1).max(500)).max(20),
    suggestedNextSteps: z.array(z.string().trim().min(1).max(500)).max(20)
  })
  .strict()
export type CreativeDraftContent = z.infer<typeof CreativeDraftContentSchema>

export const WritingDraftRequestSchema = z
  .object({
    projectId: UlidSchema,
    taskKind: WritingTaskKindSchema,
    instruction: z
      .string()
      .trim()
      .min(10, 'Describe what you want the writing assistant to help with.')
      .max(12_000),
    context: WritingContextSelectionSchema,
    provider: WritingProviderSchema,
    model: z.string().trim().min(1).max(200),
    profile: WritingProfileSchema,
    maxOutputTokens: z.number().int().min(256).max(4_000),
    paidConfirmed: z.literal(true)
  })
  .strict()
export type WritingDraftRequest = z.infer<typeof WritingDraftRequestSchema>

export const WritingUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    cachedInputTokens: z.number().int().nonnegative()
  })
  .strict()
export type WritingUsage = z.infer<typeof WritingUsageSchema>

export const WritingProviderDraftInputSchema = z
  .object({
    model: z.string().min(1).max(200),
    systemInstruction: z.string().min(1).max(12_000),
    userPrompt: z.string().min(1).max(30_000),
    maxOutputTokens: z.number().int().min(256).max(4_000)
  })
  .strict()
export type WritingProviderDraftInput = z.infer<typeof WritingProviderDraftInputSchema>

export const WritingProviderDraftResponseSchema = z
  .object({
    output: CreativeDraftContentSchema,
    usage: WritingUsageSchema,
    requestId: z.string().min(1).max(240)
  })
  .strict()
export type WritingProviderDraftResponse = z.infer<typeof WritingProviderDraftResponseSchema>

export interface WritingTextProvider {
  listModels(apiKey: string): Promise<WritingModelOption[]>
  generateDraft(
    apiKey: string,
    input: WritingProviderDraftInput
  ): Promise<WritingProviderDraftResponse>
}

export const CREATIVE_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'sections', 'continuityQuestions', 'suggestedNextSteps'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['heading', 'body'],
        properties: {
          heading: { type: 'string' },
          body: { type: 'string' }
        }
      }
    },
    continuityQuestions: { type: 'array', items: { type: 'string' } },
    suggestedNextSteps: { type: 'array', items: { type: 'string' } }
  }
} as const

export const WritingContextPreviewInputSchema = z
  .object({
    projectId: UlidSchema,
    context: WritingContextSelectionSchema
  })
  .strict()
export type WritingContextPreviewInput = z.infer<typeof WritingContextPreviewInputSchema>

export const WritingSourceVersionSchema = z
  .object({
    kind: z.literal('project-manifest'),
    id: UlidSchema,
    schemaVersion: z.number().int().positive(),
    updatedAt: z.string().datetime({ offset: true }),
    sha256: Sha256Schema
  })
  .strict()
export type WritingSourceVersion = z.infer<typeof WritingSourceVersionSchema>

export const WritingContextPreviewSchema = z
  .object({
    text: z.string().min(1).max(20_000),
    sha256: Sha256Schema,
    sourceVersions: WritingSourceVersionSchema.array().length(1)
  })
  .strict()
export type WritingContextPreview = z.infer<typeof WritingContextPreviewSchema>

export const WritingDraftRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    draftId: UlidSchema,
    projectId: UlidSchema,
    taskKind: WritingTaskKindSchema,
    status: z.literal('proposal'),
    provider: WritingProviderSchema,
    model: z.string().min(1).max(200),
    profile: WritingProfileSchema,
    createdAt: z.string().datetime({ offset: true }),
    instruction: z.string().min(10).max(12_000),
    contextSelection: WritingContextSelectionSchema,
    contextSnapshotSha256: Sha256Schema,
    sourceVersions: WritingSourceVersionSchema.array().length(1),
    output: CreativeDraftContentSchema,
    usage: WritingUsageSchema,
    cost: z
      .object({
        currency: z.literal('USD'),
        estimatedUsd: z.number().nonnegative().nullable(),
        actualUsd: z.number().nonnegative().nullable(),
        state: z.literal('not-calculated')
      })
      .strict(),
    providerRequestId: z.string().min(1).max(240),
    skillsPlanned: z.array(z.never()).length(0),
    skillsUsed: z.array(z.never()).length(0)
  })
  .strict()
export type WritingDraftRecord = z.infer<typeof WritingDraftRecordSchema>

export const WritingErrorCodeSchema = z.enum([
  'invalid-key',
  'insufficient-permissions',
  'timed-out',
  'rate-limited',
  'provider-unavailable',
  'invalid-response',
  'unsupported-model',
  'secure-storage-unavailable',
  'secure-storage-error',
  'settings-error',
  'not-connected',
  'disabled',
  'invalid-input',
  'project-error',
  'unknown'
])
export type WritingErrorCode = z.infer<typeof WritingErrorCodeSchema>

const WritingActionErrorSchema = z
  .object({
    code: WritingErrorCodeSchema,
    message: z.string().min(1).max(600)
  })
  .strict()

export const WritingSettingsActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), status: WritingSettingsStatusSchema }).strict(),
  z.object({ ok: z.literal(false), error: WritingActionErrorSchema }).strict()
])
export type WritingSettingsActionResult = z.infer<typeof WritingSettingsActionResultSchema>

export const WritingDraftActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), draft: WritingDraftRecordSchema }).strict(),
  z.object({ ok: z.literal(false), error: WritingActionErrorSchema }).strict()
])
export type WritingDraftActionResult = z.infer<typeof WritingDraftActionResultSchema>

export const IPC_CHANNELS = {
  systemGetStatus: 'studio:system:get-status',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsOpen: 'studio:projects:open',
  projectsListBackups: 'studio:projects:list-backups',
  projectsBackup: 'studio:projects:backup',
  projectsRestore: 'studio:projects:restore',
  projectsGetMigrationPreview: 'studio:projects:get-migration-preview',
  projectsMigrate: 'studio:projects:migrate',
  supportRecordRendererError: 'studio:support:record-renderer-error',
  supportCreateBundle: 'studio:support:create-bundle',
  cloudGetStatus: 'studio:cloud:get-status',
  cloudConnect: 'studio:cloud:connect',
  cloudRefresh: 'studio:cloud:refresh',
  cloudDisconnect: 'studio:cloud:disconnect',
  cloudSaveGuardrails: 'studio:cloud:save-guardrails',
  writingGetStatus: 'studio:writing:get-status',
  writingConnect: 'studio:writing:connect',
  writingRefresh: 'studio:writing:refresh',
  writingDisconnect: 'studio:writing:disconnect',
  writingSetEnabled: 'studio:writing:set-enabled',
  writingSaveDefaultProfile: 'studio:writing:save-default-profile',
  writingPreviewContext: 'studio:writing:preview-context',
  writingGenerateDraft: 'studio:writing:generate-draft',
  writingListDrafts: 'studio:writing:list-drafts'
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
    getMigrationPreview(projectId: string): Promise<ProjectMigrationPreview | null>
    migrate(input: ProjectMigrationInput): Promise<ProjectMigrationResult>
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
  writing: {
    getStatus(): Promise<WritingSettingsStatus>
    connect(input: WritingConnectInput): Promise<WritingSettingsActionResult>
    refresh(input: WritingProviderInput): Promise<WritingSettingsActionResult>
    disconnect(input: WritingProviderInput): Promise<WritingSettingsActionResult>
    setEnabled(input: WritingProviderEnabledInput): Promise<WritingSettingsActionResult>
    saveDefaultProfile(input: WritingDefaultProfile): Promise<WritingSettingsActionResult>
    previewContext(input: WritingContextPreviewInput): Promise<WritingContextPreview>
    generateDraft(input: WritingDraftRequest): Promise<WritingDraftActionResult>
    listDrafts(projectId: string): Promise<WritingDraftRecord[]>
  }
}

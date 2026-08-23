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

export const AudienceAgeBandSchema = z.enum([
  'all-ages',
  'children',
  'teens',
  'young-adults',
  'adults',
  'mixed',
  'undecided'
])
export type AudienceAgeBand = z.infer<typeof AudienceAgeBandSchema>

const CreativeDirectionListItemSchema = z.string().trim().min(1).max(160)

export const CreativeDirectionInputSchema = z
  .object({
    targetAudience: z.string().trim().min(2, 'Describe who you want to make this for.').max(500),
    ageBand: AudienceAgeBandSchema,
    primaryNiche: z.string().trim().min(2, 'Describe the main niche or subject area.').max(300),
    genres: CreativeDirectionListItemSchema.array().min(1, 'Add at least one genre.').max(8),
    toneKeywords: CreativeDirectionListItemSchema.array()
      .min(1, 'Add at least one tone word.')
      .max(8),
    coreThemes: CreativeDirectionListItemSchema.array().max(10),
    storyPromise: z
      .string()
      .trim()
      .min(10, 'Explain what viewers can consistently expect from this production.')
      .max(1_200),
    culturalSetting: z.string().trim().max(500),
    contentBoundaries: CreativeDirectionListItemSchema.array().max(12),
    episodeFormat: z.string().trim().min(2).max(500),
    youtubePositioning: z.string().trim().max(1_000),
    visualStyleNotes: z.string().trim().max(1_000),
    comparableTitles: CreativeDirectionListItemSchema.array().max(8),
    differentiation: z.string().trim().max(1_000)
  })
  .strict()
export type CreativeDirectionInput = z.infer<typeof CreativeDirectionInputSchema>

export const CreativeDirectionProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: UlidSchema,
    projectId: UlidSchema,
    revision: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    direction: CreativeDirectionInputSchema
  })
  .strict()
export type CreativeDirectionProfile = z.infer<typeof CreativeDirectionProfileSchema>

export const ProjectCreativeDirectionUpdateInputSchema = z
  .object({
    projectId: UlidSchema,
    expectedProfileId: UlidSchema.nullable(),
    direction: CreativeDirectionInputSchema
  })
  .strict()
export type ProjectCreativeDirectionUpdateInput = z.infer<
  typeof ProjectCreativeDirectionUpdateInputSchema
>

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
    pilotBrief: z.string().trim().max(4000).optional().default(''),
    creativeDirection: CreativeDirectionInputSchema
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
    workspacePath: z.string(),
    creativeDirection: CreativeDirectionProfileSchema.nullable()
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
    area: z.enum([
      'application',
      'project',
      'backup',
      'cloud',
      'writing',
      'skill',
      'production',
      'worker',
      'media',
      'export',
      'security',
      'renderer'
    ]),
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
    generationState: z.enum(['locked', 'ready']),
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
    modelStorageReady: z.boolean(),
    workerImageReady: z.boolean(),
    automaticShutdownTested: z.boolean()
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
    generationState: z.enum(['locked', 'ready']),
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

export const WritingProviderSchema = z.enum(['openai', 'anthropic', 'gemini'])
export type WritingProvider = z.infer<typeof WritingProviderSchema>

export const WritingModelPurposeSchema = z.enum(['balanced', 'deep', 'economy'])
export type WritingModelPurpose = z.infer<typeof WritingModelPurposeSchema>

export const WRITING_MODEL_CATALOG = {
  openai: [
    {
      id: 'gpt-5.6-terra',
      displayName: 'GPT-5.6 Terra',
      purpose: 'balanced',
      description: 'Recommended starting point for strong drafts at a balanced cost.'
    },
    {
      id: 'gpt-5.6-sol',
      displayName: 'GPT-5.6 Sol',
      purpose: 'deep',
      description: 'Use for the hardest story, structure, and continuity work.'
    },
    {
      id: 'gpt-5.6-luna',
      displayName: 'GPT-5.6 Luna',
      purpose: 'economy',
      description: 'Use for quick exploration, variations, and lower-cost drafts.'
    }
  ],
  anthropic: [
    {
      id: 'claude-sonnet-5',
      displayName: 'Claude Sonnet 5',
      purpose: 'balanced',
      description: 'Recommended starting point for writing quality and speed.'
    },
    {
      id: 'claude-opus-5',
      displayName: 'Claude Opus 5',
      purpose: 'deep',
      description: 'Use for complex development passes where depth matters most.'
    },
    {
      id: 'claude-haiku-4-5-20251001',
      displayName: 'Claude Haiku 4.5',
      purpose: 'economy',
      description: 'Use for fast, lower-cost ideation and rewrites.'
    }
  ],
  gemini: [
    {
      id: 'gemini-3.7-flash',
      displayName: 'Gemini 3.7 Flash',
      purpose: 'balanced',
      description: 'Recommended Gemini starting point for capable, fast story work.'
    },
    {
      id: 'gemini-3.5-flash-lite',
      displayName: 'Gemini 3.5 Flash-Lite',
      purpose: 'economy',
      description: 'Use for inexpensive variations, summaries, and early exploration.'
    }
  ]
} as const satisfies Record<
  WritingProvider,
  ReadonlyArray<{
    id: string
    displayName: string
    purpose: WritingModelPurpose
    description: string
  }>
>

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
        anthropic: WritingProviderConnectionStatusSchema,
        gemini: WritingProviderConnectionStatusSchema
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
  'design_creative_direction',
  'develop_character',
  'build_world',
  'outline_episode',
  'plan_storyboard',
  'draft_scene',
  'rewrite_dialogue',
  'check_continuity',
  'design_visual_generation',
  'design_voice_performance',
  'plan_motion',
  'plan_advanced_controls',
  'plan_edit_sound',
  'plan_foley',
  'plan_adaptation',
  'plan_thumbnail',
  'analyze_performance',
  'plan_youtube_release'
])
export type WritingTaskKind = z.infer<typeof WritingTaskKindSchema>

export const ExternalSkillPermissionSchema = z.enum([
  'read-project',
  'read-creative-direction',
  'read-writing-history'
])
export type ExternalSkillPermission = z.infer<typeof ExternalSkillPermissionSchema>

export const ExternalSkillSignatureStatusSchema = z.enum(['verified', 'unverified'])
export type ExternalSkillSignatureStatus = z.infer<typeof ExternalSkillSignatureStatusSchema>

export const ExternalSkillExecutionClassSchema = z.literal('declarative')
export type ExternalSkillExecutionClass = z.infer<typeof ExternalSkillExecutionClassSchema>

export const ExternalSkillCompatibilitySchema = z
  .object({
    minStudioVersion: z.string().min(1).max(80).optional(),
    maxStudioVersion: z.string().min(1).max(80).optional()
  })
  .strict()
export type ExternalSkillCompatibility = z.infer<typeof ExternalSkillCompatibilitySchema>

export const ExternalSkillRequiredContextSchema = z.enum([
  'project-brief',
  'production-settings',
  'creative-direction'
])
export type ExternalSkillRequiredContext = z.infer<typeof ExternalSkillRequiredContextSchema>

export const ExternalSkillInputSchemaSchema = z
  .object({
    contract: z.literal('studio-writing-context-v1'),
    requiredContext: ExternalSkillRequiredContextSchema.array().max(3)
  })
  .strict()

export const ExternalSkillOutputSchemaSchema = z
  .object({
    contract: z.literal('studio-creative-draft-v1'),
    minimumSections: z.number().int().min(1).max(20).default(1),
    requiredSectionHeadings: z.string().trim().min(1).max(160).array().max(12)
  })
  .strict()

export const ExternalSkillPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    skillId: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,119}$/, 'Use a lowercase skill ID without spaces.'),
    displayName: z.string().trim().min(2).max(200),
    description: z.string().trim().min(10).max(1_000),
    publisher: z.string().trim().min(2).max(200),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Use a semantic version such as 1.0.0.'),
    source: z.string().min(1).max(240),
    taskKinds: WritingTaskKindSchema.array().min(1).max(20),
    instructionsEntry: z.literal('inline'),
    instructions: z.string().trim().min(20).max(2_000),
    inputSchema: ExternalSkillInputSchemaSchema,
    outputSchema: ExternalSkillOutputSchemaSchema,
    requestedPermissions: ExternalSkillPermissionSchema.array().max(3),
    executionClass: ExternalSkillExecutionClassSchema,
    required: z.boolean(),
    compatibility: ExternalSkillCompatibilitySchema
  })
  .strict()
export type ExternalSkillPackage = z.infer<typeof ExternalSkillPackageSchema>

export const ExternalSkillManifestSchema = ExternalSkillPackageSchema.extend({
  packageSha256: Sha256Schema,
  signatureStatus: ExternalSkillSignatureStatusSchema,
  installedAt: z.string().datetime({ offset: true })
}).strict()
export type ExternalSkillManifest = z.infer<typeof ExternalSkillManifestSchema>

export const ExternalSkillPlanStateSchema = z.enum(['ready', 'incompatible', 'permission-blocked'])
export type ExternalSkillPlanState = z.infer<typeof ExternalSkillPlanStateSchema>

export const ExternalSkillPlanItemSchema = z
  .object({
    skillId: z.string().min(1).max(120),
    displayName: z.string().min(1).max(200),
    version: z.string().min(1).max(64),
    publisher: z.string().min(1).max(200),
    source: z.string().min(1).max(240),
    packageSha256: Sha256Schema,
    signatureStatus: ExternalSkillSignatureStatusSchema,
    executionClass: ExternalSkillExecutionClassSchema,
    taskKind: WritingTaskKindSchema,
    required: z.boolean(),
    requestedPermissions: ExternalSkillPermissionSchema.array().max(3),
    requiredContext: ExternalSkillRequiredContextSchema.array().max(3),
    instructionsSha256: Sha256Schema,
    state: ExternalSkillPlanStateSchema,
    reason: z.string().min(1).max(600)
  })
  .strict()
export type ExternalSkillPlanItem = z.infer<typeof ExternalSkillPlanItemSchema>

export const ExternalSkillPlanPreviewInputSchema = z
  .object({
    projectId: UlidSchema,
    taskKind: WritingTaskKindSchema
  })
  .strict()
export type ExternalSkillPlanPreviewInput = z.infer<typeof ExternalSkillPlanPreviewInputSchema>

export const ExternalSkillPlanPreviewSchema = z
  .object({
    projectId: UlidSchema,
    taskKind: WritingTaskKindSchema,
    planSha256: Sha256Schema,
    required: ExternalSkillPlanItemSchema.array(),
    optional: ExternalSkillPlanItemSchema.array(),
    blockingIssues: z.string().min(1).max(600).array(),
    ready: z.boolean()
  })
  .strict()
export type ExternalSkillPlanPreview = z.infer<typeof ExternalSkillPlanPreviewSchema>

export const ExternalSkillReceiptStatusSchema = z.enum(['succeeded', 'failed'])
export type ExternalSkillReceiptStatus = z.infer<typeof ExternalSkillReceiptStatusSchema>

export const ExternalSkillExecutionReceiptSchema = z
  .object({
    receiptId: UlidSchema,
    skillId: z.string().min(1).max(120),
    displayName: z.string().min(1).max(200),
    skillVersion: z.string().min(1).max(64),
    packageSha256: Sha256Schema,
    executionClass: ExternalSkillExecutionClassSchema,
    taskKind: WritingTaskKindSchema,
    status: ExternalSkillReceiptStatusSchema,
    startedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }),
    durationMs: z.number().int().nonnegative(),
    inputSha256: Sha256Schema,
    outputSha256: Sha256Schema,
    providerRequestId: z.string().min(1).max(240),
    applicationMode: z.literal('provider-instructions'),
    failureReason: z.string().min(1).max(600).nullable()
  })
  .strict()
export type ExternalSkillExecutionReceipt = z.infer<typeof ExternalSkillExecutionReceiptSchema>

export const InstalledExternalSkillSchema = z
  .object({
    manifest: ExternalSkillManifestSchema,
    enabledProjectIds: UlidSchema.array(),
    compatibilityState: z.enum(['compatible', 'incompatible']),
    compatibilityReason: z.string().min(1).max(600)
  })
  .strict()
export type InstalledExternalSkill = z.infer<typeof InstalledExternalSkillSchema>

export const ExternalSkillStatusSchema = z
  .object({
    installed: InstalledExternalSkillSchema.array()
  })
  .strict()
export type ExternalSkillStatus = z.infer<typeof ExternalSkillStatusSchema>

export const ExternalSkillSetProjectEnabledInputSchema = z
  .object({
    skillId: z.string().min(1).max(120),
    projectId: UlidSchema,
    enabled: z.boolean()
  })
  .strict()
export type ExternalSkillSetProjectEnabledInput = z.infer<
  typeof ExternalSkillSetProjectEnabledInputSchema
>

export const ExternalSkillRemoveInputSchema = z
  .object({ skillId: z.string().min(1).max(120) })
  .strict()
export type ExternalSkillRemoveInput = z.infer<typeof ExternalSkillRemoveInputSchema>

export const ExternalSkillErrorCodeSchema = z.enum([
  'cancelled',
  'invalid-package',
  'version-conflict',
  'not-found',
  'incompatible',
  'storage-error',
  'unknown'
])
export type ExternalSkillErrorCode = z.infer<typeof ExternalSkillErrorCodeSchema>

const ExternalSkillActionErrorSchema = z
  .object({
    code: ExternalSkillErrorCodeSchema,
    message: z.string().min(1).max(600)
  })
  .strict()

export const ExternalSkillActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), status: ExternalSkillStatusSchema }).strict(),
  z.object({ ok: z.literal(false), error: ExternalSkillActionErrorSchema }).strict()
])
export type ExternalSkillActionResult = z.infer<typeof ExternalSkillActionResultSchema>

const WritingContextSelectionV1Schema = z
  .object({
    includeProjectBrief: z.boolean(),
    includeProductionSettings: z.boolean()
  })
  .strict()

export const WritingContextSelectionSchema = z
  .object({
    includeProjectBrief: z.boolean(),
    includeProductionSettings: z.boolean(),
    includeCreativeDirection: z.boolean()
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
    skillPlanSha256: Sha256Schema,
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

const WritingManifestSourceVersionSchema = z
  .object({
    kind: z.literal('project-manifest'),
    id: UlidSchema,
    schemaVersion: z.number().int().positive(),
    updatedAt: z.string().datetime({ offset: true }),
    sha256: Sha256Schema
  })
  .strict()

const WritingCreativeDirectionSourceVersionSchema = z
  .object({
    kind: z.literal('creative-direction'),
    id: UlidSchema,
    schemaVersion: z.literal(1),
    revision: z.number().int().positive(),
    updatedAt: z.string().datetime({ offset: true }),
    sha256: Sha256Schema
  })
  .strict()

export const WritingSourceVersionSchema = z.discriminatedUnion('kind', [
  WritingManifestSourceVersionSchema,
  WritingCreativeDirectionSourceVersionSchema
])
export type WritingSourceVersion = z.infer<typeof WritingSourceVersionSchema>

export const WritingContextPreviewSchema = z
  .object({
    text: z.string().min(1).max(20_000),
    sha256: Sha256Schema,
    sourceVersions: WritingSourceVersionSchema.array().min(1).max(2)
  })
  .strict()
export type WritingContextPreview = z.infer<typeof WritingContextPreviewSchema>

const WritingDraftRecordFields = {
  draftId: UlidSchema,
  projectId: UlidSchema,
  taskKind: WritingTaskKindSchema,
  status: z.literal('proposal'),
  provider: WritingProviderSchema,
  model: z.string().min(1).max(200),
  profile: WritingProfileSchema,
  createdAt: z.string().datetime({ offset: true }),
  instruction: z.string().min(10).max(12_000),
  contextSnapshotSha256: Sha256Schema,
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
  providerRequestId: z.string().min(1).max(240)
} as const

const WritingDraftRecordV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    ...WritingDraftRecordFields,
    contextSelection: WritingContextSelectionV1Schema,
    sourceVersions: WritingManifestSourceVersionSchema.array().length(1),
    skillsPlanned: z.array(z.never()).length(0),
    skillsUsed: z.array(z.never()).length(0)
  })
  .strict()

const WritingDraftRecordV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    ...WritingDraftRecordFields,
    contextSelection: WritingContextSelectionSchema,
    sourceVersions: WritingSourceVersionSchema.array().min(1).max(2),
    skillsPlanned: z.array(z.never()).length(0),
    skillsUsed: z.array(z.never()).length(0)
  })
  .strict()

const WritingDraftRecordV3Schema = z
  .object({
    schemaVersion: z.literal(3),
    ...WritingDraftRecordFields,
    contextSelection: WritingContextSelectionSchema,
    sourceVersions: WritingSourceVersionSchema.array().min(1).max(2),
    skillPlanSha256: Sha256Schema,
    skillsPlanned: ExternalSkillPlanItemSchema.array(),
    skillsUsed: ExternalSkillExecutionReceiptSchema.array()
  })
  .strict()

export const WritingDraftRecordSchema = z.discriminatedUnion('schemaVersion', [
  WritingDraftRecordV1Schema,
  WritingDraftRecordV2Schema,
  WritingDraftRecordV3Schema
])
export type WritingDraftRecord = z.infer<typeof WritingDraftRecordSchema>

export const WritingErrorCodeSchema = z.enum([
  'invalid-key',
  'insufficient-permissions',
  'timed-out',
  'rate-limited',
  'provider-unavailable',
  'required-skill-failed',
  'skill-plan-changed',
  'skill-error',
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

export const CanonKindSchema = z.enum([
  'series-bible',
  'character',
  'world',
  'location',
  'prop',
  'visual-style',
  'voice',
  'episode-outline',
  'script',
  'storyboard',
  'release-strategy'
])
export type CanonKind = z.infer<typeof CanonKindSchema>

export const ApprovalDecisionSchema = z
  .object({
    decisionId: UlidSchema,
    projectId: UlidSchema,
    subjectType: z.enum(['canon', 'asset', 'take', 'timeline', 'release-package']),
    subjectId: UlidSchema,
    decision: z.enum(['approved', 'rejected', 'changes-requested']),
    reason: z.string().trim().min(3).max(2_000),
    confirmation: z.literal(true),
    decidedAt: z.string().datetime({ offset: true }),
    contentSha256: Sha256Schema
  })
  .strict()
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>

export const CanonRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    canonId: UlidSchema,
    projectId: UlidSchema,
    kind: CanonKindSchema,
    label: z.string().trim().min(2).max(200),
    revision: z.number().int().positive(),
    state: z.enum(['active', 'superseded']),
    sourceDraftId: UlidSchema,
    sourceDraftSha256: Sha256Schema,
    creativeDirectionProfileId: UlidSchema.nullable(),
    output: CreativeDraftContentSchema,
    outputSha256: Sha256Schema,
    approval: ApprovalDecisionSchema,
    createdAt: z.string().datetime({ offset: true }),
    supersededAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type CanonRecord = z.infer<typeof CanonRecordSchema>

export const PromoteWritingDraftInputSchema = z
  .object({
    projectId: UlidSchema,
    draftId: UlidSchema,
    expectedDraftSha256: Sha256Schema,
    kind: CanonKindSchema,
    label: z.string().trim().min(2, 'Give this approved record a clear name.').max(200),
    reason: z
      .string()
      .trim()
      .min(10, 'Briefly explain why this proposal is ready to become canon.')
      .max(2_000),
    confirmation: z.literal(true)
  })
  .strict()
export type PromoteWritingDraftInput = z.infer<typeof PromoteWritingDraftInputSchema>

export const ContinuityDependencySchema = z
  .object({
    dependencyId: UlidSchema,
    projectId: UlidSchema,
    sourceCanonId: UlidSchema,
    consumerType: z.enum([
      'canon',
      'storyboard',
      'image',
      'voice',
      'video',
      'timeline',
      'thumbnail',
      'release-package'
    ]),
    consumerId: UlidSchema,
    sourceOutputSha256: Sha256Schema,
    state: z.enum(['current', 'stale']),
    createdAt: z.string().datetime({ offset: true }),
    staleAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type ContinuityDependency = z.infer<typeof ContinuityDependencySchema>

export const CanonImpactSummarySchema = z
  .object({
    canonId: UlidSchema,
    activeRevision: z.number().int().positive(),
    dependentCount: z.number().int().nonnegative(),
    staleDependentCount: z.number().int().nonnegative(),
    affectedTypes: z.array(z.string().min(1).max(80)).max(20)
  })
  .strict()
export type CanonImpactSummary = z.infer<typeof CanonImpactSummarySchema>

export const MediaAssetKindSchema = z.enum([
  'reference-image',
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
  'music',
  'animatic',
  'video-take',
  'caption',
  'thumbnail',
  'master-video',
  'adaptation-dataset',
  'adaptation-artifact',
  'document'
])
export type MediaAssetKind = z.infer<typeof MediaAssetKindSchema>

export const MediaAssetSchema = z
  .object({
    schemaVersion: z.literal(1),
    assetId: UlidSchema,
    projectId: UlidSchema,
    kind: MediaAssetKindSchema,
    label: z.string().trim().min(1).max(240),
    relativePath: z
      .string()
      .min(1)
      .max(1_000)
      .refine((value) => !value.includes('..') && !value.startsWith('/') && !value.includes('\\'), {
        message: 'The asset path must stay inside its project.'
      }),
    mimeType: z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i),
    byteSize: z.number().int().nonnegative(),
    sha256: Sha256Schema,
    origin: z.enum(['imported', 'generated', 'assembled']),
    jobId: UlidSchema.nullable(),
    parentAssetIds: UlidSchema.array().max(2_500),
    state: z.enum(['candidate', 'approved', 'rejected', 'superseded']),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    durationMs: z.number().int().positive().nullable(),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type MediaAsset = z.infer<typeof MediaAssetSchema>

export const MediaAssetViewSchema = MediaAssetSchema.extend({
  mediaUrl: z.string().min(1).max(2_000)
}).strict()
export type MediaAssetView = z.infer<typeof MediaAssetViewSchema>

export const RegisterMediaAssetInputSchema = z
  .object({
    projectId: UlidSchema,
    kind: MediaAssetKindSchema,
    label: z.string().trim().min(1).max(240),
    sourcePath: z.string().min(1).max(2_000),
    origin: z.literal('imported'),
    parentAssetIds: UlidSchema.array().max(2_500).default([])
  })
  .strict()
export type RegisterMediaAssetInput = z.infer<typeof RegisterMediaAssetInputSchema>

export const ChooseMediaAssetInputSchema = RegisterMediaAssetInputSchema.omit({
  sourcePath: true,
  origin: true
}).strict()
export type ChooseMediaAssetInput = z.infer<typeof ChooseMediaAssetInputSchema>

export const ReviewMediaAssetInputSchema = z
  .object({
    projectId: UlidSchema,
    assetId: UlidSchema,
    expectedSha256: Sha256Schema,
    decision: z.enum(['approved', 'rejected', 'changes-requested']),
    reason: z.string().trim().min(3).max(2_000),
    confirmation: z.literal(true)
  })
  .strict()
export type ReviewMediaAssetInput = z.infer<typeof ReviewMediaAssetInputSchema>

export const ProductionJobKindSchema = z.enum([
  'qwen-image',
  'qwen-image-edit',
  'qwen3-tts',
  'animatic',
  'ltx-video-draft',
  'ltx-video-final',
  'ltx-audio-to-video',
  'lip-sync',
  'creative-qc',
  'foley',
  'adaptation-train',
  'timeline-render',
  'caption-export',
  'thumbnail-render',
  'release-package'
])
export type ProductionJobKind = z.infer<typeof ProductionJobKindSchema>

export const ProductionJobStateSchema = z.enum([
  'planned',
  'estimated',
  'approved',
  'queued',
  'provisioning',
  'running',
  'downloading',
  'verifying',
  'awaiting-review',
  'succeeded',
  'failed',
  'cancel-requested',
  'cancelled',
  'terminated'
])
export type ProductionJobState = z.infer<typeof ProductionJobStateSchema>

export const CostEstimateSchema = z
  .object({
    estimateId: UlidSchema,
    currency: z.literal('USD'),
    gpuCount: z.number().int().min(0).max(3),
    hourlyRateUsdPerGpu: z.number().nonnegative(),
    expectedRuntimeMinutes: z.number().int().nonnegative(),
    maximumRuntimeMinutes: z.number().int().positive(),
    expectedComputeUsd: z.number().nonnegative(),
    maximumComputeUsd: z.number().nonnegative(),
    storageUsd: z.number().nonnegative(),
    providerExtrasUsd: z.number().nonnegative(),
    expectedTotalUsd: z.number().nonnegative(),
    maximumTotalUsd: z.number().nonnegative(),
    explanation: z.array(z.string().min(1).max(300)).min(1).max(20),
    priceSource: z.string().min(1).max(300),
    pricedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true })
  })
  .strict()
export type CostEstimate = z.infer<typeof CostEstimateSchema>

export const ProductionJobInputSchema = z
  .object({
    projectId: UlidSchema,
    kind: ProductionJobKindSchema,
    label: z.string().trim().min(2).max(240),
    workflowId: z.string().trim().min(1).max(200),
    workflowVersion: z.string().trim().min(1).max(80),
    inputAssetIds: UlidSchema.array().max(50),
    canonIds: UlidSchema.array().max(50),
    parameters: z.record(
      z.string().min(1).max(100),
      z.union([z.string().max(4_000), z.number().finite(), z.boolean(), z.null()])
    ),
    idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
    estimate: CostEstimateSchema
  })
  .strict()
export type ProductionJobInput = z.infer<typeof ProductionJobInputSchema>

export const ProductionJobApprovalInputSchema = z
  .object({
    projectId: UlidSchema,
    jobId: UlidSchema,
    expectedEstimateId: UlidSchema,
    acceptedMaximumUsd: z.number().positive(),
    confirmation: z.literal(true)
  })
  .strict()
export type ProductionJobApprovalInput = z.infer<typeof ProductionJobApprovalInputSchema>

export const ProductionJobEventSchema = z
  .object({
    eventId: UlidSchema,
    jobId: UlidSchema,
    projectId: UlidSchema,
    state: ProductionJobStateSchema,
    message: z.string().min(1).max(500),
    progressPercent: z.number().int().min(0).max(100).nullable(),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ProductionJobEvent = z.infer<typeof ProductionJobEventSchema>

export const ProductionJobRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    jobId: UlidSchema,
    projectId: UlidSchema,
    kind: ProductionJobKindSchema,
    label: z.string().min(2).max(240),
    state: ProductionJobStateSchema,
    workflowId: z.string().min(1).max(200),
    workflowVersion: z.string().min(1).max(80),
    inputAssetIds: UlidSchema.array().max(50),
    canonIds: UlidSchema.array().max(50),
    parameters: ProductionJobInputSchema.shape.parameters,
    idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/),
    estimate: CostEstimateSchema,
    approvedMaximumUsd: z.number().nonnegative().nullable(),
    actualCostUsd: z.number().nonnegative(),
    elapsedCostEstimateUsd: z.number().nonnegative().default(0),
    costState: z
      .enum(['not-recorded', 'elapsed-estimate', 'provider-reconciled'])
      .default('not-recorded'),
    outputAssetIds: UlidSchema.array().max(100),
    workerLeaseId: UlidSchema.nullable(),
    workerPodId: z.string().min(1).max(191).nullable().default(null),
    workerHardDeadline: z.string().datetime({ offset: true }).nullable().default(null),
    workerClosedAt: z.string().datetime({ offset: true }).nullable().default(null),
    recoverable: z.boolean(),
    lastErrorCode: z.string().min(1).max(100).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ProductionJobRecord = z.infer<typeof ProductionJobRecordSchema>

export const ProductionJobDetailsSchema = z
  .object({
    job: ProductionJobRecordSchema,
    events: ProductionJobEventSchema.array()
  })
  .strict()
export type ProductionJobDetails = z.infer<typeof ProductionJobDetailsSchema>

export const ProductionWorkflowSummarySchema = z
  .object({
    workflowId: z.string().min(1).max(100),
    version: z.string().min(1).max(80),
    label: z.string().min(2).max(160),
    jobKind: ProductionJobKindSchema,
    engine: z.enum(['comfyui', 'worker-python', 'local-ffmpeg', 'local-package']),
    qualificationState: z.enum(['candidate', 'qualified', 'retired']),
    minimumVramGb: z.number().int().nonnegative(),
    expectedRuntimeMinutes: z.number().int().positive(),
    maximumRuntimeMinutes: z.number().int().positive(),
    outputKind: z.enum(['image', 'audio', 'video', 'document', 'package']),
    requiresGpu: z.boolean(),
    readyForPaidWork: z.boolean(),
    blockers: z.array(z.string().min(1).max(300)).max(20),
    notes: z.array(z.string().min(1).max(300)).max(20)
  })
  .strict()
export type ProductionWorkflowSummary = z.infer<typeof ProductionWorkflowSummarySchema>

export const ProductionWorkflowEstimateInputSchema = z
  .object({
    projectId: UlidSchema,
    workflowId: z.string().min(1).max(100),
    workflowVersion: z.string().min(1).max(80),
    gpuTypeId: z.string().min(1).max(191).nullable(),
    priceTier: z.enum(['secure', 'community']).nullable(),
    gpuCount: z.number().int().min(0).max(3)
  })
  .strict()
export type ProductionWorkflowEstimateInput = z.infer<typeof ProductionWorkflowEstimateInputSchema>

export const ProductionWorkflowEstimateResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      workflow: ProductionWorkflowSummarySchema,
      estimate: CostEstimateSchema
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'invalid-input',
            'not-found',
            'not-connected',
            'price-unavailable',
            'workflow-locked',
            'budget-exceeded',
            'unknown'
          ]),
          message: z.string().min(1).max(600)
        })
        .strict()
    })
    .strict()
])
export type ProductionWorkflowEstimateResult = z.infer<
  typeof ProductionWorkflowEstimateResultSchema
>

export const ProductionQueueJobInputSchema = z
  .object({
    projectId: UlidSchema,
    jobId: UlidSchema,
    expectedEstimateId: UlidSchema,
    confirmation: z.literal(true)
  })
  .strict()
export type ProductionQueueJobInput = z.infer<typeof ProductionQueueJobInputSchema>

export const ProductionCancelJobInputSchema = z
  .object({
    projectId: UlidSchema,
    jobId: UlidSchema,
    reason: z.string().trim().min(5).max(500),
    confirmation: z.literal(true)
  })
  .strict()
export type ProductionCancelJobInput = z.infer<typeof ProductionCancelJobInputSchema>

export const TimelineClipSchema = z
  .object({
    clipId: UlidSchema,
    assetId: UlidSchema,
    order: z.number().int().nonnegative(),
    durationMs: z.number().int().min(100).max(3_600_000),
    trimInMs: z.number().int().nonnegative(),
    transition: z.enum(['cut', 'crossfade', 'fade-through-black'])
  })
  .strict()
export type TimelineClip = z.infer<typeof TimelineClipSchema>

export const TimelineAudioCueSchema = z
  .object({
    cueId: UlidSchema,
    assetId: UlidSchema,
    layer: z.enum(['dialogue', 'ambience', 'effect', 'music']),
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    gainDb: z.number().min(-60).max(12)
  })
  .strict()
export type TimelineAudioCue = z.infer<typeof TimelineAudioCueSchema>

export const CaptionCueSchema = z
  .object({
    cueId: UlidSchema,
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    text: z.string().trim().min(1).max(500)
  })
  .strict()
  .refine((value) => value.endMs > value.startMs, {
    message: 'A caption must end after it starts.'
  })
export type CaptionCue = z.infer<typeof CaptionCueSchema>

export const ProductionTimelineSchema = z
  .object({
    schemaVersion: z.literal(1),
    timelineId: UlidSchema,
    projectId: UlidSchema,
    revision: z.number().int().positive(),
    state: z.enum(['draft', 'locked', 'superseded']),
    label: z.string().trim().min(2).max(240),
    clips: z.array(TimelineClipSchema).max(2_000),
    audioCues: z.array(TimelineAudioCueSchema).max(10_000),
    captions: z.array(CaptionCueSchema).max(20_000),
    durationMs: z.number().int().nonnegative(),
    masterAssetId: UlidSchema.nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    lockedAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type ProductionTimeline = z.infer<typeof ProductionTimelineSchema>

export const SaveProductionTimelineInputSchema = z
  .object({
    projectId: UlidSchema,
    timelineId: UlidSchema.nullable(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable(),
    label: z.string().trim().min(2).max(240),
    clips: z.array(TimelineClipSchema).max(2_000),
    audioCues: z.array(TimelineAudioCueSchema).max(10_000),
    captions: z.array(CaptionCueSchema).max(20_000)
  })
  .strict()
export type SaveProductionTimelineInput = z.infer<typeof SaveProductionTimelineInputSchema>

export const LockProductionTimelineInputSchema = z
  .object({
    projectId: UlidSchema,
    timelineId: UlidSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    confirmation: z.literal(true)
  })
  .strict()
export type LockProductionTimelineInput = z.infer<typeof LockProductionTimelineInputSchema>

export const ReleaseDetailsSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseDetailsId: UlidSchema,
    projectId: UlidSchema,
    revision: z.number().int().positive(),
    title: z.string().trim().min(1).max(100),
    description: z.string().max(5_000),
    language: z.string().trim().min(2).max(80),
    category: z.string().trim().min(1).max(100),
    playlist: z.string().trim().max(150),
    tags: z.array(z.string().trim().min(1).max(100)).max(50),
    hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(15),
    chapters: z
      .array(
        z
          .object({
            startMs: z.number().int().nonnegative(),
            label: z.string().trim().min(1).max(100)
          })
          .strict()
      )
      .max(100),
    credits: z.string().max(5_000),
    endScreenNotes: z.string().max(1_000),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ReleaseDetails = z.infer<typeof ReleaseDetailsSchema>

export const SaveReleaseDetailsInputSchema = ReleaseDetailsSchema.omit({
  schemaVersion: true,
  releaseDetailsId: true,
  revision: true,
  createdAt: true,
  updatedAt: true
})
  .extend({
    releaseDetailsId: UlidSchema.nullable(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type SaveReleaseDetailsInput = z.infer<typeof SaveReleaseDetailsInputSchema>

export const ReleaseAttestationsSchema = z
  .object({
    schemaVersion: z.literal(1),
    attestationId: UlidSchema,
    projectId: UlidSchema,
    madeForKids: z.enum(['yes', 'no']),
    syntheticDisclosure: z.enum(['yes', 'no']),
    truthfulPackagingConfirmed: z.literal(true),
    originalityReviewed: z.literal(true),
    rightsAndCreditsReviewed: z.literal(true),
    fullWatchCompleted: z.literal(true),
    notes: z.string().trim().min(10).max(2_000),
    attestedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ReleaseAttestations = z.infer<typeof ReleaseAttestationsSchema>

export const SaveReleaseAttestationsInputSchema = ReleaseAttestationsSchema.omit({
  schemaVersion: true,
  attestationId: true,
  attestedAt: true
}).strict()
export type SaveReleaseAttestationsInput = z.infer<typeof SaveReleaseAttestationsInputSchema>

export const ReleasePackageFileSchema = z
  .object({
    role: z.enum(['master', 'thumbnail', 'caption', 'details', 'attestations', 'manifest']),
    fileName: z.string().min(1).max(240),
    byteSize: z.number().int().nonnegative(),
    sha256: Sha256Schema
  })
  .strict()
export const ReleasePackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    releaseId: UlidSchema,
    projectId: UlidSchema,
    timelineId: UlidSchema,
    releaseDetailsId: UlidSchema,
    attestationId: UlidSchema,
    masterAssetId: UlidSchema,
    thumbnailAssetId: UlidSchema,
    captionAssetIds: UlidSchema.array().max(20),
    state: z.literal('locked'),
    files: z.array(ReleasePackageFileSchema).min(5).max(30),
    relativePath: z.string().regex(/^releases\//),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ReleasePackage = z.infer<typeof ReleasePackageSchema>

export const CreateReleasePackageInputSchema = z
  .object({
    projectId: UlidSchema,
    timelineId: UlidSchema,
    releaseDetailsId: UlidSchema,
    attestationId: UlidSchema,
    masterAssetId: UlidSchema,
    thumbnailAssetId: UlidSchema,
    captionAssetIds: UlidSchema.array().max(20),
    confirmation: z.literal(true)
  })
  .strict()
export type CreateReleasePackageInput = z.infer<typeof CreateReleasePackageInputSchema>

export const ProjectReleaseProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    profileId: UlidSchema,
    projectId: UlidSchema,
    revision: z.number().int().positive(),
    name: z.string().trim().min(2).max(160),
    audience: z.string().trim().min(2).max(500),
    language: z.string().trim().min(2).max(80),
    region: z.string().trim().max(120),
    timezone: z.string().trim().min(1).max(120),
    channelPromise: z.string().trim().min(10).max(1_500),
    packagingVoice: z.string().trim().min(2).max(1_000),
    visualDirection: z.string().trim().min(2).max(1_000),
    defaultCta: z.string().trim().max(500),
    defaultCredits: z.string().trim().max(2_000),
    blockedClaims: z.array(z.string().trim().min(1).max(200)).max(30),
    blockedTopics: z.array(z.string().trim().min(1).max(200)).max(30),
    category: z.string().trim().min(1).max(100),
    playlistConvention: z.string().trim().max(500),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ProjectReleaseProfile = z.infer<typeof ProjectReleaseProfileSchema>

export const SaveProjectReleaseProfileInputSchema = ProjectReleaseProfileSchema.omit({
  schemaVersion: true,
  profileId: true,
  revision: true,
  createdAt: true,
  updatedAt: true
})
  .extend({
    profileId: UlidSchema.nullable(),
    expectedUpdatedAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type SaveProjectReleaseProfileInput = z.infer<typeof SaveProjectReleaseProfileInputSchema>

export const ReleaseIdeaEntrySchema = z
  .object({
    schemaVersion: z.literal(1),
    ideaId: UlidSchema,
    projectId: UlidSchema,
    title: z.string().trim().min(2).max(200),
    premise: z.string().trim().min(10).max(4_000),
    sourceType: z.enum(['creator', 'llm-proposal', 'audience-request', 'trend-signal', 'other']),
    sourceLabel: z.string().trim().min(2).max(300),
    rationale: z.string().trim().min(10).max(2_000),
    continuityNotes: z.string().trim().max(2_000),
    status: z.enum(['backlog', 'reviewing', 'selected', 'rejected']),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict()
export type ReleaseIdeaEntry = z.infer<typeof ReleaseIdeaEntrySchema>

export const SaveReleaseIdeaInputSchema = ReleaseIdeaEntrySchema.omit({
  schemaVersion: true,
  ideaId: true,
  createdAt: true,
  updatedAt: true
})
  .extend({ ideaId: UlidSchema.nullable() })
  .strict()
export type SaveReleaseIdeaInput = z.infer<typeof SaveReleaseIdeaInputSchema>

export const PerformanceMetricsSchema = z
  .object({
    views: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative().nullable(),
    impressionsClickThroughRatePct: z.number().min(0).max(100).nullable(),
    averageViewDurationSeconds: z.number().nonnegative().nullable(),
    estimatedWatchTimeHours: z.number().nonnegative().nullable(),
    likes: z.number().int().nonnegative().nullable(),
    comments: z.number().int().nonnegative().nullable(),
    shares: z.number().int().nonnegative().nullable(),
    subscribersGained: z.number().int().nonnegative().nullable(),
    retentionAt30SecondsPct: z.number().min(0).max(100).nullable()
  })
  .strict()
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>

export const PerformanceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshotId: UlidSchema,
    projectId: UlidSchema,
    releaseId: UlidSchema.nullable(),
    youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{6,32}$/),
    source: z.enum(['official-report', 'manual-official', 'rehearsal']),
    windowStart: z.string().date(),
    windowEnd: z.string().date(),
    collectedAt: z.string().datetime({ offset: true }),
    metricDefinitionVersion: z.literal('youtube-analytics-2026-08'),
    metrics: PerformanceMetricsSchema,
    missingDataWarnings: z.array(z.string().trim().min(1).max(500)).max(20),
    evidenceNotes: z.string().trim().min(10).max(4_000),
    baselineEligible: z.boolean(),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type PerformanceSnapshot = z.infer<typeof PerformanceSnapshotSchema>

export const SavePerformanceSnapshotInputSchema = PerformanceSnapshotSchema.omit({
  schemaVersion: true,
  snapshotId: true,
  metricDefinitionVersion: true,
  baselineEligible: true,
  createdAt: true
}).refine((value) => value.windowEnd >= value.windowStart, {
  message: 'The performance window must end on or after its start date.',
  path: ['windowEnd']
})
export type SavePerformanceSnapshotInput = z.infer<typeof SavePerformanceSnapshotInputSchema>

export const ReleaseLearningSchema = z
  .object({
    schemaVersion: z.literal(1),
    learningId: UlidSchema,
    projectId: UlidSchema,
    snapshotIds: z.array(UlidSchema).min(1).max(30),
    observation: z.string().trim().min(10).max(3_000),
    inference: z.string().trim().min(10).max(3_000),
    recommendation: z.string().trim().min(10).max(3_000),
    confidence: z.enum(['low', 'medium', 'high']),
    scope: z.enum(['next-release', 'this-project', 'future-profile-version']),
    status: z.enum(['proposed', 'approved', 'rejected']),
    reviewReason: z.string().trim().max(2_000).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    reviewedAt: z.string().datetime({ offset: true }).nullable()
  })
  .strict()
export type ReleaseLearning = z.infer<typeof ReleaseLearningSchema>

export const SaveReleaseLearningInputSchema = ReleaseLearningSchema.omit({
  schemaVersion: true,
  learningId: true,
  status: true,
  reviewReason: true,
  createdAt: true,
  reviewedAt: true
}).strict()
export type SaveReleaseLearningInput = z.infer<typeof SaveReleaseLearningInputSchema>

export const ReviewReleaseLearningInputSchema = z
  .object({
    projectId: UlidSchema,
    learningId: UlidSchema,
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(10).max(2_000),
    confirmation: z.literal(true)
  })
  .strict()
export type ReviewReleaseLearningInput = z.infer<typeof ReviewReleaseLearningInputSchema>

export const FinishWorkspaceSchema = z
  .object({
    projectId: UlidSchema,
    timelines: z.array(ProductionTimelineSchema),
    releaseDetails: z.array(ReleaseDetailsSchema),
    attestations: z.array(ReleaseAttestationsSchema),
    releasePackages: z.array(ReleasePackageSchema),
    releaseProfiles: z.array(ProjectReleaseProfileSchema).default([]),
    ideas: z.array(ReleaseIdeaEntrySchema).default([]),
    performanceSnapshots: z.array(PerformanceSnapshotSchema).default([]),
    learnings: z.array(ReleaseLearningSchema).default([]),
    blockers: z.array(z.string().min(1).max(300))
  })
  .strict()
export type FinishWorkspace = z.infer<typeof FinishWorkspaceSchema>

export const FinishActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), workspace: FinishWorkspaceSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'invalid-input',
            'not-found',
            'stale-data',
            'approval-required',
            'integrity-failed',
            'unsafe-path',
            'unknown'
          ]),
          message: z.string().min(1).max(600)
        })
        .strict()
    })
    .strict()
])
export type FinishActionResult = z.infer<typeof FinishActionResultSchema>

export const LocalMediaRuntimeStatusSchema = z
  .object({
    state: z.enum(['ready', 'missing']),
    source: z.enum(['bundled', 'system', 'none']),
    ffmpegAvailable: z.boolean(),
    ffprobeAvailable: z.boolean(),
    message: z.string().min(1).max(600)
  })
  .strict()
export type LocalMediaRuntimeStatus = z.infer<typeof LocalMediaRuntimeStatusSchema>

export const InstallLocalMediaToolsInputSchema = z
  .object({ confirmation: z.literal(true) })
  .strict()
export type InstallLocalMediaToolsInput = z.infer<typeof InstallLocalMediaToolsInputSchema>

export const LocalMediaInstallResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), status: LocalMediaRuntimeStatusSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'unsupported',
            'installer-missing',
            'install-failed',
            'verification-failed'
          ]),
          message: z.string().min(1).max(600)
        })
        .strict()
    })
    .strict()
])
export type LocalMediaInstallResult = z.infer<typeof LocalMediaInstallResultSchema>

export const RenderTimelineInputSchema = z
  .object({
    projectId: UlidSchema,
    timelineId: UlidSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    label: z.string().trim().min(2).max(240),
    width: z.number().int().min(1280).max(3840),
    height: z.number().int().min(720).max(2160),
    framesPerSecond: z.number().int().min(12).max(60),
    burnCaptions: z.boolean(),
    confirmation: z.literal(true)
  })
  .strict()
export type RenderTimelineInput = z.infer<typeof RenderTimelineInputSchema>

export const ExportCaptionsInputSchema = z
  .object({
    projectId: UlidSchema,
    timelineId: UlidSchema,
    label: z.string().trim().min(2).max(240),
    format: z.enum(['srt', 'vtt']),
    confirmation: z.literal(true)
  })
  .strict()
export type ExportCaptionsInput = z.infer<typeof ExportCaptionsInputSchema>

export const RenderThumbnailInputSchema = z
  .object({
    projectId: UlidSchema,
    sourceAssetId: UlidSchema,
    label: z.string().trim().min(2).max(240),
    headline: z.string().trim().min(1).max(80),
    textPosition: z.enum(['top', 'bottom']),
    accent: z.enum(['gold', 'cyan', 'coral', 'white']),
    confirmation: z.literal(true)
  })
  .strict()
export type RenderThumbnailInput = z.infer<typeof RenderThumbnailInputSchema>

export const LocalMediaActionResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      asset: MediaAssetViewSchema,
      workspace: FinishWorkspaceSchema,
      warnings: z.array(z.string().min(1).max(600)).max(100)
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'invalid-input',
            'not-found',
            'stale-data',
            'approval-required',
            'runtime-missing',
            'render-failed',
            'integrity-failed',
            'unsafe-path',
            'unknown'
          ]),
          message: z.string().min(1).max(600)
        })
        .strict()
    })
    .strict()
])
export type LocalMediaActionResult = z.infer<typeof LocalMediaActionResultSchema>

export const PromotableDraftFingerprintSchema = z
  .object({
    draftId: UlidSchema,
    sha256: Sha256Schema,
    alreadyPromoted: z.boolean()
  })
  .strict()
export type PromotableDraftFingerprint = z.infer<typeof PromotableDraftFingerprintSchema>

export const ProductionWorkspaceSummarySchema = z
  .object({
    projectId: UlidSchema,
    canon: CanonRecordSchema.array(),
    media: MediaAssetViewSchema.array(),
    jobs: ProductionJobRecordSchema.array(),
    canonImpacts: CanonImpactSummarySchema.array().default([]),
    draftFingerprints: PromotableDraftFingerprintSchema.array(),
    staleDependencyCount: z.number().int().nonnegative(),
    estimatedApprovedSpendUsd: z.number().nonnegative(),
    actualSpendUsd: z.number().nonnegative(),
    elapsedCloudUsageEstimateUsd: z.number().nonnegative().default(0)
  })
  .strict()
export type ProductionWorkspaceSummary = z.infer<typeof ProductionWorkspaceSummarySchema>

const ProductionActionErrorSchema = z
  .object({
    code: z.enum([
      'invalid-input',
      'not-found',
      'stale-data',
      'approval-required',
      'budget-exceeded',
      'invalid-state',
      'unsafe-path',
      'integrity-failed',
      'project-error',
      'unknown'
    ]),
    message: z.string().min(1).max(600)
  })
  .strict()

export const CanonActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), canon: CanonRecordSchema }).strict(),
  z.object({ ok: z.literal(false), error: ProductionActionErrorSchema }).strict()
])
export type CanonActionResult = z.infer<typeof CanonActionResultSchema>

export const MediaActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), asset: MediaAssetViewSchema }).strict(),
  z.object({ ok: z.literal(false), error: ProductionActionErrorSchema }).strict()
])
export type MediaActionResult = z.infer<typeof MediaActionResultSchema>

export const ProductionJobActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), details: ProductionJobDetailsSchema }).strict(),
  z.object({ ok: z.literal(false), error: ProductionActionErrorSchema }).strict()
])
export type ProductionJobActionResult = z.infer<typeof ProductionJobActionResultSchema>

export const UpstreamFileRoleSchema = z.enum([
  'outline',
  'characters',
  'art',
  'script',
  'storyboard'
])
export type UpstreamFileRole = z.infer<typeof UpstreamFileRoleSchema>

export const UpstreamSourceFileSchema = z
  .object({
    role: UpstreamFileRoleSchema,
    originalName: z.string().min(1).max(240),
    relativePath: z.string().min(1).max(1_000),
    sha256: Sha256Schema,
    byteSize: z.number().int().positive(),
    validationState: z.enum(['passed', 'failed', 'not-run']),
    validatorOutput: z.string().max(8_000)
  })
  .strict()
export type UpstreamSourceFile = z.infer<typeof UpstreamSourceFileSchema>

export const NeutralShotSchema = z
  .object({
    shotId: z.string().regex(/^SHOT-[A-Z0-9-]{3,80}$/),
    sourceAlias: z.string().min(1).max(120),
    sourceSceneId: z.string().min(1).max(120),
    narrativeJob: z.enum([
      'establish',
      'reveal',
      'reaction',
      'dialogue',
      'movement',
      'mood',
      'transition'
    ]),
    targetDurationFrames: z.number().int().positive(),
    frameRate: z.number().int().min(12).max(120),
    composition: z.string().min(1).max(4_000),
    cameraIntent: z.string().min(1).max(500),
    characterAliases: z.array(z.string().min(1).max(120)).max(20),
    propAliases: z.array(z.string().min(1).max(120)).max(20),
    productionMethod: z.enum([
      'held-image',
      'parallax',
      'loop',
      'image-to-video',
      'audio-to-video',
      'manual'
    ]),
    fallbackMethod: z.enum([
      'held-image',
      'parallax',
      'loop',
      'image-to-video',
      'audio-to-video',
      'manual'
    ]),
    sourceH3Prompt: z.string().max(30_000).nullable(),
    sourceH3ExecutionBlocked: z.literal(true),
    approvalCriteria: z.array(z.string().min(1).max(500)).min(1).max(20)
  })
  .strict()
export type NeutralShot = z.infer<typeof NeutralShotSchema>

export const NormalizedSceneSchema = z
  .object({
    sceneId: z.string().regex(/^SCENE-[A-Z0-9-]{3,80}$/),
    sourceAliases: z.array(z.string().min(1).max(120)).min(1).max(20),
    label: z.string().min(1).max(240),
    purpose: z.string().min(1).max(2_000),
    targetSeconds: z.number().int().positive(),
    shots: NeutralShotSchema.array().max(500)
  })
  .strict()
export type NormalizedScene = z.infer<typeof NormalizedSceneSchema>

export const NormalizedSequenceSchema = z
  .object({
    sequenceId: z.string().regex(/^SEQ-[A-Z0-9-]{3,80}$/),
    label: z.string().min(1).max(240),
    purpose: z.string().min(1).max(2_000),
    targetSeconds: z.number().int().positive(),
    scenes: NormalizedSceneSchema.array().min(1).max(200)
  })
  .strict()
export type NormalizedSequence = z.infer<typeof NormalizedSequenceSchema>

export const NormalizedActSchema = z
  .object({
    actNumber: z.number().int().positive().max(10),
    label: z.string().min(1).max(120),
    dramaticPurpose: z.string().min(1).max(1_000),
    targetSeconds: z.number().int().positive(),
    sequences: NormalizedSequenceSchema.array().min(1).max(100)
  })
  .strict()
export type NormalizedAct = z.infer<typeof NormalizedActSchema>

export const LongFormPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    planId: UlidSchema,
    importId: UlidSchema,
    projectId: UlidSchema,
    projectType: ProjectTypeSchema,
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    sourceLanguage: z.string().min(2).max(40),
    targetDurationSeconds: z.number().int().positive(),
    frameRate: z.number().int().min(12).max(120),
    acts: NormalizedActSchema.array().min(1).max(10),
    characters: z
      .array(
        z
          .object({
            sourceAlias: z.string().min(1).max(120),
            name: z.string().min(1).max(200),
            tier: z.enum(['lead', 'support', 'functional']),
            identitySummary: z.string().min(1).max(4_000)
          })
          .strict()
      )
      .max(100),
    locations: z
      .array(
        z
          .object({
            sourceAlias: z.string().min(1).max(120),
            name: z.string().min(1).max(200),
            summary: z.string().min(1).max(4_000)
          })
          .strict()
      )
      .max(200),
    warnings: z.array(z.string().min(1).max(1_000)).max(100),
    normalizedSha256: Sha256Schema,
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type LongFormPlan = z.infer<typeof LongFormPlanSchema>

export const UpstreamImportRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    importId: UlidSchema,
    projectId: UlidSchema,
    state: z.enum(['preview', 'accepted', 'validation-failed']),
    sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
    creativeDirectionProfileId: UlidSchema,
    creativeDirectionSha256: Sha256Schema,
    files: UpstreamSourceFileSchema.array().min(1).max(5),
    normalized: LongFormPlanSchema.nullable(),
    acceptedAt: z.string().datetime({ offset: true }).nullable(),
    createdAt: z.string().datetime({ offset: true })
  })
  .strict()
export type UpstreamImportRecord = z.infer<typeof UpstreamImportRecordSchema>

export const AcceptUpstreamImportInputSchema = z
  .object({
    projectId: UlidSchema,
    importId: UlidSchema,
    expectedNormalizedSha256: Sha256Schema,
    confirmation: z.literal(true)
  })
  .strict()
export type AcceptUpstreamImportInput = z.infer<typeof AcceptUpstreamImportInputSchema>

export const UpstreamImportActionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), record: UpstreamImportRecordSchema }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: z.enum([
            'cancelled',
            'invalid-source',
            'lock-mismatch',
            'validation-failed',
            'timed-out',
            'stale-data',
            'project-error',
            'storage-error',
            'unknown'
          ]),
          message: z.string().min(1).max(600)
        })
        .strict()
    })
    .strict()
])
export type UpstreamImportActionResult = z.infer<typeof UpstreamImportActionResultSchema>

export const IPC_CHANNELS = {
  systemGetStatus: 'studio:system:get-status',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsOpen: 'studio:projects:open',
  projectsListBackups: 'studio:projects:list-backups',
  projectsBackup: 'studio:projects:backup',
  projectsRestore: 'studio:projects:restore',
  projectsSaveCreativeDirection: 'studio:projects:save-creative-direction',
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
  writingListDrafts: 'studio:writing:list-drafts',
  productionGetWorkspace: 'studio:production:get-workspace',
  productionPromoteDraft: 'studio:production:promote-draft',
  productionImportMedia: 'studio:production:import-media',
  productionReviewMedia: 'studio:production:review-media',
  productionPlanJob: 'studio:production:plan-job',
  productionApproveJob: 'studio:production:approve-job',
  productionGetJob: 'studio:production:get-job',
  productionListWorkflows: 'studio:production:list-workflows',
  productionEstimateWorkflow: 'studio:production:estimate-workflow',
  productionQueueJob: 'studio:production:queue-job',
  productionCancelJob: 'studio:production:cancel-job',
  productionReconcileJob: 'studio:production:reconcile-job',
  finishGetWorkspace: 'studio:finish:get-workspace',
  finishSaveTimeline: 'studio:finish:save-timeline',
  finishLockTimeline: 'studio:finish:lock-timeline',
  finishSaveReleaseDetails: 'studio:finish:save-release-details',
  finishSaveAttestations: 'studio:finish:save-attestations',
  finishSaveReleaseProfile: 'studio:finish:save-release-profile',
  finishSaveIdea: 'studio:finish:save-idea',
  finishSavePerformanceSnapshot: 'studio:finish:save-performance-snapshot',
  finishSaveLearning: 'studio:finish:save-learning',
  finishReviewLearning: 'studio:finish:review-learning',
  finishCreateReleasePackage: 'studio:finish:create-release-package',
  finishGetLocalMediaStatus: 'studio:finish:get-local-media-status',
  finishInstallLocalMediaTools: 'studio:finish:install-local-media-tools',
  finishRenderTimeline: 'studio:finish:render-timeline',
  finishExportCaptions: 'studio:finish:export-captions',
  finishRenderThumbnail: 'studio:finish:render-thumbnail',
  upstreamChooseImport: 'studio:upstream:choose-import',
  upstreamListImports: 'studio:upstream:list-imports',
  upstreamAcceptImport: 'studio:upstream:accept-import',
  skillsGetStatus: 'studio:skills:get-status',
  skillsInstall: 'studio:skills:install',
  skillsSetProjectEnabled: 'studio:skills:set-project-enabled',
  skillsRemove: 'studio:skills:remove',
  skillsPreviewPlan: 'studio:skills:preview-plan'
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
    saveCreativeDirection(input: ProjectCreativeDirectionUpdateInput): Promise<ProjectDetails>
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
  production: {
    getWorkspace(projectId: string): Promise<ProductionWorkspaceSummary>
    promoteDraft(input: PromoteWritingDraftInput): Promise<CanonActionResult>
    importMedia(input: ChooseMediaAssetInput): Promise<MediaActionResult>
    reviewMedia(input: ReviewMediaAssetInput): Promise<MediaActionResult>
    planJob(input: ProductionJobInput): Promise<ProductionJobActionResult>
    approveJob(input: ProductionJobApprovalInput): Promise<ProductionJobActionResult>
    getJob(projectId: string, jobId: string): Promise<ProductionJobDetails>
    listWorkflows(): Promise<ProductionWorkflowSummary[]>
    estimateWorkflow(
      input: ProductionWorkflowEstimateInput
    ): Promise<ProductionWorkflowEstimateResult>
    queueJob(input: ProductionQueueJobInput): Promise<ProductionJobActionResult>
    cancelJob(input: ProductionCancelJobInput): Promise<ProductionJobActionResult>
    reconcileJob(projectId: string, jobId: string): Promise<ProductionJobActionResult>
  }
  finish: {
    getWorkspace(projectId: string): Promise<FinishWorkspace>
    saveTimeline(input: SaveProductionTimelineInput): Promise<FinishActionResult>
    lockTimeline(input: LockProductionTimelineInput): Promise<FinishActionResult>
    saveReleaseDetails(input: SaveReleaseDetailsInput): Promise<FinishActionResult>
    saveAttestations(input: SaveReleaseAttestationsInput): Promise<FinishActionResult>
    saveReleaseProfile(input: SaveProjectReleaseProfileInput): Promise<FinishActionResult>
    saveIdea(input: SaveReleaseIdeaInput): Promise<FinishActionResult>
    savePerformanceSnapshot(input: SavePerformanceSnapshotInput): Promise<FinishActionResult>
    saveLearning(input: SaveReleaseLearningInput): Promise<FinishActionResult>
    reviewLearning(input: ReviewReleaseLearningInput): Promise<FinishActionResult>
    createReleasePackage(input: CreateReleasePackageInput): Promise<FinishActionResult>
    getLocalMediaStatus(): Promise<LocalMediaRuntimeStatus>
    installLocalMediaTools(input: InstallLocalMediaToolsInput): Promise<LocalMediaInstallResult>
    renderTimeline(input: RenderTimelineInput): Promise<LocalMediaActionResult>
    exportCaptions(input: ExportCaptionsInput): Promise<LocalMediaActionResult>
    renderThumbnail(input: RenderThumbnailInput): Promise<LocalMediaActionResult>
  }
  upstream: {
    chooseImport(projectId: string): Promise<UpstreamImportActionResult>
    listImports(projectId: string): Promise<UpstreamImportRecord[]>
    acceptImport(input: AcceptUpstreamImportInput): Promise<UpstreamImportActionResult>
  }
  skills: {
    getStatus(): Promise<ExternalSkillStatus>
    install(): Promise<ExternalSkillActionResult>
    setProjectEnabled(
      input: ExternalSkillSetProjectEnabledInput
    ): Promise<ExternalSkillActionResult>
    remove(input: ExternalSkillRemoveInput): Promise<ExternalSkillActionResult>
    previewPlan(input: ExternalSkillPlanPreviewInput): Promise<ExternalSkillPlanPreview>
  }
}

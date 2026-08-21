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

export const SystemStatusSchema = z
  .object({
    appVersion: z.string(),
    electronVersion: z.string(),
    nodeVersion: z.string(),
    storagePath: z.string(),
    indexedProjects: z.number().int().nonnegative(),
    catalogState: z.literal('ready'),
    cloudGpuState: z.literal('not-configured'),
    generationState: z.literal('locked'),
    generationReason: z.string()
  })
  .strict()
export type SystemStatus = z.infer<typeof SystemStatusSchema>

export const IPC_CHANNELS = {
  systemGetStatus: 'studio:system:get-status',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsOpen: 'studio:projects:open'
} as const

export interface StudioApi {
  system: {
    getStatus(): Promise<SystemStatus>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(input: CreateProjectInput): Promise<ProjectDetails>
    open(projectId: string): Promise<ProjectDetails>
  }
}

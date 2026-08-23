import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z, ZodError } from 'zod'
import {
  WRITING_MODEL_CATALOG,
  ExternalSkillPlanPreviewSchema,
  WritingConnectInputSchema,
  WritingContextPreviewInputSchema,
  WritingContextPreviewSchema,
  WritingDefaultProfileSchema,
  WritingDraftRecordSchema,
  WritingDraftRequestSchema,
  WritingModelOptionSchema,
  WritingProviderEnabledInputSchema,
  WritingProviderInputSchema,
  WritingSettingsStatusSchema,
  type CreativeDraftContent,
  type ExternalSkillManifest,
  type ExternalSkillPlanPreview,
  type ProjectDetails,
  type ExternalSkillExecutionReceipt,
  type WritingTaskKind,
  type WritingContextPreview,
  type WritingContextPreviewInput,
  type WritingDraftActionResult,
  type WritingDraftRecord,
  type WritingErrorCode,
  type WritingProvider,
  type WritingSettingsStatus,
  type WritingTextProvider
} from '@studio/contracts'
import { CredentialVaultError } from '@studio/credential-vault'
import { createUlid } from '@studio/domain'
import { AnthropicProviderError } from '@studio/provider-anthropic'
import { GeminiProviderError } from '@studio/provider-gemini'
import { OpenAiProviderError } from '@studio/provider-openai'

const StoredProviderSchema = z
  .object({
    enabled: z.boolean(),
    checkedAt: z.string().datetime({ offset: true }).nullable(),
    models: WritingModelOptionSchema.array().max(100)
  })
  .strict()

const WritingSettingsRecordV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    providers: z
      .object({
        openai: StoredProviderSchema,
        anthropic: StoredProviderSchema
      })
      .strict(),
    defaultProfile: WritingDefaultProfileSchema.nullable()
  })
  .strict()

const WritingSettingsRecordSchema = z
  .object({
    schemaVersion: z.literal(2),
    providers: z
      .object({
        openai: StoredProviderSchema,
        anthropic: StoredProviderSchema,
        gemini: StoredProviderSchema
      })
      .strict(),
    defaultProfile: WritingDefaultProfileSchema.nullable()
  })
  .strict()

type WritingSettingsRecord = z.infer<typeof WritingSettingsRecordSchema>

export interface WritingCredentialVault {
  hasSecret(): Promise<boolean>
  storeSecret(secret: string): Promise<void>
  readSecret(): Promise<string>
  removeSecret(): Promise<void>
}

export interface WritingProjectStore {
  openProject(projectId: string): ProjectDetails
  saveWritingDraft(draft: WritingDraftRecord): WritingDraftRecord
  listWritingDrafts(projectId: string): WritingDraftRecord[]
}

export interface ResolvedWritingSkillPlan {
  preview: ExternalSkillPlanPreview
  readyManifests: ExternalSkillManifest[]
}

export interface ExternalWritingSkillPlanner {
  getPlan(projectId: string, taskKind: WritingTaskKind): Promise<ResolvedWritingSkillPlan>
}

export interface WritingSetupServiceOptions {
  vaults: Record<WritingProvider, WritingCredentialVault>
  providers: Record<WritingProvider, WritingTextProvider>
  settingsStore: WritingSettingsStore
  now?: () => Date
}

export class WritingServiceError extends Error {
  readonly code: WritingErrorCode

  constructor(code: WritingErrorCode, message: string) {
    super(message)
    this.name = 'WritingServiceError'
    this.code = code
  }
}

function defaultProvider() {
  return { enabled: true, checkedAt: null, models: [] }
}

function providerName(provider: WritingProvider): string {
  return provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google Gemini'
}

function defaultRecord(): WritingSettingsRecord {
  return {
    schemaVersion: 2,
    providers: {
      openai: defaultProvider(),
      anthropic: defaultProvider(),
      gemini: defaultProvider()
    },
    defaultProfile: null
  }
}

async function atomicWriteJson(filePath: string, value: WritingSettingsRecord): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await mkdir(dirname(filePath), { recursive: true })
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, filePath)
  } catch (error) {
    try {
      await unlink(temporaryPath)
    } catch {
      // The temporary file may not have been created.
    }
    throw error
  }
}

export class WritingSettingsStore {
  readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<WritingSettingsRecord> {
    try {
      const untrustedRecord: unknown = JSON.parse(await readFile(this.filePath, 'utf8'))
      const current = WritingSettingsRecordSchema.safeParse(untrustedRecord)
      if (current.success) return current.data
      const previous = WritingSettingsRecordV1Schema.safeParse(untrustedRecord)
      if (previous.success) {
        return WritingSettingsRecordSchema.parse({
          ...previous.data,
          schemaVersion: 2,
          providers: { ...previous.data.providers, gemini: defaultProvider() }
        })
      }
      return WritingSettingsRecordSchema.parse(untrustedRecord)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaultRecord()
      throw new WritingServiceError(
        'settings-error',
        'The local writing settings need repair. No paid request was started.'
      )
    }
  }

  async save(record: WritingSettingsRecord): Promise<void> {
    try {
      await atomicWriteJson(this.filePath, WritingSettingsRecordSchema.parse(record))
    } catch (error) {
      if (error instanceof WritingServiceError) throw error
      throw new WritingServiceError(
        'settings-error',
        'The writing settings could not be saved. No paid request was started.'
      )
    }
  }
}

function statusForProvider(
  provider: WritingProvider,
  record: WritingSettingsRecord,
  credentialStored: boolean
) {
  const stored = record.providers[provider]
  const connected = credentialStored && stored.checkedAt !== null && stored.models.length > 0
  return {
    provider,
    connectionState: connected
      ? stored.enabled
        ? ('connected' as const)
        : ('disabled' as const)
      : credentialStored
        ? ('attention' as const)
        : ('not-configured' as const),
    credentialStored,
    enabled: stored.enabled,
    checkedAt: stored.checkedAt,
    models: connected ? stored.models : [],
    validationCostUsd: 0 as const
  }
}

export class WritingSetupService {
  private readonly vaults: Record<WritingProvider, WritingCredentialVault>
  private readonly providers: Record<WritingProvider, WritingTextProvider>
  private readonly settingsStore: WritingSettingsStore
  private readonly now: () => Date

  constructor(options: WritingSetupServiceOptions) {
    this.vaults = options.vaults
    this.providers = options.providers
    this.settingsStore = options.settingsStore
    this.now = options.now ?? (() => new Date())
  }

  async getStatus(): Promise<WritingSettingsStatus> {
    const [record, openaiStored, anthropicStored, geminiStored] = await Promise.all([
      this.settingsStore.load(),
      this.vaults.openai.hasSecret(),
      this.vaults.anthropic.hasSecret(),
      this.vaults.gemini.hasSecret()
    ])
    return WritingSettingsStatusSchema.parse({
      providers: {
        openai: statusForProvider('openai', record, openaiStored),
        anthropic: statusForProvider('anthropic', record, anthropicStored),
        gemini: statusForProvider('gemini', record, geminiStored)
      },
      defaultProfile: record.defaultProfile,
      paidDraftsRequireConfirmation: true
    })
  }

  async connect(unknownInput: unknown): Promise<WritingSettingsStatus> {
    const { provider, apiKey } = WritingConnectInputSchema.parse(unknownInput)
    const availableModels = WritingModelOptionSchema.array()
      .max(100)
      .parse(await this.providers[provider].listModels(apiKey))
    const availableIds = new Set(availableModels.map((model) => model.id))
    const models = WRITING_MODEL_CATALOG[provider]
      .filter((model) => availableIds.has(model.id))
      .map(({ id, displayName }) => ({ id, displayName }))
    if (models.length === 0) {
      throw new WritingServiceError(
        'unsupported-model',
        'The key works, but none of this studio version\u2019s approved writing models are available to it. Check the provider account or update the studio model catalogue.'
      )
    }
    const record = await this.settingsStore.load()
    const vault = this.vaults[provider]
    const hadPreviousSecret = await vault.hasSecret()
    const previousSecret = hadPreviousSecret ? await vault.readSecret() : null

    await vault.storeSecret(apiKey)
    try {
      const defaultProfile =
        record.defaultProfile?.provider === provider &&
        !models.some((model) => model.id === record.defaultProfile?.model)
          ? null
          : record.defaultProfile
      await this.settingsStore.save({
        ...record,
        providers: {
          ...record.providers,
          [provider]: {
            enabled: true,
            checkedAt: this.now().toISOString(),
            models
          }
        },
        defaultProfile
      })
    } catch (error) {
      if (previousSecret !== null) await vault.storeSecret(previousSecret)
      else await vault.removeSecret()
      throw error
    }
    return this.getStatus()
  }

  async refresh(unknownInput: unknown): Promise<WritingSettingsStatus> {
    const { provider } = WritingProviderInputSchema.parse(unknownInput)
    if (!(await this.vaults[provider].hasSecret())) {
      throw new WritingServiceError(
        'not-connected',
        `Connect ${providerName(provider)} before refreshing it.`
      )
    }
    return this.connect({ provider, apiKey: await this.vaults[provider].readSecret() })
  }

  async disconnect(unknownInput: unknown): Promise<WritingSettingsStatus> {
    const { provider } = WritingProviderInputSchema.parse(unknownInput)
    await this.vaults[provider].removeSecret()
    const record = await this.settingsStore.load()
    await this.settingsStore.save({
      ...record,
      providers: {
        ...record.providers,
        [provider]: defaultProvider()
      },
      defaultProfile: record.defaultProfile?.provider === provider ? null : record.defaultProfile
    })
    return this.getStatus()
  }

  async setEnabled(unknownInput: unknown): Promise<WritingSettingsStatus> {
    const { provider, enabled } = WritingProviderEnabledInputSchema.parse(unknownInput)
    if (!(await this.vaults[provider].hasSecret())) {
      throw new WritingServiceError(
        'not-connected',
        `Connect ${providerName(provider)} before changing its availability.`
      )
    }
    const record = await this.settingsStore.load()
    await this.settingsStore.save({
      ...record,
      providers: {
        ...record.providers,
        [provider]: { ...record.providers[provider], enabled }
      },
      defaultProfile:
        !enabled && record.defaultProfile?.provider === provider ? null : record.defaultProfile
    })
    return this.getStatus()
  }

  async saveDefaultProfile(unknownInput: unknown): Promise<WritingSettingsStatus> {
    const input = WritingDefaultProfileSchema.parse(unknownInput)
    const status = await this.getStatus()
    const providerStatus = status.providers[input.provider]
    if (providerStatus.connectionState !== 'connected' || !providerStatus.enabled) {
      throw new WritingServiceError(
        'disabled',
        'Connect and enable that writing service before selecting it.'
      )
    }
    if (!providerStatus.models.some((model) => model.id === input.model)) {
      throw new WritingServiceError(
        'unsupported-model',
        'Refresh the provider models and choose an available writing model.'
      )
    }
    const record = await this.settingsStore.load()
    await this.settingsStore.save({ ...record, defaultProfile: input })
    return this.getStatus()
  }

  async getReadyProvider(provider: WritingProvider, model: string) {
    const status = await this.getStatus()
    const providerStatus = status.providers[provider]
    if (!providerStatus.credentialStored) {
      throw new WritingServiceError(
        'not-connected',
        `Connect ${providerName(provider)} in Settings first.`
      )
    }
    if (!providerStatus.enabled || providerStatus.connectionState === 'disabled') {
      throw new WritingServiceError('disabled', 'That writing service is currently disabled.')
    }
    if (!providerStatus.models.some((option) => option.id === model)) {
      throw new WritingServiceError(
        'unsupported-model',
        'The selected model is no longer in the checked model list. Refresh it in Settings.'
      )
    }
    return {
      client: this.providers[provider],
      apiKey: await this.vaults[provider].readSecret()
    }
  }
}

const taskLabels = {
  design_creative_direction: 'audience and creative direction design',
  develop_character: 'character development',
  build_world: 'world building',
  outline_episode: 'episode outlining',
  plan_storyboard: 'shot-by-shot storyboard planning',
  draft_scene: 'scene drafting',
  rewrite_dialogue: 'dialogue rewriting',
  check_continuity: 'continuity checking',
  design_visual_generation: 'image and visual-generation direction',
  design_voice_performance: 'character voice and performance direction',
  plan_motion: 'shot movement and camera planning',
  plan_advanced_controls: 'pose, depth, edge, mask, layer, and motion-control planning',
  plan_edit_sound: 'timeline, caption, and sound-layer planning',
  plan_foley: 'ambience, effects, and foley cue planning',
  plan_adaptation: 'optional project adaptation planning',
  plan_thumbnail: 'truthful thumbnail concept planning',
  analyze_performance: 'evidence-only post-release performance analysis',
  plan_youtube_release: 'YouTube release packaging and search discovery planning'
} as const

const taskGuidance: Record<WritingTaskKind, string> = {
  design_creative_direction:
    'Propose a coherent audience, niche, genres, tone, themes, viewer promise, cultural setting, boundaries, format, visual direction, honest YouTube positioning, non-copying comparables, and distinctive angle. Treat the result as creative guidance, never a platform or legal declaration.',
  develop_character:
    'Define motives, contradictions, relationships, voice, visual anchors, and development risks.',
  build_world:
    'Define repeatable locations, rules, culture, props, visual anchors, and story constraints.',
  outline_episode:
    'Provide acts, scene purposes, reversals, emotional turns, continuity dependencies, and an ending.',
  plan_storyboard:
    'Use stable shot IDs. For every shot state location, characters, framing, camera, action, emotion, dialogue or narration, sound, intended duration, transition, and continuity anchors.',
  draft_scene:
    'Write playable scene action and dialogue with clear staging, emotional intention, and continuity anchors.',
  rewrite_dialogue:
    'Preserve plot facts while improving character-specific voice, subtext, rhythm, and speakability.',
  check_continuity:
    'Separate confirmed conflicts, possible risks, missing facts, and suggested repairs. Do not silently rewrite canon.',
  design_visual_generation:
    'Create paste-ready visual prompts grounded in the selected project direction. Separate identity anchors, rendering style, composition, lighting, environment, continuity requirements, and things to avoid. Do not imitate a living artist or claim rights that were not supplied.',
  design_voice_performance:
    'Define an original character voice, speaking rhythm, emotional range, pronunciation needs, calibration lines, and line-delivery direction. Do not suggest cloning a real person or using a reference without consent.',
  plan_motion:
    'Describe subject movement, camera movement, performance beats, timing, start/end states, continuity locks, and failure risks for short animated shots. Keep vendor-specific parameters separate from creative intent.',
  plan_advanced_controls:
    'Recommend only the controls that materially reduce ambiguity: start/end frames, pose, depth, edges, segmentation, masks, layers, motion tracks, or rights-cleared reference clips. State each control purpose, source, scope, and compatibility question.',
  plan_edit_sound:
    'Plan visual order, shot durations, dialogue placement, ambience, effects, music placeholders, caption cues, transitions, pacing checks, and final review checkpoints. Preserve approved dialogue as a separate source.',
  plan_foley:
    'Create a time-addressable ambience, effects, and foley cue plan. Separate diegetic and non-diegetic sound, identify rights/source needs, preserve dialogue and music, and flag sounds that need human review.',
  plan_adaptation:
    'First challenge whether a project-scoped adaptation is necessary. If it may be, define the failed reference-only benchmark, rights-cleared dataset, captions/tags, base model, scope, evaluation, regression risks, cost limit, promotion threshold, and rollback. Never imply training is already authorized.',
  plan_thumbnail:
    'Propose truthful thumbnail concepts based only on the production facts supplied. Include subject, expression/action, composition, short optional words, contrast, small-card readability, continuity checks, and misleading-imagery risks.',
  analyze_performance:
    'Separate observations from inferences and recommendations. Cite the supplied metric/time-window evidence, identify missing or low-sample data, compare only compatible releases, state confidence, and never change live metadata, canon, media, or spend.',
  plan_youtube_release:
    'Propose three truthful titles no longer than 100 characters, one description no longer than 5000 characters, tags, up to 15 hashtags, chapters beginning at 0:00, thumbnail concepts that accurately represent the video, credits, made-for-kids questions, and synthetic-media disclosure questions. Never promise views or fabricate keywords.'
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function emptySkillPlan(projectId: string, taskKind: WritingTaskKind): ResolvedWritingSkillPlan {
  const required: ExternalSkillPlanPreview['required'] = []
  const optional: ExternalSkillPlanPreview['optional'] = []
  return {
    preview: ExternalSkillPlanPreviewSchema.parse({
      projectId,
      taskKind,
      planSha256: hash(JSON.stringify({ projectId, taskKind, required, optional })),
      required,
      optional,
      blockingIssues: [],
      ready: true
    }),
    readyManifests: []
  }
}

function normalizeHeading(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function validateSkillOutput(
  manifest: ExternalSkillManifest,
  output: CreativeDraftContent
): string | null {
  if (output.sections.length < manifest.outputSchema.minimumSections) {
    return `Expected at least ${manifest.outputSchema.minimumSections} proposal sections.`
  }
  const headings = new Set(output.sections.map((section) => normalizeHeading(section.heading)))
  const missing = manifest.outputSchema.requiredSectionHeadings.filter(
    (heading) => !headings.has(normalizeHeading(heading))
  )
  return missing.length === 0 ? null : `Missing required section: ${missing.join(', ')}.`
}

function skillInstructions(manifests: ExternalSkillManifest[]): string {
  if (manifests.length === 0) return 'No external creative skills are attached to this request.'
  return manifests
    .map((manifest, index) =>
      [
        `SKILL ${index + 1}: ${manifest.displayName} ${manifest.version}`,
        `Skill ID: ${manifest.skillId}`,
        `Package SHA-256: ${manifest.packageSha256}`,
        `Instructions: ${manifest.instructions}`,
        `Required proposal section headings: ${manifest.outputSchema.requiredSectionHeadings.join(', ') || 'none beyond the studio schema'}.`
      ].join('\n')
    )
    .join('\n\n')
}

function toReceipt(
  receiptId: string,
  manifest: ExternalSkillManifest,
  taskKind: WritingTaskKind,
  inputSha256: string,
  outputSha256: string,
  providerRequestId: string,
  startedAt: string,
  completedAt: string,
  failureReason: string | null
): ExternalSkillExecutionReceipt {
  return {
    receiptId,
    skillId: manifest.skillId,
    displayName: manifest.displayName,
    skillVersion: manifest.version,
    packageSha256: manifest.packageSha256,
    executionClass: manifest.executionClass,
    taskKind,
    status: failureReason === null ? 'succeeded' : 'failed',
    startedAt,
    completedAt,
    durationMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()),
    inputSha256,
    outputSha256,
    providerRequestId,
    applicationMode: 'provider-instructions',
    failureReason
  }
}

function buildContext(project: ProjectDetails, selection: WritingContextPreviewInput['context']) {
  const manifest = project.manifest
  const sections: string[] = []
  if (selection.includeProjectBrief) {
    sections.push(
      [
        'PROJECT BRIEF',
        `Title: ${manifest.title}`,
        `Project type: ${manifest.type === 'series' ? 'animated series' : 'one-off animated film'}`,
        `Primary language: ${manifest.language}`,
        `Brief: ${manifest.pilotBrief || 'No brief has been written yet.'}`
      ].join('\n')
    )
  }
  if (selection.includeProductionSettings) {
    sections.push(
      [
        'PRODUCTION SETTINGS',
        `Target duration: ${manifest.targetDurationMinutes} minutes`,
        `Visual direction: ${manifest.visualDirection}`,
        `Source mode: ${manifest.sourceMode}`,
        `Current status: ${manifest.status}`
      ].join('\n')
    )
  }
  if (selection.includeCreativeDirection) {
    const profile = project.creativeDirection
    if (profile) {
      const direction = profile.direction
      sections.push(
        [
          'AUDIENCE & CREATIVE DIRECTION',
          `Target audience: ${direction.targetAudience}`,
          `Creative age band: ${direction.ageBand}`,
          `Primary niche: ${direction.primaryNiche}`,
          `Genres: ${direction.genres.join(', ')}`,
          `Tone: ${direction.toneKeywords.join(', ')}`,
          `Core themes: ${direction.coreThemes.join(', ') || 'Not specified'}`,
          `Viewer promise: ${direction.storyPromise}`,
          `Cultural or story setting: ${direction.culturalSetting || 'Not specified'}`,
          `Content boundaries: ${direction.contentBoundaries.join('; ') || 'Not specified'}`,
          `Episode or film format: ${direction.episodeFormat}`,
          `YouTube positioning: ${direction.youtubePositioning || 'Not specified'}`,
          `Visual style notes: ${direction.visualStyleNotes || 'Not specified'}`,
          `Comparable directional references: ${direction.comparableTitles.join(', ') || 'None'}`,
          `Distinctive angle: ${direction.differentiation || 'Not specified'}`,
          'Use comparable productions only as high-level direction. Do not copy protected characters, plots, dialogue, or visual expression.',
          'Creative age guidance is not a YouTube made-for-kids or policy declaration.'
        ].join('\n')
      )
    } else {
      sections.push('AUDIENCE & CREATIVE DIRECTION\nNo project direction has been set yet.')
    }
  }
  const text = sections.length > 0 ? sections.join('\n\n') : 'No local project context selected.'
  const normalizedManifest = JSON.stringify(manifest)
  const sourceVersions: WritingContextPreview['sourceVersions'] = [
    {
      kind: 'project-manifest',
      id: manifest.id,
      schemaVersion: manifest.schemaVersion,
      updatedAt: manifest.updatedAt,
      sha256: hash(normalizedManifest)
    }
  ]
  if (selection.includeCreativeDirection && project.creativeDirection) {
    const profile = project.creativeDirection
    sourceVersions.push({
      kind: 'creative-direction',
      id: profile.profileId,
      schemaVersion: profile.schemaVersion,
      revision: profile.revision,
      updatedAt: profile.createdAt,
      sha256: hash(JSON.stringify(profile))
    })
  }
  return WritingContextPreviewSchema.parse({
    text,
    sha256: hash(text),
    sourceVersions
  })
}

export interface CreativeWritingServiceOptions {
  setup: WritingSetupService
  projectStore: WritingProjectStore
  skillPlanner?: ExternalWritingSkillPlanner
  now?: () => Date
  createId?: () => string
  createReceiptId?: () => string
}

export class CreativeWritingService {
  private readonly setup: WritingSetupService
  private readonly projectStore: WritingProjectStore
  private readonly skillPlanner: ExternalWritingSkillPlanner
  private readonly now: () => Date
  private readonly createId: () => string
  private readonly createReceiptId: () => string

  constructor(options: CreativeWritingServiceOptions) {
    this.setup = options.setup
    this.projectStore = options.projectStore
    this.skillPlanner =
      options.skillPlanner ??
      ({
        getPlan: async (projectId, taskKind) => emptySkillPlan(projectId, taskKind)
      } satisfies ExternalWritingSkillPlanner)
    this.now = options.now ?? (() => new Date())
    this.createId = options.createId ?? (() => createUlid())
    this.createReceiptId = options.createReceiptId ?? (() => createUlid())
  }

  async previewSkillPlan(
    projectId: string,
    taskKind: WritingTaskKind
  ): Promise<ExternalSkillPlanPreview> {
    this.projectStore.openProject(projectId)
    try {
      return (await this.skillPlanner.getPlan(projectId, taskKind)).preview
    } catch (error) {
      throw new WritingServiceError(
        'skill-error',
        error instanceof Error
          ? error.message
          : 'The local skill plan could not be prepared safely.'
      )
    }
  }

  previewContext(unknownInput: unknown): WritingContextPreview {
    const input = WritingContextPreviewInputSchema.parse(unknownInput)
    return buildContext(this.projectStore.openProject(input.projectId), input.context)
  }

  listDrafts(projectId: string): WritingDraftRecord[] {
    return this.projectStore.listWritingDrafts(projectId)
  }

  async generateDraft(unknownInput: unknown): Promise<WritingDraftRecord> {
    const input = WritingDraftRequestSchema.parse(unknownInput)
    const project = this.projectStore.openProject(input.projectId)
    const context = buildContext(project, input.context)
    let resolvedPlan: ResolvedWritingSkillPlan
    try {
      resolvedPlan = await this.skillPlanner.getPlan(input.projectId, input.taskKind)
    } catch (error) {
      throw new WritingServiceError(
        'skill-error',
        error instanceof Error ? error.message : 'The local skill plan could not be read safely.'
      )
    }
    if (resolvedPlan.preview.planSha256 !== input.skillPlanSha256) {
      throw new WritingServiceError(
        'skill-plan-changed',
        'The attached-skill plan changed after the preview. Review it again before approving this request.'
      )
    }
    if (!resolvedPlan.preview.ready) {
      throw new WritingServiceError(
        'required-skill-failed',
        resolvedPlan.preview.blockingIssues[0] ??
          'A required attached skill is not ready for this task.'
      )
    }
    for (const manifest of resolvedPlan.readyManifests) {
      const missingContext = manifest.inputSchema.requiredContext.filter((requiredContext) => {
        if (requiredContext === 'project-brief') return !input.context.includeProjectBrief
        if (requiredContext === 'production-settings') {
          return !input.context.includeProductionSettings
        }
        return !input.context.includeCreativeDirection || project.creativeDirection === null
      })
      if (missingContext.length > 0) {
        throw new WritingServiceError(
          manifest.required ? 'required-skill-failed' : 'skill-error',
          `${manifest.displayName} needs ${missingContext.join(', ')} in the selected context. Select it or disable that skill for this project.`
        )
      }
    }

    const skillsPlanned = [...resolvedPlan.preview.required, ...resolvedPlan.preview.optional]
    const ready = await this.setup.getReadyProvider(input.provider, input.model)
    const providerStartedAt = this.now().toISOString()
    const response = await ready.client.generateDraft(ready.apiKey, {
      model: input.model,
      maxOutputTokens: input.maxOutputTokens,
      systemInstruction: [
        'You are the creative writing assistant inside Animated Series Studio.',
        'Return a structured proposal, never an approved canon change.',
        'Respect the supplied project facts and clearly identify gaps as continuity questions.',
        'Apply every attached skill instruction exactly. Never claim an unattached skill, research source, image, voice, or GPU tool was used.',
        `Write primarily in ${project.manifest.language}.`,
        input.profile === 'best-draft'
          ? 'Prioritise depth, specificity, emotional logic, and production-ready detail.'
          : input.profile === 'balanced'
            ? 'Balance useful detail with concise, reviewable sections.'
            : 'Follow the user instruction closely without assuming extra style preferences.',
        skillInstructions(resolvedPlan.readyManifests)
      ].join('\n\n'),
      userPrompt: [
        `TASK: ${taskLabels[input.taskKind]}`,
        `TASK-SPECIFIC DELIVERABLE:\n${taskGuidance[input.taskKind]}`,
        `USER INSTRUCTION:\n${input.instruction}`,
        `EXACT LOCAL CONTEXT SELECTED BY THE USER:\n${context.text}`,
        `EXACT ATTACHED-SKILL PLAN SHA-256: ${resolvedPlan.preview.planSha256}`
      ].join('\n\n')
    })
    const providerCompletedAt = this.now().toISOString()
    const outputSha256 = hash(JSON.stringify(response.output))
    const skillsUsed = resolvedPlan.readyManifests.map((manifest) => {
      const failureReason = validateSkillOutput(manifest, response.output)
      return toReceipt(
        this.createReceiptId(),
        manifest,
        input.taskKind,
        hash(
          JSON.stringify({
            skillId: manifest.skillId,
            version: manifest.version,
            packageSha256: manifest.packageSha256,
            instruction: input.instruction,
            contextSha256: context.sha256,
            planSha256: input.skillPlanSha256
          })
        ),
        outputSha256,
        response.requestId,
        providerStartedAt,
        providerCompletedAt,
        failureReason
      )
    })
    const failedRequired = skillsUsed.find(
      (receipt) =>
        receipt.status === 'failed' &&
        resolvedPlan.readyManifests.find((manifest) => manifest.skillId === receipt.skillId)
          ?.required
    )
    if (failedRequired) {
      throw new WritingServiceError(
        'required-skill-failed',
        `${failedRequired.displayName} ${failedRequired.skillVersion} was included, but its required output was missing. No proposal was saved.`
      )
    }

    const draft = WritingDraftRecordSchema.parse({
      schemaVersion: 3,
      draftId: this.createId(),
      projectId: input.projectId,
      taskKind: input.taskKind,
      status: 'proposal',
      provider: input.provider,
      model: input.model,
      profile: input.profile,
      createdAt: this.now().toISOString(),
      instruction: input.instruction,
      contextSelection: input.context,
      contextSnapshotSha256: context.sha256,
      sourceVersions: context.sourceVersions,
      output: response.output,
      usage: response.usage,
      cost: {
        currency: 'USD',
        estimatedUsd: null,
        actualUsd: null,
        state: 'not-calculated'
      },
      providerRequestId: response.requestId,
      skillPlanSha256: resolvedPlan.preview.planSha256,
      skillsPlanned,
      skillsUsed
    })
    return this.projectStore.saveWritingDraft(draft)
  }
}

export function toWritingActionError(
  error: unknown
): Extract<WritingDraftActionResult, { ok: false }> {
  if (
    error instanceof OpenAiProviderError ||
    error instanceof AnthropicProviderError ||
    error instanceof GeminiProviderError
  ) {
    return { ok: false, error: { code: error.code, message: error.message } }
  }
  if (error instanceof CredentialVaultError) {
    return {
      ok: false,
      error: {
        code: error.code === 'unavailable' ? 'secure-storage-unavailable' : 'secure-storage-error',
        message: error.message
      }
    }
  }
  if (error instanceof WritingServiceError) {
    return { ok: false, error: { code: error.code, message: error.message } }
  }
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: {
        code: 'invalid-input',
        message: error.issues[0]?.message ?? 'Check the writing request and try again.'
      }
    }
  }
  return {
    ok: false,
    error: {
      code: 'unknown',
      message: 'The writing request could not be completed safely. No proposal was saved.'
    }
  }
}

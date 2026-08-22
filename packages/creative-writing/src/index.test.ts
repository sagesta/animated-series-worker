import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ExternalSkillManifest,
  ProjectDetails,
  WritingDraftRecord,
  WritingProvider,
  WritingTextProvider
} from '@studio/contracts'
import {
  CreativeWritingService,
  WritingSettingsStore,
  WritingSetupService,
  type ExternalWritingSkillPlanner,
  type WritingCredentialVault
} from './index'

const roots: string[] = []

class MemoryVault implements WritingCredentialVault {
  secret: string | null = null

  async hasSecret(): Promise<boolean> {
    return this.secret !== null
  }

  async storeSecret(secret: string): Promise<void> {
    this.secret = secret
  }

  async readSecret(): Promise<string> {
    if (this.secret === null) throw new Error('missing')
    return this.secret
  }

  async removeSecret(): Promise<void> {
    this.secret = null
  }
}

const project: ProjectDetails = {
  manifest: {
    schemaVersion: 2,
    id: '01J00000000000000000000000',
    code: 'LANTERN-KEEPERS',
    type: 'series',
    title: 'Lantern Keepers',
    status: 'development',
    language: 'English',
    targetDurationMinutes: 24,
    visualDirection: '2d',
    sourceMode: 'original',
    pilotBrief: 'A shy apprentice protects a city whose lanterns preserve memories.',
    deliveryProfileId: 'youtube-1080p24-v1',
    budgetPolicyId: 'local-safe-default-v1',
    folderName: 'lantern-keepers-01j00000000000000000000000',
    cloudGpuState: 'not-configured',
    safeCheckpoint: {
      label: 'Project created safely',
      createdAt: '2026-08-21T12:00:00.000Z'
    },
    lifecycle: { archivedAt: null, statusBeforeArchive: null },
    createdAt: '2026-08-21T12:00:00.000Z',
    updatedAt: '2026-08-21T12:00:00.000Z'
  },
  workspacePath: 'C:\\Studio\\projects\\lantern-keepers',
  creativeDirection: {
    schemaVersion: 1,
    profileId: '01J00000000000000000000008',
    projectId: '01J00000000000000000000000',
    revision: 1,
    createdAt: '2026-08-21T12:00:00.000Z',
    direction: {
      targetAudience: 'Families and viewers aged 9–15 who enjoy adventurous fantasy.',
      ageBand: 'all-ages',
      primaryNiche: 'African folklore fantasy adventures',
      genres: ['fantasy', 'mystery'],
      toneKeywords: ['warm', 'adventurous'],
      coreThemes: ['belonging', 'memory'],
      storyPromise: 'Every episode combines a magical mystery with an emotionally hopeful turn.',
      culturalSetting: 'A fictional West African coastal kingdom.',
      contentBoundaries: ['No graphic violence'],
      episodeFormat: 'A recurring 24-minute animated episode.',
      youtubePositioning: 'Original serialized fantasy for family co-viewing.',
      visualStyleNotes: 'Graphic 2D shapes with painted light.',
      comparableTitles: [],
      differentiation: 'Memory is a physical force protected by a community of young keepers.'
    }
  }
}

function createFixture(skillPlanner?: ExternalWritingSkillPlanner) {
  const root = mkdtempSync(join(tmpdir(), 'creative-writing-test-'))
  roots.push(root)
  const vaults: Record<WritingProvider, MemoryVault> = {
    openai: new MemoryVault(),
    anthropic: new MemoryVault(),
    gemini: new MemoryVault()
  }
  const generateDraft = vi.fn<WritingTextProvider['generateDraft']>().mockResolvedValue({
    output: {
      title: 'The First Dark Lantern',
      summary: 'An episode outline proposal.',
      sections: [{ heading: 'Act one', body: 'The apprentice discovers an unlit memory.' }],
      continuityQuestions: ['Who last handled the lantern?'],
      suggestedNextSteps: ['Define the mentor’s secret.']
    },
    usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180, cachedInputTokens: 10 },
    requestId: 'provider-request-1'
  })
  const openai: WritingTextProvider = {
    listModels: vi.fn().mockResolvedValue([
      { id: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra' },
      { id: 'gpt-preview-unapproved', displayName: 'Unapproved preview' }
    ]),
    generateDraft
  }
  const anthropic: WritingTextProvider = {
    listModels: vi
      .fn()
      .mockResolvedValue([{ id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' }]),
    generateDraft: vi.fn()
  }
  const gemini: WritingTextProvider = {
    listModels: vi
      .fn()
      .mockResolvedValue([{ id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash' }]),
    generateDraft: vi.fn()
  }
  const setup = new WritingSetupService({
    vaults,
    providers: { openai, anthropic, gemini },
    settingsStore: new WritingSettingsStore(join(root, 'writing.json')),
    now: () => new Date('2026-08-21T13:00:00.000Z')
  })
  const saved: WritingDraftRecord[] = []
  const creative = new CreativeWritingService({
    setup,
    projectStore: {
      openProject: (projectId) => {
        if (projectId !== project.manifest.id) throw new Error('wrong project')
        return project
      },
      saveWritingDraft: (draft) => {
        saved.push(draft)
        return draft
      },
      listWritingDrafts: () => saved
    },
    skillPlanner,
    now: () => new Date('2026-08-21T14:00:00.000Z'),
    createId: () => '01J00000000000000000000001',
    createReceiptId: () => '01J00000000000000000000002'
  })
  return { setup, creative, vaults, openai, generateDraft, saved }
}

function skillFixture(required = true): {
  manifest: ExternalSkillManifest
  planner: ExternalWritingSkillPlanner
} {
  const manifest: ExternalSkillManifest = {
    schemaVersion: 1,
    skillId: 'story-emotion-map',
    displayName: 'Story Emotion Map',
    description: 'Checks that an outline contains a clear emotional turn and consequence.',
    publisher: 'Studio fixture publisher',
    version: '1.0.0',
    source: 'local-fixture',
    taskKinds: ['outline_episode'],
    instructionsEntry: 'inline',
    instructions:
      'Add a proposal section named Emotional Turn that explains the cause, choice, and consequence.',
    inputSchema: {
      contract: 'studio-writing-context-v1',
      requiredContext: ['project-brief']
    },
    outputSchema: {
      contract: 'studio-creative-draft-v1',
      minimumSections: 1,
      requiredSectionHeadings: ['Emotional Turn']
    },
    requestedPermissions: ['read-project'],
    executionClass: 'declarative',
    required,
    compatibility: { minStudioVersion: '0.8.0' },
    packageSha256: 'd'.repeat(64),
    signatureStatus: 'unverified',
    installedAt: '2026-08-21T13:00:00.000Z'
  }
  const planItem = {
    skillId: manifest.skillId,
    displayName: manifest.displayName,
    version: manifest.version,
    publisher: manifest.publisher,
    source: manifest.source,
    packageSha256: manifest.packageSha256,
    signatureStatus: manifest.signatureStatus,
    executionClass: manifest.executionClass,
    taskKind: 'outline_episode' as const,
    required,
    requestedPermissions: manifest.requestedPermissions,
    requiredContext: manifest.inputSchema.requiredContext,
    instructionsSha256: 'e'.repeat(64),
    state: 'ready' as const,
    reason: 'Matches episode or film outlines.'
  }
  return {
    manifest,
    planner: {
      getPlan: async (projectId, taskKind) => ({
        preview: {
          projectId,
          taskKind,
          planSha256: 'f'.repeat(64),
          required: required ? [{ ...planItem, taskKind }] : [],
          optional: required ? [] : [{ ...planItem, taskKind }],
          blockingIssues: [],
          ready: true
        },
        readyManifests: manifest.taskKinds.includes(taskKind) ? [manifest] : []
      })
    }
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('protected creative writing workflow', () => {
  it('connects providers independently with a no-cost model-list check', async () => {
    const { setup, vaults, openai } = createFixture()
    const status = await setup.connect({
      provider: 'openai',
      apiKey: 'sk-test-protected-key-123456789'
    })

    expect(openai.listModels).toHaveBeenCalledOnce()
    expect(vaults.openai.secret).toBe('sk-test-protected-key-123456789')
    expect(vaults.anthropic.secret).toBeNull()
    expect(status.providers.openai).toMatchObject({
      connectionState: 'connected',
      validationCostUsd: 0,
      models: [{ id: 'gpt-5.6-terra' }]
    })
    expect(status.providers.anthropic.connectionState).toBe('not-configured')
  })

  it('refuses a valid key when it exposes no release-approved model', async () => {
    const { setup, openai, vaults } = createFixture()
    vi.mocked(openai.listModels).mockResolvedValue([
      { id: 'gpt-preview-unapproved', displayName: 'Unapproved preview' }
    ])

    await expect(
      setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    ).rejects.toMatchObject({ code: 'unsupported-model' })
    expect(vaults.openai.secret).toBeNull()
  })

  it('reads previous writing settings without losing existing provider state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'creative-writing-migration-test-'))
    roots.push(root)
    const filePath = join(root, 'writing.json')
    writeFileSync(
      filePath,
      JSON.stringify({
        schemaVersion: 1,
        providers: {
          openai: {
            enabled: true,
            checkedAt: '2026-08-21T13:00:00.000Z',
            models: [{ id: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra' }]
          },
          anthropic: { enabled: false, checkedAt: null, models: [] }
        },
        defaultProfile: { provider: 'openai', model: 'gpt-5.6-terra', profile: 'balanced' }
      })
    )

    await expect(new WritingSettingsStore(filePath).load()).resolves.toMatchObject({
      schemaVersion: 2,
      providers: {
        openai: { models: [{ id: 'gpt-5.6-terra' }] },
        anthropic: { enabled: false },
        gemini: { enabled: true, checkedAt: null, models: [] }
      }
    })
  })

  it('previews exact selected context and saves immutable proposal lineage', async () => {
    const { setup, creative, generateDraft, saved } = createFixture()
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    const context = {
      includeProjectBrief: true,
      includeProductionSettings: false,
      includeCreativeDirection: true
    }
    const preview = creative.previewContext({ projectId: project.manifest.id, context })
    const skillPlan = await creative.previewSkillPlan(project.manifest.id, 'outline_episode')

    expect(preview.text).toContain('A shy apprentice protects a city')
    expect(preview.text).toContain('African folklore fantasy adventures')
    expect(preview.text).toContain('not a YouTube made-for-kids')
    expect(preview.text).not.toContain('Target duration')
    expect(preview.sourceVersions).toHaveLength(2)

    const result = await creative.generateDraft({
      projectId: project.manifest.id,
      taskKind: 'outline_episode',
      instruction: 'Outline a pilot with a strong emotional turn and a final story question.',
      context,
      provider: 'openai',
      model: 'gpt-5.6-terra',
      profile: 'balanced',
      maxOutputTokens: 1600,
      skillPlanSha256: skillPlan.planSha256,
      paidConfirmed: true
    })

    expect(generateDraft).toHaveBeenCalledWith(
      'sk-test-protected-key-123456789',
      expect.objectContaining({
        model: 'gpt-5.6-terra',
        userPrompt: expect.stringContaining(preview.text)
      })
    )
    expect(saved).toHaveLength(1)
    expect(result).toMatchObject({
      status: 'proposal',
      contextSnapshotSha256: preview.sha256,
      providerRequestId: 'provider-request-1',
      skillsPlanned: [],
      skillsUsed: [],
      cost: { state: 'not-calculated', estimatedUsd: null, actualUsd: null }
    })
    expect(result.sourceVersions).toEqual(preview.sourceVersions)
  })

  it('blocks a text request unless paid confirmation is explicit', async () => {
    const { setup, creative, generateDraft, saved } = createFixture()
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    const skillPlan = await creative.previewSkillPlan(project.manifest.id, 'draft_scene')

    await expect(
      creative.generateDraft({
        projectId: project.manifest.id,
        taskKind: 'draft_scene',
        instruction: 'Draft the opening scene with clear emotional actions and concise dialogue.',
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        provider: 'openai',
        model: 'gpt-5.6-terra',
        profile: 'balanced',
        maxOutputTokens: 800,
        skillPlanSha256: skillPlan.planSha256,
        paidConfirmed: false
      })
    ).rejects.toThrow()
    expect(generateDraft).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })

  it('applies an enabled declarative skill to the provider request and records an exact receipt', async () => {
    const skill = skillFixture()
    const { setup, creative, generateDraft, saved } = createFixture(skill.planner)
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    generateDraft.mockResolvedValue({
      output: {
        title: 'The First Dark Lantern',
        summary: 'An episode outline proposal.',
        sections: [
          {
            heading: 'Emotional Turn',
            body: 'The apprentice chooses to restore a painful memory instead of hiding it.'
          }
        ],
        continuityQuestions: [],
        suggestedNextSteps: []
      },
      usage: { inputTokens: 120, outputTokens: 90, totalTokens: 210, cachedInputTokens: 0 },
      requestId: 'provider-request-with-skill'
    })
    const plan = await creative.previewSkillPlan(project.manifest.id, 'outline_episode')

    const result = await creative.generateDraft({
      projectId: project.manifest.id,
      taskKind: 'outline_episode',
      instruction: 'Outline a pilot with a clear emotional turn and a lasting consequence.',
      context: {
        includeProjectBrief: true,
        includeProductionSettings: true,
        includeCreativeDirection: true
      },
      provider: 'openai',
      model: 'gpt-5.6-terra',
      profile: 'balanced',
      maxOutputTokens: 1600,
      skillPlanSha256: plan.planSha256,
      paidConfirmed: true
    })

    expect(generateDraft).toHaveBeenCalledWith(
      'sk-test-protected-key-123456789',
      expect.objectContaining({
        systemInstruction: expect.stringContaining(skill.manifest.instructions),
        userPrompt: expect.stringContaining(plan.planSha256)
      })
    )
    expect(saved).toHaveLength(1)
    expect(result).toMatchObject({
      schemaVersion: 3,
      skillPlanSha256: plan.planSha256,
      skillsPlanned: [{ skillId: skill.manifest.skillId, state: 'ready' }],
      skillsUsed: [
        {
          receiptId: '01J00000000000000000000002',
          skillId: skill.manifest.skillId,
          skillVersion: '1.0.0',
          status: 'succeeded',
          applicationMode: 'provider-instructions'
        }
      ]
    })
  })

  it('fails a required skill when the provider omits its declared output section', async () => {
    const skill = skillFixture()
    const { setup, creative, generateDraft, saved } = createFixture(skill.planner)
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    const plan = await creative.previewSkillPlan(project.manifest.id, 'outline_episode')

    await expect(
      creative.generateDraft({
        projectId: project.manifest.id,
        taskKind: 'outline_episode',
        instruction: 'Outline a pilot and make the emotional cause and consequence explicit.',
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        provider: 'openai',
        model: 'gpt-5.6-terra',
        profile: 'balanced',
        maxOutputTokens: 1600,
        skillPlanSha256: plan.planSha256,
        paidConfirmed: true
      })
    ).rejects.toMatchObject({ code: 'required-skill-failed' })

    expect(generateDraft).toHaveBeenCalledOnce()
    expect(saved).toEqual([])
  })

  it('blocks a stale attached-skill preview before contacting the provider', async () => {
    const skill = skillFixture()
    const { setup, creative, generateDraft, saved } = createFixture(skill.planner)
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })

    await expect(
      creative.generateDraft({
        projectId: project.manifest.id,
        taskKind: 'outline_episode',
        instruction: 'Outline a pilot with a clear emotional turn and final story question.',
        context: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        provider: 'openai',
        model: 'gpt-5.6-terra',
        profile: 'balanced',
        maxOutputTokens: 1600,
        skillPlanSha256: '0'.repeat(64),
        paidConfirmed: true
      })
    ).rejects.toMatchObject({ code: 'skill-plan-changed' })

    expect(generateDraft).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })

  it('blocks a required skill when its declared local context was not selected', async () => {
    const skill = skillFixture()
    const { setup, creative, generateDraft, saved } = createFixture(skill.planner)
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    const plan = await creative.previewSkillPlan(project.manifest.id, 'outline_episode')

    await expect(
      creative.generateDraft({
        projectId: project.manifest.id,
        taskKind: 'outline_episode',
        instruction: 'Outline a pilot with a clear emotional turn and final story question.',
        context: {
          includeProjectBrief: false,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        provider: 'openai',
        model: 'gpt-5.6-terra',
        profile: 'balanced',
        maxOutputTokens: 1600,
        skillPlanSha256: plan.planSha256,
        paidConfirmed: true
      })
    ).rejects.toMatchObject({ code: 'required-skill-failed' })

    expect(generateDraft).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })
})

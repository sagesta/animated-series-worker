import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ProjectDetails,
  WritingDraftRecord,
  WritingProvider,
  WritingTextProvider
} from '@studio/contracts'
import {
  CreativeWritingService,
  WritingSettingsStore,
  WritingSetupService,
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
  workspacePath: 'C:\\Studio\\projects\\lantern-keepers'
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'creative-writing-test-'))
  roots.push(root)
  const vaults: Record<WritingProvider, MemoryVault> = {
    openai: new MemoryVault(),
    anthropic: new MemoryVault()
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
    listModels: vi.fn().mockResolvedValue([{ id: 'gpt-test', displayName: 'GPT Test' }]),
    generateDraft
  }
  const anthropic: WritingTextProvider = {
    listModels: vi.fn().mockResolvedValue([{ id: 'claude-test', displayName: 'Claude Test' }]),
    generateDraft: vi.fn()
  }
  const setup = new WritingSetupService({
    vaults,
    providers: { openai, anthropic },
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
    now: () => new Date('2026-08-21T14:00:00.000Z'),
    createId: () => '01J00000000000000000000001'
  })
  return { setup, creative, vaults, openai, generateDraft, saved }
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
      models: [{ id: 'gpt-test' }]
    })
    expect(status.providers.anthropic.connectionState).toBe('not-configured')
  })

  it('previews exact selected context and saves immutable proposal lineage', async () => {
    const { setup, creative, generateDraft, saved } = createFixture()
    await setup.connect({ provider: 'openai', apiKey: 'sk-test-protected-key-123456789' })
    const context = { includeProjectBrief: true, includeProductionSettings: false }
    const preview = creative.previewContext({ projectId: project.manifest.id, context })

    expect(preview.text).toContain('A shy apprentice protects a city')
    expect(preview.text).not.toContain('Target duration')

    const result = await creative.generateDraft({
      projectId: project.manifest.id,
      taskKind: 'outline_episode',
      instruction: 'Outline a pilot with a strong emotional turn and a final story question.',
      context,
      provider: 'openai',
      model: 'gpt-test',
      profile: 'balanced',
      maxOutputTokens: 1600,
      paidConfirmed: true
    })

    expect(generateDraft).toHaveBeenCalledWith(
      'sk-test-protected-key-123456789',
      expect.objectContaining({
        model: 'gpt-test',
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

    await expect(
      creative.generateDraft({
        projectId: project.manifest.id,
        taskKind: 'draft_scene',
        instruction: 'Draft the opening scene with clear emotional actions and concise dialogue.',
        context: { includeProjectBrief: true, includeProductionSettings: true },
        provider: 'openai',
        model: 'gpt-test',
        profile: 'balanced',
        maxOutputTokens: 800,
        paidConfirmed: false
      })
    ).rejects.toThrow()
    expect(generateDraft).not.toHaveBeenCalled()
    expect(saved).toEqual([])
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetails, StudioApi } from '@studio/contracts'
import { IdeaAssistant } from './IdeaAssistant'

const project: ProjectDetails = {
  manifest: {
    schemaVersion: 2,
    id: '01J00000000000000000000000',
    code: 'LANTERN',
    type: 'series',
    title: 'Lantern Keepers',
    status: 'development',
    language: 'English',
    targetDurationMinutes: 24,
    visualDirection: '2d',
    sourceMode: 'original',
    pilotBrief: 'Two young keepers protect a floating city.',
    deliveryProfileId: 'youtube-1080p',
    budgetPolicyId: 'guarded-default',
    folderName: 'lantern',
    cloudGpuState: 'not-configured',
    safeCheckpoint: { label: 'Created', createdAt: '2026-08-23T10:00:00.000Z' },
    createdAt: '2026-08-23T10:00:00.000Z',
    updatedAt: '2026-08-23T10:00:00.000Z',
    lifecycle: { archivedAt: null, statusBeforeArchive: null }
  },
  workspacePath: 'C:\\Studio\\lantern',
  creativeDirection: null
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('project-aware idea assistant', () => {
  it('uses the protected proposal path and applies only the reviewed suggestion', async () => {
    const user = userEvent.setup()
    const onUse = vi.fn()
    const generateDraft = vi.fn().mockResolvedValue({
      ok: true,
      draft: {
        schemaVersion: 3,
        draftId: '01J00000000000000000000009',
        projectId: project.manifest.id,
        taskKind: 'develop_character',
        status: 'proposal',
        provider: 'openai',
        model: 'gpt-5.6-terra',
        profile: 'balanced',
        createdAt: '2026-08-23T10:01:00.000Z',
        instruction: 'Create a detailed character concept for this animated project.',
        contextSelection: {
          includeProjectBrief: true,
          includeProductionSettings: true,
          includeCreativeDirection: true
        },
        contextSnapshotSha256: 'a'.repeat(64),
        sourceVersions: [
          {
            kind: 'project-manifest',
            id: project.manifest.id,
            schemaVersion: 2,
            updatedAt: project.manifest.updatedAt,
            sha256: 'b'.repeat(64)
          }
        ],
        output: {
          title: 'Ayo, apprentice keeper',
          summary: 'A curious apprentice who hides uncertainty behind precise observations.',
          sections: [
            { heading: 'Alternative', body: 'A patient mapmaker with a reckless streak.' }
          ],
          continuityQuestions: [],
          suggestedNextSteps: []
        },
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300, cachedInputTokens: 0 },
        cost: { currency: 'USD', estimatedUsd: null, actualUsd: null, state: 'not-calculated' },
        providerRequestId: 'req-idea',
        skillPlanSha256: 'c'.repeat(64),
        skillsPlanned: [],
        skillsUsed: []
      }
    })
    Object.defineProperty(window, 'studio', {
      configurable: true,
      value: {
        writing: {
          getStatus: vi.fn().mockResolvedValue({
            providers: {
              openai: {
                provider: 'openai',
                connectionState: 'connected',
                credentialStored: true,
                enabled: true,
                checkedAt: '2026-08-23T09:00:00.000Z',
                models: [{ id: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra' }],
                validationCostUsd: 0
              },
              anthropic: {
                provider: 'anthropic',
                connectionState: 'not-configured',
                credentialStored: false,
                enabled: true,
                checkedAt: null,
                models: [],
                validationCostUsd: 0
              },
              gemini: {
                provider: 'gemini',
                connectionState: 'not-configured',
                credentialStored: false,
                enabled: true,
                checkedAt: null,
                models: [],
                validationCostUsd: 0
              }
            },
            defaultProfile: { provider: 'openai', model: 'gpt-5.6-terra', profile: 'balanced' },
            paidDraftsRequireConfirmation: true
          }),
          previewContext: vi.fn().mockResolvedValue({
            text: 'Project: Lantern Keepers',
            sha256: 'a'.repeat(64),
            sourceVersions: [
              {
                kind: 'project-manifest',
                id: project.manifest.id,
                schemaVersion: 2,
                updatedAt: project.manifest.updatedAt,
                sha256: 'b'.repeat(64)
              }
            ]
          }),
          generateDraft
        },
        skills: {
          previewPlan: vi.fn().mockResolvedValue({
            projectId: project.manifest.id,
            taskKind: 'develop_character',
            planSha256: 'c'.repeat(64),
            required: [],
            optional: [],
            blockingIssues: [],
            ready: true
          })
        }
      } as unknown as StudioApi
    })

    render(
      <IdeaAssistant
        project={project}
        targets={[
          {
            id: 'character',
            label: 'Character concept',
            taskKind: 'develop_character',
            instruction: 'Create a production-ready character concept.',
            onUse
          }
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: /Help me create this/ }))
    expect(await screen.findByText('Uses GPT-5.6 Terra')).toBeTruthy()
    expect(screen.queryByLabelText('Writing service')).toBeNull()
    expect(screen.queryByText('Depth')).toBeNull()
    await user.click(screen.getByText('What will be shared'))
    await user.click(screen.getByText('View the exact project text'))
    expect(screen.getByText('Project: Lantern Keepers')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Generate suggestion' }))

    await screen.findByText('Ayo, apprentice keeper')
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: project.manifest.id,
        taskKind: 'develop_character',
        paidConfirmed: true,
        skillPlanSha256: 'c'.repeat(64)
      })
    )
    await user.click(screen.getByRole('button', { name: 'Use this suggestion' }))
    await waitFor(() => {
      expect(onUse).toHaveBeenCalledWith(
        'A curious apprentice who hides uncertainty behind precise observations.'
      )
    })
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExternalSkillStatus, ProjectSummary, StudioApi } from '@studio/contracts'
import { SkillSetup } from './SkillSetup'

const project: ProjectSummary = {
  id: '01J00000000000000000000000',
  code: 'LANTERN-KEEPERS',
  title: 'Lantern Keepers',
  type: 'series',
  status: 'development',
  targetDurationMinutes: 24,
  visualDirection: '2d',
  safeCheckpointAt: '2026-08-21T12:00:00.000Z',
  updatedAt: '2026-08-21T12:00:00.000Z',
  workspacePath: 'C:\\Studio\\projects\\lantern-keepers'
}

const installedStatus: ExternalSkillStatus = {
  installed: [
    {
      manifest: {
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
          'Add a proposal section named Emotional Turn that explains cause and consequence.',
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
        required: true,
        compatibility: { minStudioVersion: '0.8.0' },
        packageSha256: 'a'.repeat(64),
        signatureStatus: 'unverified',
        installedAt: '2026-08-22T10:00:00.000Z'
      },
      enabledProjectIds: [],
      compatibilityState: 'compatible',
      compatibilityReason: 'Compatible with studio 0.8.0.'
    }
  ]
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('creative skill settings', () => {
  it('installs without global access, then enables only the chosen project', async () => {
    const user = userEvent.setup()
    const setProjectEnabled = vi.fn().mockResolvedValue({
      ok: true,
      status: {
        installed: [{ ...installedStatus.installed[0], enabledProjectIds: [project.id] }]
      }
    })
    Object.defineProperty(window, 'studio', {
      configurable: true,
      value: {
        skills: {
          getStatus: vi.fn().mockResolvedValue({ installed: [] }),
          install: vi.fn().mockResolvedValue({ ok: true, status: installedStatus }),
          setProjectEnabled,
          remove: vi.fn(),
          previewPlan: vi.fn()
        }
      } as unknown as StudioApi
    })

    render(<SkillSetup projects={[project]} />)
    await screen.findByText(/No external creative skill is installed/)
    await user.click(screen.getByRole('button', { name: 'Install skill file' }))

    const checkbox = await screen.findByRole('checkbox', { name: project.title })
    expect((checkbox as HTMLInputElement).checked).toBe(false)
    expect(screen.getByText('Not verified')).toBeTruthy()
    await user.click(checkbox)

    await waitFor(() => {
      expect(setProjectEnabled).toHaveBeenCalledWith({
        skillId: 'story-emotion-map',
        projectId: project.id,
        enabled: true
      })
    })
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })
})

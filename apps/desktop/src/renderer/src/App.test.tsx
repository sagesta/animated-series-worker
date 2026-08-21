// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetails, StudioApi, SystemStatus } from '@studio/contracts'
import { App } from './App'

const systemStatus: SystemStatus = {
  appVersion: '0.2.0',
  electronVersion: '43.4.1',
  nodeVersion: '24.18.1',
  storagePath: 'C:\\Studio\\projects',
  indexedProjects: 0,
  catalogState: 'ready',
  cloudGpuState: 'not-configured',
  generationState: 'locked',
  generationReason: 'Local safety foundation first.'
}

const createdFilm: ProjectDetails = {
  manifest: {
    schemaVersion: 1,
    id: '01J00000000000000000000000',
    code: 'THE-LAST-KITE',
    title: 'The Last Kite',
    type: 'film',
    status: 'development',
    language: 'English',
    targetDurationMinutes: 12,
    visualDirection: '2d',
    sourceMode: 'original',
    pilotBrief: '',
    deliveryProfileId: 'youtube-1080p24-v1',
    budgetPolicyId: 'local-safe-default-v1',
    folderName: 'the-last-kite-01j00000000000000000000000',
    cloudGpuState: 'not-configured',
    safeCheckpoint: {
      label: 'Project created safely',
      createdAt: '2026-08-21T12:00:00.000Z'
    },
    createdAt: '2026-08-21T12:00:00.000Z',
    updatedAt: '2026-08-21T12:00:00.000Z'
  },
  workspacePath: 'C:\\Studio\\projects\\the-last-kite-01j00000000000000000000000'
}

let createProject: ReturnType<typeof vi.fn<StudioApi['projects']['create']>>

beforeEach(() => {
  createProject = vi.fn<StudioApi['projects']['create']>().mockResolvedValue(createdFilm)
  const studioApi: StudioApi = {
    system: {
      getStatus: vi.fn().mockResolvedValue(systemStatus)
    },
    projects: {
      list: vi.fn().mockResolvedValue([]),
      create: createProject,
      open: vi.fn()
    }
  }

  Object.defineProperty(window, 'studio', {
    value: studioApi,
    configurable: true
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('desktop project foundation', () => {
  it('shows a plain-language empty library with paid services off', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Your production library is ready.' })
    ).toBeTruthy()
    expect(screen.getByText('No paid services active')).toBeTruthy()
    expect(screen.getByText('$0 current spend')).toBeTruthy()
  })

  it('AT-001 foundation slice creates a film and opens its overview', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a production/i }))
    await user.click(screen.getByRole('button', { name: /one-off film/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await user.type(screen.getByLabelText('Production title'), 'The Last Kite')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /start from an idea/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Create production' }))

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1))
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'The Last Kite',
        code: 'THE-LAST-KITE',
        type: 'film',
        targetDurationMinutes: 12,
        sourceMode: 'original'
      })
    )
    expect(await screen.findByRole('heading', { name: 'The Last Kite' })).toBeTruthy()
    expect(screen.getByText('Cloud GPU')).toBeTruthy()
    expect(screen.getByText('$0 active cloud spend')).toBeTruthy()
  })
})

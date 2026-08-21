// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CloudConnectionStatus,
  ProjectBackupSummary,
  ProjectDetails,
  StudioApi,
  SystemStatus
} from '@studio/contracts'
import { App } from './App'

const systemStatus: SystemStatus = {
  appVersion: '0.3.0',
  electronVersion: '43.4.1',
  nodeVersion: '24.18.1',
  storagePath: 'C:\\Studio\\projects',
  indexedProjects: 0,
  catalogState: 'ready',
  cloudGpuState: 'not-configured',
  generationState: 'locked',
  generationReason: 'Local safety foundation first.'
}

const disconnectedCloudStatus: CloudConnectionStatus = {
  provider: 'runpod',
  connectionState: 'not-configured',
  credentialStored: false,
  guardrails: {
    maxSessionCostUsd: 10,
    maxRuntimeMinutes: 120,
    idleTimeoutMinutes: 10,
    maxConcurrentGpus: 1
  },
  guardrailsSaved: false,
  account: null,
  gpuCatalogCheckedAt: null,
  gpuOptions: [],
  catalogMessage: null,
  validationCostUsd: 0,
  setupChecklist: {
    accountConnected: false,
    guardrailsSaved: false,
    modelStorageReady: false,
    workerImageReady: false,
    automaticShutdownTested: false
  },
  generationState: 'locked',
  generationReason: 'Connect RunPod with a no-cost account check.'
}

const connectedCloudStatus: CloudConnectionStatus = {
  ...disconnectedCloudStatus,
  connectionState: 'connected',
  credentialStored: true,
  account: {
    checkedAt: '2026-08-21T18:00:00.000Z',
    totalPods: 0,
    activePods: 0,
    activeHourlyCostUsd: 0
  },
  gpuCatalogCheckedAt: '2026-08-21T18:00:00.000Z',
  setupChecklist: {
    ...disconnectedCloudStatus.setupChecklist,
    accountConnected: true
  },
  generationReason: 'RunPod is connected. Paid generation stays locked.'
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

const verifiedFilmBackup: ProjectBackupSummary = {
  backupId: '01J00000000000000000000001',
  projectId: createdFilm.manifest.id,
  projectCode: createdFilm.manifest.code,
  projectTitle: createdFilm.manifest.title,
  createdAt: '2026-08-21T13:00:00.000Z',
  fileCount: 2,
  totalBytes: 4096,
  backupPath: 'C:\\Studio\\backups\\01j00000000000000000000001',
  verificationState: 'verified'
}

let createProject: ReturnType<typeof vi.fn<StudioApi['projects']['create']>>
let listBackups: ReturnType<typeof vi.fn<StudioApi['projects']['listBackups']>>
let backupProject: ReturnType<typeof vi.fn<StudioApi['projects']['backup']>>
let restoreProject: ReturnType<typeof vi.fn<StudioApi['projects']['restore']>>
let connectCloud: ReturnType<typeof vi.fn<StudioApi['cloud']['connect']>>

beforeEach(() => {
  createProject = vi.fn<StudioApi['projects']['create']>().mockResolvedValue(createdFilm)
  listBackups = vi.fn<StudioApi['projects']['listBackups']>().mockResolvedValue([])
  backupProject = vi.fn<StudioApi['projects']['backup']>().mockResolvedValue(verifiedFilmBackup)
  restoreProject = vi.fn<StudioApi['projects']['restore']>().mockResolvedValue({
    backupId: verifiedFilmBackup.backupId,
    restoredAt: '2026-08-21T14:00:00.000Z',
    project: createdFilm
  })
  connectCloud = vi.fn<StudioApi['cloud']['connect']>().mockResolvedValue({
    ok: true,
    status: connectedCloudStatus
  })
  const studioApi: StudioApi = {
    system: {
      getStatus: vi.fn().mockResolvedValue(systemStatus)
    },
    projects: {
      list: vi.fn().mockResolvedValue([]),
      create: createProject,
      open: vi.fn(),
      listBackups,
      backup: backupProject,
      restore: restoreProject
    },
    cloud: {
      getStatus: vi.fn().mockResolvedValue(disconnectedCloudStatus),
      connect: connectCloud,
      refresh: vi.fn().mockResolvedValue({ ok: true, status: connectedCloudStatus }),
      disconnect: vi.fn().mockResolvedValue({ ok: true, status: disconnectedCloudStatus }),
      saveGuardrails: vi.fn().mockResolvedValue({
        ok: true,
        status: { ...disconnectedCloudStatus, guardrailsSaved: true }
      })
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

    await user.click(screen.getByRole('button', { name: 'Create verified backup' }))
    await waitFor(() => expect(backupProject).toHaveBeenCalledWith(createdFilm.manifest.id))
    expect(await screen.findByText(/verified backup complete/i)).toBeTruthy()
  })

  it('SEC-001 connects RunPod with a free check while generation remains locked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.type(screen.getByLabelText('RunPod API key'), 'rpa_valid_secret_value_123456789')
    await user.click(screen.getByRole('button', { name: 'Test and store securely' }))

    await waitFor(() => expect(connectCloud).toHaveBeenCalledTimes(1))
    expect(connectCloud).toHaveBeenCalledWith({
      apiKey: 'rpa_valid_secret_value_123456789'
    })
    expect(await screen.findByText('RunPod account connected')).toBeTruthy()
    expect(screen.getByText(/free check did not rent a GPU/i)).toBeTruthy()
    expect(screen.getByText('Generation locked')).toBeTruthy()
  })

  it('restores a missing project from a verified backup in Settings', async () => {
    const user = userEvent.setup()
    listBackups.mockResolvedValue([verifiedFilmBackup])
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.click(await screen.findByRole('button', { name: 'Restore project' }))

    await waitFor(() => expect(restoreProject).toHaveBeenCalledWith(verifiedFilmBackup.backupId))
    expect(await screen.findByRole('heading', { name: 'The Last Kite' })).toBeTruthy()
  })
})

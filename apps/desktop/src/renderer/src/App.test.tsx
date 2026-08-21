// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CloudConnectionStatus,
  ProjectBackupSummary,
  ProjectDetails,
  StudioApi,
  SystemStatus,
  WritingSettingsStatus
} from '@studio/contracts'
import { App } from './App'
import { CreativeRoom } from './CreativeRoom'

const systemStatus: SystemStatus = {
  appVersion: '0.4.0',
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

const disconnectedWritingStatus: WritingSettingsStatus = {
  providers: {
    openai: {
      provider: 'openai',
      connectionState: 'not-configured',
      credentialStored: false,
      enabled: true,
      checkedAt: null,
      models: [],
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
    }
  },
  defaultProfile: null,
  paidDraftsRequireConfirmation: true
}

const connectedWritingStatus: WritingSettingsStatus = {
  ...disconnectedWritingStatus,
  providers: {
    ...disconnectedWritingStatus.providers,
    openai: {
      provider: 'openai',
      connectionState: 'connected',
      credentialStored: true,
      enabled: true,
      checkedAt: '2026-08-21T18:00:00.000Z',
      models: [{ id: 'gpt-test', displayName: 'GPT Test' }],
      validationCostUsd: 0
    }
  },
  defaultProfile: { provider: 'openai', model: 'gpt-test', profile: 'balanced' }
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

const migratedFilm: ProjectDetails = {
  ...createdFilm,
  manifest: {
    ...createdFilm.manifest,
    schemaVersion: 2,
    lifecycle: { archivedAt: null, statusBeforeArchive: null },
    safeCheckpoint: {
      label: 'Project format updated safely',
      createdAt: '2026-08-21T16:00:00.000Z'
    },
    updatedAt: '2026-08-21T16:00:00.000Z'
  }
}

let createProject: ReturnType<typeof vi.fn<StudioApi['projects']['create']>>
let listBackups: ReturnType<typeof vi.fn<StudioApi['projects']['listBackups']>>
let backupProject: ReturnType<typeof vi.fn<StudioApi['projects']['backup']>>
let restoreProject: ReturnType<typeof vi.fn<StudioApi['projects']['restore']>>
let getMigrationPreview: ReturnType<typeof vi.fn<StudioApi['projects']['getMigrationPreview']>>
let migrateProject: ReturnType<typeof vi.fn<StudioApi['projects']['migrate']>>
let createSupportBundle: ReturnType<typeof vi.fn<StudioApi['support']['createBundle']>>
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
  getMigrationPreview = vi
    .fn<StudioApi['projects']['getMigrationPreview']>()
    .mockResolvedValue(null)
  migrateProject = vi.fn<StudioApi['projects']['migrate']>().mockResolvedValue({
    migrationId: 'project-manifest-v1-to-v2',
    migratedAt: '2026-08-21T16:00:00.000Z',
    backup: verifiedFilmBackup,
    project: migratedFilm
  })
  createSupportBundle = vi.fn<StudioApi['support']['createBundle']>().mockResolvedValue({
    bundleId: '00000000-0000-4000-8000-000000000001',
    createdAt: '2026-08-21T15:00:00.000Z',
    eventCount: 4,
    bundlePath: 'C:\\Studio\\support\\support-safe.json',
    redactionState: 'passed'
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
      restore: restoreProject,
      getMigrationPreview,
      migrate: migrateProject
    },
    support: {
      recordRendererError: vi.fn().mockResolvedValue(undefined),
      createBundle: createSupportBundle
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
    },
    writing: {
      getStatus: vi.fn().mockResolvedValue(disconnectedWritingStatus),
      connect: vi.fn(),
      refresh: vi.fn(),
      disconnect: vi.fn(),
      setEnabled: vi.fn(),
      saveDefaultProfile: vi.fn(),
      previewContext: vi.fn().mockResolvedValue({
        text: 'No local project context selected.',
        sha256: 'a'.repeat(64),
        sourceVersions: [
          {
            kind: 'project-manifest',
            id: createdFilm.manifest.id,
            schemaVersion: 1,
            updatedAt: createdFilm.manifest.updatedAt,
            sha256: 'b'.repeat(64)
          }
        ]
      }),
      generateDraft: vi.fn(),
      listDrafts: vi.fn().mockResolvedValue([])
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
    expect(screen.getByText('GPU off · text calls require approval')).toBeTruthy()
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

  it('creates a local redacted support file without uploading it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.click(await screen.findByRole('button', { name: 'Create redacted support file' }))

    await waitFor(() => expect(createSupportBundle).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/redaction check passed/i)).toBeTruthy()
    expect(screen.getByText('C:\\Studio\\support\\support-safe.json')).toBeTruthy()
  })

  it('previews, backs up, and updates an older project format from the overview', async () => {
    const user = userEvent.setup()
    getMigrationPreview.mockResolvedValueOnce({
      migrationId: 'project-manifest-v1-to-v2',
      projectId: createdFilm.manifest.id,
      projectTitle: createdFilm.manifest.title,
      expectedUpdatedAt: createdFilm.manifest.updatedAt,
      fromVersion: 1,
      toVersion: 2,
      backupRequired: true,
      dataLossExpected: false,
      filesChanged: 1,
      changes: [
        'Add reversible archive and unarchive history fields.',
        'Keep every existing project setting, file, and approval unchanged.',
        'Create and verify a complete recovery backup before activation.'
      ]
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a production/i }))
    await user.click(screen.getByRole('button', { name: /one-off film/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(screen.getByLabelText('Production title'), 'The Last Kite')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /start from an idea/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Create production' }))

    await user.click(await screen.findByRole('button', { name: 'Back up and update project' }))
    await waitFor(() =>
      expect(migrateProject).toHaveBeenCalledWith({
        projectId: createdFilm.manifest.id,
        expectedUpdatedAt: createdFilm.manifest.updatedAt
      })
    )
    expect(await screen.findByText('Project format updated safely')).toBeTruthy()
  })
})

describe('creative room', () => {
  it('requires explicit paid confirmation and shows the saved response as a proposal', async () => {
    const user = userEvent.setup()
    const draft = {
      schemaVersion: 1 as const,
      draftId: '01J00000000000000000000009',
      projectId: createdFilm.manifest.id,
      taskKind: 'outline_episode' as const,
      status: 'proposal' as const,
      provider: 'openai' as const,
      model: 'gpt-test',
      profile: 'balanced' as const,
      createdAt: '2026-08-21T19:00:00.000Z',
      instruction: 'Outline the film with a strong emotional turn and a memorable final image.',
      contextSelection: { includeProjectBrief: true, includeProductionSettings: true },
      contextSnapshotSha256: 'a'.repeat(64),
      sourceVersions: [
        {
          kind: 'project-manifest' as const,
          id: createdFilm.manifest.id,
          schemaVersion: createdFilm.manifest.schemaVersion,
          updatedAt: createdFilm.manifest.updatedAt,
          sha256: 'b'.repeat(64)
        }
      ],
      output: {
        title: 'The Kite Above the Storm',
        summary: 'A structured film outline proposal.',
        sections: [{ heading: 'Beginning', body: 'A child repairs a wind-torn kite.' }],
        continuityQuestions: [],
        suggestedNextSteps: []
      },
      usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180, cachedInputTokens: 0 },
      cost: {
        currency: 'USD' as const,
        estimatedUsd: null,
        actualUsd: null,
        state: 'not-calculated' as const
      },
      providerRequestId: 'request-creative-room',
      skillsPlanned: [] as never[],
      skillsUsed: [] as never[]
    }
    window.studio.writing.previewContext = vi.fn().mockResolvedValue({
      text: 'PROJECT BRIEF\nTitle: The Last Kite',
      sha256: 'a'.repeat(64),
      sourceVersions: draft.sourceVersions
    })
    window.studio.writing.listDrafts = vi.fn().mockResolvedValue([])
    const generateDraft = vi.fn().mockResolvedValue({ ok: true, draft })
    window.studio.writing.generateDraft = generateDraft

    render(
      <CreativeRoom
        project={createdFilm}
        writingStatus={connectedWritingStatus}
        onHome={vi.fn()}
        onSettings={vi.fn()}
      />
    )

    const createButton = await screen.findByRole('button', {
      name: 'Create writing proposal'
    })
    await user.type(
      screen.getByLabelText(/Your instruction/),
      'Outline the film with a strong emotional turn and a memorable final image.'
    )
    expect((createButton as HTMLButtonElement).disabled).toBe(true)
    await user.click(
      screen.getByLabelText('I approve one paid text request using the model shown above.')
    )
    expect((createButton as HTMLButtonElement).disabled).toBe(false)
    await user.click(createButton)

    await screen.findByRole('heading', { name: 'The Kite Above the Storm' })
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ paidConfirmed: true, provider: 'openai', model: 'gpt-test' })
    )
    expect(screen.getByText('Proposal · not canon')).toBeTruthy()
    expect(screen.getByText(/External skills used: none/)).toBeTruthy()
  })
})

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CloudConnectionStatus,
  ProductionWorkspaceSummary,
  ProjectBackupSummary,
  ProjectDetails,
  StudioApi,
  SystemStatus,
  WritingSettingsStatus
} from '@studio/contracts'
import { App } from './App'
import { CreativeDirectionPanel } from './CreativeDirectionPanel'
import { CreativeRoom } from './CreativeRoom'
import { CreatorMode } from './CreatorMode'
import { GenerateRoom, MediaReviewRoom } from './ProductionRooms'

const systemStatus: SystemStatus = {
  appVersion: '0.7.0',
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
      models: [{ id: 'gpt-5.6-terra', displayName: 'GPT-5.6 Terra' }],
      validationCostUsd: 0
    }
  },
  defaultProfile: { provider: 'openai', model: 'gpt-5.6-terra', profile: 'balanced' }
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
  workspacePath: 'C:\\Studio\\projects\\the-last-kite-01j00000000000000000000000',
  creativeDirection: {
    schemaVersion: 1,
    profileId: '01J00000000000000000000008',
    projectId: '01J00000000000000000000000',
    revision: 1,
    createdAt: '2026-08-21T12:00:00.000Z',
    direction: {
      targetAudience: 'Families and viewers aged 9–15 who enjoy hopeful fantasy.',
      ageBand: 'all-ages',
      primaryNiche: 'Hopeful family fantasy',
      genres: ['fantasy', 'family adventure'],
      toneKeywords: ['warm', 'adventurous'],
      coreThemes: ['courage', 'family'],
      storyPromise: 'A self-contained emotional adventure with a memorable visual resolution.',
      culturalSetting: '',
      contentBoundaries: ['No graphic violence'],
      episodeFormat: 'A self-contained 12-minute animated film.',
      youtubePositioning: 'An original short fantasy film for family co-viewing.',
      visualStyleNotes: 'Expressive 2D animation.',
      comparableTitles: [],
      differentiation: 'The story uses a repaired kite as an emotional and visual motif.'
    }
  }
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
      saveCreativeDirection: vi.fn().mockResolvedValue(createdFilm),
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
    },
    production: {
      getWorkspace: vi.fn().mockImplementation(async (projectId) => ({
        projectId,
        canon: [],
        media: [],
        jobs: [],
        draftFingerprints: [],
        staleDependencyCount: 0,
        estimatedApprovedSpendUsd: 0,
        actualSpendUsd: 0,
        elapsedCloudUsageEstimateUsd: 0
      })),
      promoteDraft: vi.fn(),
      importMedia: vi.fn(),
      createAdaptationDataset: vi.fn(),
      copyMedia: vi.fn(),
      reviewMedia: vi.fn(),
      planJob: vi.fn(),
      approveJob: vi.fn(),
      getJob: vi.fn(),
      listWorkflows: vi.fn().mockResolvedValue([]),
      estimateWorkflow: vi.fn(),
      queueJob: vi.fn(),
      cancelJob: vi.fn(),
      reconcileJob: vi.fn()
    },
    finish: {
      getWorkspace: vi.fn().mockImplementation(async (projectId) => ({
        projectId,
        timelines: [],
        releaseDetails: [],
        attestations: [],
        releasePackages: [],
        releaseProfiles: [],
        ideas: [],
        performanceSnapshots: [],
        learnings: [],
        blockers: []
      })),
      saveTimeline: vi.fn(),
      lockTimeline: vi.fn(),
      saveReleaseDetails: vi.fn(),
      saveAttestations: vi.fn(),
      saveReleaseProfile: vi.fn(),
      saveIdea: vi.fn(),
      savePerformanceSnapshot: vi.fn(),
      choosePerformanceReport: vi.fn().mockResolvedValue(null),
      saveLearning: vi.fn(),
      reviewLearning: vi.fn(),
      createReleasePackage: vi.fn(),
      openReleasePackage: vi.fn(),
      getLocalMediaStatus: vi.fn().mockResolvedValue({
        state: 'missing',
        source: 'none',
        ffmpegAvailable: false,
        ffprobeAvailable: false,
        message: 'Install the free local media tools once.'
      }),
      installLocalMediaTools: vi.fn(),
      renderTimeline: vi.fn(),
      exportCaptions: vi.fn(),
      renderThumbnail: vi.fn()
    },
    upstream: {
      chooseImport: vi.fn(),
      listImports: vi.fn().mockResolvedValue([]),
      acceptImport: vi.fn()
    },
    skills: {
      getStatus: vi.fn().mockResolvedValue({ installed: [] }),
      install: vi.fn().mockResolvedValue({ ok: true, status: { installed: [] } }),
      setProjectEnabled: vi.fn().mockResolvedValue({ ok: true, status: { installed: [] } }),
      remove: vi.fn().mockResolvedValue({ ok: true, status: { installed: [] } }),
      previewPlan: vi.fn().mockImplementation(async (input) => ({
        projectId: input.projectId,
        taskKind: input.taskKind,
        planSha256: 'c'.repeat(64),
        required: [],
        optional: [],
        blockingIssues: [],
        ready: true
      }))
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
    await user.click(screen.getByRole('button', { name: 'Use detailed setup instead' }))
    await user.click(screen.getByRole('button', { name: /one-off film/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const identityAlert = await screen.findByRole('alertdialog')
    expect(
      within(identityAlert).getByText(/production title containing at least 2 characters/i)
    ).toBeTruthy()
    expect(createProject).not.toHaveBeenCalled()
    await user.click(within(identityAlert).getByRole('button', { name: 'Go back and fix' }))

    await user.type(screen.getByLabelText('Production title'), 'The Last Kite')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Who is this production for?/),
      'Families and viewers aged 9–15 who enjoy hopeful fantasy.'
    )
    await user.type(screen.getByLabelText('Primary niche'), 'Hopeful family fantasy')
    await user.type(screen.getByLabelText(/Genre and subgenre/), 'Fantasy, family adventure')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Viewer promise/),
      'A self-contained emotional adventure with a memorable visual resolution.'
    )
    await user.type(screen.getByLabelText(/Tone/), 'Warm, adventurous')
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
        sourceMode: 'original',
        creativeDirection: expect.objectContaining({
          targetAudience: 'Families and viewers aged 9–15 who enjoy hopeful fantasy.',
          primaryNiche: 'Hopeful family fantasy',
          genres: ['Fantasy', 'family adventure'],
          toneKeywords: ['Warm', 'adventurous']
        })
      })
    )
    await user.click(await screen.findByRole('button', { name: /productions/i }))
    expect(await screen.findByRole('heading', { name: 'The Last Kite' })).toBeTruthy()
    expect(screen.getByText('Cloud GPU')).toBeTruthy()
    expect(screen.getByText('$0 active cloud spend')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Create verified backup' }))
    await waitFor(() => expect(backupProject).toHaveBeenCalledWith(createdFilm.manifest.id))
    expect(await screen.findByText(/verified backup complete/i)).toBeTruthy()
  }, 15_000)

  it('creates a production from one story idea and opens the guided creator path', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a production/i }))
    await user.click(screen.getByRole('button', { name: /one-off film/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(screen.getByLabelText(/Production title/), 'The Last Kite')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    const alert = await screen.findByRole('alertdialog')
    expect(within(alert).getByText(/one or two sentences/i)).toBeTruthy()
    expect(createProject).not.toHaveBeenCalled()
    await user.click(within(alert).getByRole('button', { name: 'Go back and fix' }))

    await user.type(
      screen.getByLabelText(/Describe your story/),
      'A lonely child repairs a storm-broken kite and discovers it can carry one final message to a lost parent.'
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /hand-painted 2d/i }))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1))
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'film',
        title: 'The Last Kite',
        code: 'THE-LAST-KITE',
        sourceMode: 'original',
        visualDirection: '2d',
        pilotBrief:
          'A lonely child repairs a storm-broken kite and discovers it can carry one final message to a lost parent.',
        creativeDirection: expect.objectContaining({
          primaryNiche: 'To be inferred from the creator source.'
        })
      })
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Continue from the next unfinished production step.'
      })
    ).toBeTruthy()
    expect(screen.getByText('View the complete production run')).toBeTruthy()
    expect(screen.getByText('Create or repair one production asset')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Creation modes' })).toBeNull()
    expect(screen.getByText('Connect a writing service once')).toBeTruthy()
    expect(screen.getByText('GPU is off')).toBeTruthy()
  })

  it('prepares the next Creator Mode stage from one clear billed action', async () => {
    const user = userEvent.setup()
    window.studio.writing.getStatus = vi.fn().mockResolvedValue(connectedWritingStatus)
    const draft = {
      schemaVersion: 1 as const,
      draftId: '01J00000000000000000000009',
      projectId: createdFilm.manifest.id,
      taskKind: 'outline_episode' as const,
      status: 'proposal' as const,
      provider: 'openai' as const,
      model: 'gpt-5.6-terra',
      profile: 'best-draft' as const,
      createdAt: '2026-08-23T09:00:00.000Z',
      instruction:
        'Build a complete production blueprint from the creator source and approved canon.',
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
        title: 'The Last Kite Production Blueprint',
        summary: 'A reviewable story and production plan.',
        sections: [
          { heading: 'Story direction', body: 'The child follows the kite into the storm.' }
        ],
        continuityQuestions: ['Should the final message be spoken or shown?'],
        suggestedNextSteps: ['Review the full cast.']
      },
      usage: { inputTokens: 400, outputTokens: 300, totalTokens: 700, cachedInputTokens: 0 },
      cost: {
        currency: 'USD' as const,
        estimatedUsd: null,
        actualUsd: null,
        state: 'not-calculated' as const
      },
      providerRequestId: 'request-creator-mode',
      skillsPlanned: [] as never[],
      skillsUsed: [] as never[]
    }
    const generateDraft = vi.fn().mockResolvedValue({ ok: true as const, draft })
    window.studio.writing.generateDraft = generateDraft
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a production/i }))
    await user.click(screen.getByRole('button', { name: /animated series/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Describe your story/),
      'A child repairs a magical kite to carry one final message through a dangerous storm.'
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /graphic 2d/i }))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    const build = await screen.findByRole('button', { name: /create story plan/i })
    expect(screen.getByText(/text request may be billed.*No GPU starts/i)).toBeTruthy()
    await user.click(build)

    expect(
      await screen.findByRole('heading', { name: 'The Last Kite Production Blueprint' })
    ).toBeTruthy()
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKind: 'outline_episode',
        provider: 'openai',
        model: 'gpt-5.6-terra',
        maxOutputTokens: 8000,
        paidConfirmed: true,
        context: expect.objectContaining({ includeApprovedCanon: true })
      })
    )
    expect(screen.getByText('Draft · not approved yet')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /use these answers in a revision/i }))
    const questionAlert = await screen.findByRole('alertdialog')
    expect(within(questionAlert).getByText(/question 1 still needs/i)).toBeTruthy()
    await user.click(within(questionAlert).getByRole('button', { name: 'Go back and fix' }))
    await user.click(screen.getByRole('button', { name: 'Let AI recommend' }))
    await user.click(screen.getByRole('button', { name: /use these answers in a revision/i }))
    expect((screen.getByLabelText(/Anything to change/) as HTMLTextAreaElement).value).toContain(
      'CREATOR DECISION: Let AI recommend'
    )
    expect(screen.getByText(/answers are ready for a revision/i)).toBeTruthy()
  }, 10_000)

  it('keeps completed creator setup in Creator Mode instead of redirecting to Settings', async () => {
    const user = userEvent.setup()
    const creatorSetupComplete: CloudConnectionStatus = {
      ...connectedCloudStatus,
      guardrailsSaved: true,
      setupChecklist: {
        accountConnected: true,
        guardrailsSaved: true,
        modelStorageReady: false,
        workerImageReady: false,
        automaticShutdownTested: false
      },
      generationReason: 'The studio worker and automatic shutdown proof are still protected.'
    }
    window.studio.cloud.getStatus = vi.fn().mockResolvedValue(creatorSetupComplete)
    window.studio.production.getWorkspace = vi.fn().mockImplementation(async (projectId) => {
      const canon = [
        'series-bible',
        'character',
        'world',
        'script',
        'storyboard',
        'visual-style',
        'voice'
      ].map((kind, index) => ({
        kind,
        state: 'active',
        canonId: `canon-${index}`
      }))
      return {
        projectId,
        canon,
        media: [],
        jobs: [],
        canonImpacts: [],
        draftFingerprints: [],
        staleDependencyCount: 0,
        estimatedApprovedSpendUsd: 0,
        actualSpendUsd: 0,
        elapsedCloudUsageEstimateUsd: 0
      } as unknown as ProductionWorkspaceSummary
    })
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /start a production/i }))
    await user.click(screen.getByRole('button', { name: /animated series/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Describe your story/),
      'A child repairs a magical kite to carry one final message through a dangerous storm.'
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /mixed-media collage/i }))
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(
      await screen.findByRole('heading', { name: 'Make a small proof before the full episode' })
    ).toBeTruthy()
    expect(screen.getByText('Your one-time setup steps are complete')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'View protected setup status' }))
    const readinessAlert = await screen.findByRole('alertdialog')
    expect(within(readinessAlert).getByText(/do not need to create a Pod/i)).toBeTruthy()
    expect(within(readinessAlert).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(within(readinessAlert).queryByText(/please correct/i)).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Make a small proof before the full episode' })
    ).toBeTruthy()
  })

  it('SEC-001 connects RunPod with a free check while generation remains locked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.type(screen.getByLabelText('RunPod API key'), 'short')
    await user.click(screen.getByRole('button', { name: 'Test and store securely' }))
    const keyAlert = await screen.findByRole('alertdialog')
    expect(within(keyAlert).getByText(/at least 20 characters/i)).toBeTruthy()
    expect(connectCloud).not.toHaveBeenCalled()
    await user.click(within(keyAlert).getByRole('button', { name: 'Go back and fix' }))
    await user.clear(screen.getByLabelText('RunPod API key'))
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

  it('connects a Gemini key through its separate protected Settings card', async () => {
    const user = userEvent.setup()
    const geminiConnected: WritingSettingsStatus = {
      ...disconnectedWritingStatus,
      providers: {
        ...disconnectedWritingStatus.providers,
        gemini: {
          provider: 'gemini',
          connectionState: 'connected',
          credentialStored: true,
          enabled: true,
          checkedAt: '2026-08-21T18:00:00.000Z',
          models: [{ id: 'gemini-3.7-flash', displayName: 'Gemini 3.7 Flash' }],
          validationCostUsd: 0
        }
      }
    }
    const connectWriting = vi
      .fn<StudioApi['writing']['connect']>()
      .mockResolvedValue({ ok: true, status: geminiConnected })
    window.studio.writing.connect = connectWriting
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    const geminiCard = screen.getByRole('heading', { name: 'Google Gemini' }).closest('form')
    expect(geminiCard).not.toBeNull()
    await user.type(
      within(geminiCard as HTMLFormElement).getByLabelText('API key'),
      'AIza-test-protected-key-123456789'
    )
    await user.click(
      within(geminiCard as HTMLFormElement).getByRole('button', { name: 'Test and store key' })
    )

    await waitFor(() =>
      expect(connectWriting).toHaveBeenCalledWith({
        provider: 'gemini',
        apiKey: 'AIza-test-protected-key-123456789'
      })
    )
    expect(await screen.findByText(/Google Gemini is connected/)).toBeTruthy()
    expect(screen.getByText(/Connection check: \$0/)).toBeTruthy()
  })

  it('restores a missing project from a verified backup in Settings', async () => {
    const user = userEvent.setup()
    listBackups.mockResolvedValue([verifiedFilmBackup])
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.click(await screen.findByRole('button', { name: 'Restore project' }))

    await waitFor(() => expect(restoreProject).toHaveBeenCalledWith(verifiedFilmBackup.backupId))
    expect(
      await screen.findByRole('heading', {
        name: 'Continue from the next unfinished production step.'
      })
    ).toBeTruthy()
  })

  it('creates a local redacted support file without uploading it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /settings/i }))
    await user.click(await screen.findByRole('button', { name: 'Create redacted support file' }))

    await waitFor(() => expect(createSupportBundle).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/redaction check passed/i)).toBeTruthy()
    expect(screen.getByText('Support file ready')).toBeTruthy()
    expect(screen.queryByText('C:\\Studio\\support\\support-safe.json')).toBeNull()
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
    await user.click(screen.getByRole('button', { name: 'Use detailed setup instead' }))
    await user.click(screen.getByRole('button', { name: /one-off film/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(screen.getByLabelText('Production title'), 'The Last Kite')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Who is this production for?/),
      'Families and viewers aged 9–15 who enjoy hopeful fantasy.'
    )
    await user.type(screen.getByLabelText('Primary niche'), 'Hopeful family fantasy')
    await user.type(screen.getByLabelText(/Genre and subgenre/), 'Fantasy, family adventure')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.type(
      screen.getByLabelText(/Viewer promise/),
      'A self-contained emotional adventure with a memorable visual resolution.'
    )
    await user.type(screen.getByLabelText(/Tone/), 'Warm, adventurous')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /start from an idea/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Create production' }))

    await user.click(await screen.findByRole('button', { name: /productions/i }))
    await user.click(await screen.findByRole('button', { name: 'Back up and update project' }))
    await waitFor(() =>
      expect(migrateProject).toHaveBeenCalledWith({
        projectId: createdFilm.manifest.id,
        expectedUpdatedAt: createdFilm.manifest.updatedAt
      })
    )
    expect(await screen.findByText('Project format updated safely')).toBeTruthy()
  }, 15_000)
})

describe('creator production workflow', () => {
  it('keeps the full run primary and hands one optional asset into the prepared job flow', async () => {
    const user = userEvent.setup()
    const onQuickCreate = vi.fn()
    window.studio.production.getWorkspace = vi.fn().mockResolvedValue({
      projectId: createdFilm.manifest.id,
      canon: [
        'series-bible',
        'character',
        'world',
        'script',
        'storyboard',
        'visual-style',
        'voice'
      ].map((kind, index) => ({ kind, state: 'active', canonId: `canon-${index}` })),
      media: [
        {
          assetId: '01J00000000000000000000041',
          kind: 'character-board',
          state: 'approved'
        }
      ],
      jobs: [],
      draftFingerprints: [],
      staleDependencyCount: 0,
      estimatedApprovedSpendUsd: 0,
      actualSpendUsd: 0,
      elapsedCloudUsageEstimateUsd: 0
    } as unknown as ProductionWorkspaceSummary)

    render(
      <CreatorMode
        project={createdFilm}
        writingStatus={disconnectedWritingStatus}
        cloudStatus={disconnectedCloudStatus}
        onNavigate={vi.fn()}
        onQuickCreate={onQuickCreate}
      />
    )

    expect(
      await screen.findByRole('heading', { name: 'Make a small proof before the full episode' })
    ).toBeTruthy()
    expect(screen.getByText('View the complete production run')).toBeTruthy()
    await user.click(screen.getByText('Create or repair one production asset'))
    await user.selectOptions(screen.getByLabelText('One-off asset type choice'), 'style-board')
    await user.type(screen.getByLabelText('Asset name'), 'Storm palette board')
    await user.type(
      screen.getByLabelText('Creative direction'),
      'Warm paper texture, storm blues, and a coral kite accent.'
    )
    await user.click(screen.getByRole('button', { name: 'Prepare one image →' }))

    expect(onQuickCreate).toHaveBeenCalledWith({
      mode: 'image',
      workflowId: 'qwen-image-character-board',
      outputKind: 'style-board',
      label: 'Storm palette board',
      instruction: 'Warm paper texture, storm blues, and a coral kite accent.'
    })
    expect(window.studio.production.estimateWorkflow).not.toHaveBeenCalled()
    expect(window.studio.production.queueJob).not.toHaveBeenCalled()
  })
})

describe('generate room', () => {
  it('hands a prepared one-off image into the governed estimate flow without starting work', async () => {
    window.studio.production.listWorkflows = vi.fn().mockResolvedValue([
      {
        workflowId: 'qwen-image-character-board',
        version: '1.0.0',
        label: 'Create a reusable character board',
        jobKind: 'qwen-image',
        engine: 'comfyui',
        qualificationState: 'candidate',
        minimumVramGb: 24,
        expectedRuntimeMinutes: 4,
        maximumRuntimeMinutes: 12,
        outputKind: 'image',
        requiresGpu: true,
        readyForPaidWork: false,
        blockers: ['Live worker qualification is still required.'],
        notes: []
      }
    ])

    render(
      <GenerateRoom
        project={createdFilm}
        cloudStatus={disconnectedCloudStatus}
        onHome={vi.fn()}
        onSettings={vi.fn()}
        quickCreate={{
          mode: 'image',
          workflowId: 'qwen-image-character-board',
          outputKind: 'style-board',
          label: 'Storm palette board',
          instruction: 'Warm paper texture, storm blues, and a coral kite accent.'
        }}
      />
    )

    expect(
      await screen.findByRole('heading', { name: 'Prepare this image without starting a GPU.' })
    ).toBeTruthy()
    expect(screen.getByText(/Quick image setup is prepared.*No GPU has started/i)).toBeTruthy()
    expect((screen.getByLabelText(/Job name/) as HTMLInputElement).value).toBe(
      'Storm palette board'
    )
    expect(
      (screen.getByLabelText(/Creative direction or production data/) as HTMLTextAreaElement).value
    ).toBe('Warm paper texture, storm blues, and a coral kite accent.')
    expect(screen.queryByLabelText('Full production stages')).toBeNull()
    expect(window.studio.production.estimateWorkflow).not.toHaveBeenCalled()
    expect(window.studio.production.queueJob).not.toHaveBeenCalled()
  })

  it('shows plain-language operation and GPU cards with prices and incompatibility reasons', async () => {
    window.studio.production.listWorkflows = vi.fn().mockResolvedValue([
      {
        workflowId: 'ltx2-image-to-video-final',
        version: '1.0.0',
        label: 'Animate an approved shot',
        jobKind: 'ltx-video',
        engine: 'comfyui',
        qualificationState: 'qualified',
        minimumVramGb: 48,
        expectedRuntimeMinutes: 8,
        maximumRuntimeMinutes: 20,
        outputKind: 'video',
        requiresGpu: true,
        readyForPaidWork: true,
        blockers: [],
        notes: []
      }
    ])
    const cloudStatus: CloudConnectionStatus = {
      ...connectedCloudStatus,
      gpuOptions: [
        {
          id: 'GPU-24',
          name: 'RTX 4090',
          memoryGb: 24,
          secureHourlyUsd: 0.74,
          communityHourlyUsd: 0.44,
          ltxCompatibility: 'below-baseline'
        },
        {
          id: 'GPU-48',
          name: 'RTX 6000 Ada',
          memoryGb: 48,
          secureHourlyUsd: 1.5,
          communityHourlyUsd: 1.1,
          ltxCompatibility: 'meets-baseline'
        }
      ]
    }

    render(
      <GenerateRoom
        project={createdFilm}
        cloudStatus={cloudStatus}
        onHome={vi.fn()}
        onSettings={vi.fn()}
      />
    )

    expect(
      (await screen.findByRole('radio', {
        name: /Animate an approved shot/i
      })) as HTMLInputElement
    ).toHaveProperty('checked', true)
    expect((screen.getByRole('button', { name: /RTX 4090/i }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(screen.getByText('Needs 48 GB; this option has 24 GB.')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /RTX 6000 Ada/i }) as HTMLButtonElement).disabled
    ).toBe(false)
    expect(screen.getByText(/\$0\.20 expected · \$0\.50 maximum/i)).toBeTruthy()
    expect(screen.queryByText(/comfyui/i)).toBeNull()
    expect(screen.queryByText(/ltx2-image-to-video-final/i)).toBeNull()
  })
})

describe('media review room', () => {
  it('compares take details, keeps holds resumable, and starts a linked retake', async () => {
    const user = userEvent.setup()
    const asset = {
      schemaVersion: 1 as const,
      assetId: '01J00000000000000000000031',
      projectId: createdFilm.manifest.id,
      kind: 'video-take' as const,
      label: 'Kite launch · take one',
      relativePath: 'assets/generated/take-one.mp4',
      mimeType: 'video/mp4',
      byteSize: 2048,
      sha256: 'a'.repeat(64),
      origin: 'generated' as const,
      jobId: '01J00000000000000000000030',
      parentAssetIds: [],
      copiedFrom: null,
      state: 'candidate' as const,
      width: 1920,
      height: 1080,
      durationMs: 5_000,
      createdAt: '2026-08-21T18:10:00.000Z',
      mediaUrl: `studio-media://asset/${createdFilm.manifest.id}/01J00000000000000000000031`
    }
    const job = {
      schemaVersion: 1 as const,
      jobId: asset.jobId,
      projectId: createdFilm.manifest.id,
      kind: 'ltx-video-final' as const,
      label: 'Kite launch motion',
      state: 'awaiting-review' as const,
      workflowId: 'ltx2-image-to-video-final',
      workflowVersion: '1.0.0',
      inputAssetIds: [],
      canonIds: [],
      parentJobId: null,
      retakeOfAssetId: null,
      parameters: {
        motionPrompt: 'The child launches the repaired kite into a steady coastal wind.',
        seed: 99
      },
      idempotencyKey: 'b'.repeat(64),
      estimate: {
        estimateId: '01J00000000000000000000032',
        currency: 'USD' as const,
        gpuCount: 1,
        hourlyRateUsdPerGpu: 1.5,
        expectedRuntimeMinutes: 8,
        maximumRuntimeMinutes: 20,
        expectedComputeUsd: 0.2,
        maximumComputeUsd: 0.5,
        storageUsd: 0,
        providerExtrasUsd: 0,
        expectedTotalUsd: 0.2,
        maximumTotalUsd: 0.5,
        explanation: ['One reviewed motion pass.'],
        priceSource: 'Saved test price',
        pricedAt: '2026-08-21T18:00:00.000Z',
        expiresAt: '2026-08-21T19:00:00.000Z'
      },
      approvedMaximumUsd: 0.5,
      actualCostUsd: 0.21,
      elapsedCostEstimateUsd: 0.21,
      costState: 'provider-reconciled' as const,
      outputAssetIds: [asset.assetId],
      workerLeaseId: null,
      workerPodId: null,
      workerHardDeadline: null,
      workerClosedAt: '2026-08-21T18:11:00.000Z',
      recoverable: true,
      lastErrorCode: null,
      createdAt: '2026-08-21T18:00:00.000Z',
      updatedAt: '2026-08-21T18:11:00.000Z'
    }
    let currentAsset: ProductionWorkspaceSummary['media'][number] = asset
    window.studio.production.getWorkspace = vi.fn().mockImplementation(async () => ({
      projectId: createdFilm.manifest.id,
      canon: [],
      media: [currentAsset],
      jobs: [job],
      canonImpacts: [],
      draftFingerprints: [],
      staleDependencyCount: 0,
      estimatedApprovedSpendUsd: 0.5,
      actualSpendUsd: 0.21,
      elapsedCloudUsageEstimateUsd: 0.21
    }))
    const reviewMedia = vi.fn().mockImplementation(async (input) => {
      currentAsset = {
        ...currentAsset,
        state:
          input.decision === 'approved'
            ? 'approved'
            : input.decision === 'held'
              ? 'held'
              : 'rejected'
      }
      return { ok: true, asset: currentAsset }
    })
    window.studio.production.reviewMedia = reviewMedia
    const onRetake = vi.fn()

    render(<MediaReviewRoom project={createdFilm} onHome={vi.fn()} onRetake={onRetake} />)

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Kite launch · take one' })
    ).toBeTruthy()
    await user.click(screen.getByText('Show details'))
    expect(screen.getByText(/The child launches the repaired kite/i)).toBeTruthy()
    expect(screen.getByLabelText('Zoom')).toBeTruthy()
    expect(screen.getByLabelText('Playback speed')).toBeTruthy()
    await user.type(screen.getByLabelText(/Review note/i), 'Check the cloud movement first.')
    await user.click(screen.getByRole('button', { name: /Hold/i }))
    await waitFor(() =>
      expect(reviewMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ decision: 'held', assetId: asset.assetId })
      )
    )
    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Hold/i }) as HTMLButtonElement).disabled).toBe(
        true
      )
    )
    await user.click(screen.getByRole('button', { name: /Retake/i }))
    await waitFor(() =>
      expect(reviewMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ decision: 'changes-requested', assetId: asset.assetId })
      )
    )
    expect(onRetake).toHaveBeenCalledWith({ asset: expect.any(Object), job })
  })
})

describe('creative room', () => {
  it('shows the connection handoff when no writing profile exists', () => {
    render(
      <CreativeRoom
        project={createdFilm}
        writingStatus={disconnectedWritingStatus}
        onHome={vi.fn()}
        onSettings={vi.fn()}
      />
    )

    expect(
      screen.getByRole('heading', {
        name: 'Connect GPT, Claude, or Gemini to start guided story development.'
      })
    ).toBeTruthy()
  })

  it('requires explicit paid confirmation and shows the saved response as a proposal', async () => {
    const user = userEvent.setup()
    const draft = {
      schemaVersion: 1 as const,
      draftId: '01J00000000000000000000009',
      projectId: createdFilm.manifest.id,
      taskKind: 'outline_episode' as const,
      status: 'proposal' as const,
      provider: 'openai' as const,
      model: 'gpt-5.6-terra',
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
        writingStatus={{ ...connectedWritingStatus, defaultProfile: null }}
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
    expect((createButton as HTMLButtonElement).disabled).toBe(false)
    await user.click(createButton)
    const approvalAlert = await screen.findByRole('alertdialog')
    expect(within(approvalAlert).getByText(/paid-token approval box/i)).toBeTruthy()
    expect(generateDraft).not.toHaveBeenCalled()
    const closeAlert = within(approvalAlert).getByRole('button', { name: 'Go back and fix' })
    expect(document.activeElement).toBe(closeAlert)
    await user.tab()
    expect(document.activeElement).toBe(closeAlert)
    await user.click(closeAlert)
    expect(document.activeElement).toBe(createButton)
    await user.click(
      screen.getByLabelText('I approve one paid text request using the model shown above.')
    )
    expect((createButton as HTMLButtonElement).disabled).toBe(false)
    await user.click(createButton)

    await screen.findByRole('heading', { name: 'The Kite Above the Storm' })
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        paidConfirmed: true,
        provider: 'openai',
        model: 'gpt-5.6-terra'
      })
    )
    expect(screen.getByText('Proposal · not canon')).toBeTruthy()
    expect(screen.getByText(/External skills used: none/)).toBeTruthy()
  })
})

describe('audience and creative direction', () => {
  it('saves a revision through the project overview without replacing the prior version', async () => {
    const user = userEvent.setup()
    const updated: ProjectDetails = {
      ...createdFilm,
      creativeDirection: {
        ...createdFilm.creativeDirection!,
        profileId: '01J00000000000000000000010',
        revision: 2,
        direction: {
          ...createdFilm.creativeDirection!.direction,
          primaryNiche: 'Hopeful African family fantasy'
        }
      }
    }
    const saveCreativeDirection = vi
      .fn<StudioApi['projects']['saveCreativeDirection']>()
      .mockResolvedValue(updated)
    window.studio.projects.saveCreativeDirection = saveCreativeDirection
    const onUpdated = vi.fn()
    render(<CreativeDirectionPanel project={createdFilm} onUpdated={onUpdated} />)

    await user.click(screen.getByRole('button', { name: 'Revise direction' }))
    const niche = screen.getByLabelText('Primary niche')
    await user.clear(niche)
    await user.click(screen.getByRole('button', { name: 'Save as new version' }))
    const directionAlert = await screen.findByRole('alertdialog')
    expect(
      within(directionAlert).getByText(/primary niche using at least 2 characters/i)
    ).toBeTruthy()
    expect(saveCreativeDirection).not.toHaveBeenCalled()
    await user.click(within(directionAlert).getByRole('button', { name: 'Go back and fix' }))
    await user.type(niche, 'Hopeful African family fantasy')
    await user.click(screen.getByRole('button', { name: 'Save as new version' }))

    await waitFor(() =>
      expect(saveCreativeDirection).toHaveBeenCalledWith({
        projectId: createdFilm.manifest.id,
        expectedProfileId: createdFilm.creativeDirection!.profileId,
        direction: expect.objectContaining({ primaryNiche: 'Hopeful African family fantasy' })
      })
    )
    expect(onUpdated).toHaveBeenCalledWith(updated)
    expect(createdFilm.creativeDirection?.revision).toBe(1)
  })
})

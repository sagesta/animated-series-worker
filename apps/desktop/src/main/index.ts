import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  safeStorage,
  type OpenDialogOptions,
  type IpcMainInvokeEvent
} from 'electron'
import { ZodError } from 'zod'
import {
  AcceptUpstreamImportInputSchema,
  CloudActionResultSchema,
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGuardrailsSchema,
  CanonActionResultSchema,
  ChooseMediaAssetInputSchema,
  CreateProjectInputSchema,
  ExternalSkillActionResultSchema,
  ExternalSkillPlanPreviewInputSchema,
  ExternalSkillPlanPreviewSchema,
  ExternalSkillRemoveInputSchema,
  ExternalSkillSetProjectEnabledInputSchema,
  ExternalSkillStatusSchema,
  FinishActionResultSchema,
  FinishWorkspaceSchema,
  ExportCaptionsInputSchema,
  InstallLocalMediaToolsInputSchema,
  IPC_CHANNELS,
  MediaActionResultSchema,
  CreateReleasePackageInputSchema,
  LockProductionTimelineInputSchema,
  LocalMediaActionResultSchema,
  LocalMediaInstallResultSchema,
  LocalMediaRuntimeStatusSchema,
  ProductionJobActionResultSchema,
  ProductionJobApprovalInputSchema,
  ProductionJobDetailsSchema,
  ProductionJobInputSchema,
  ProductionCancelJobInputSchema,
  ProductionQueueJobInputSchema,
  ProductionWorkflowEstimateInputSchema,
  ProductionWorkflowEstimateResultSchema,
  ProductionWorkflowSummarySchema,
  ProductionWorkspaceSummarySchema,
  PromoteWritingDraftInputSchema,
  ProjectBackupSummarySchema,
  ProjectCreativeDirectionUpdateInputSchema,
  ProjectDetailsSchema,
  ProjectMigrationInputSchema,
  ProjectMigrationPreviewSchema,
  ProjectMigrationResultSchema,
  ProjectRestoreResultSchema,
  ProjectSummarySchema,
  RendererErrorInputSchema,
  ReviewMediaAssetInputSchema,
  ReviewReleaseLearningInputSchema,
  RenderThumbnailInputSchema,
  RenderTimelineInputSchema,
  SaveProductionTimelineInputSchema,
  SavePerformanceSnapshotInputSchema,
  SaveProjectReleaseProfileInputSchema,
  SaveReleaseAttestationsInputSchema,
  SaveReleaseDetailsInputSchema,
  SaveReleaseIdeaInputSchema,
  SaveReleaseLearningInputSchema,
  SupportBundleSummarySchema,
  SystemStatusSchema,
  UlidSchema,
  UpstreamImportActionResultSchema,
  UpstreamImportRecordSchema,
  WritingConnectInputSchema,
  WritingContextPreviewInputSchema,
  WritingContextPreviewSchema,
  WritingDefaultProfileSchema,
  WritingDraftActionResultSchema,
  WritingDraftRecordSchema,
  WritingDraftRequestSchema,
  WritingProviderEnabledInputSchema,
  WritingProviderInputSchema,
  WritingSettingsActionResultSchema,
  WritingSettingsStatusSchema
} from '@studio/contracts'
import { CloudSettingsStore, CloudSetupService, toCloudActionError } from '@studio/cloud-setup'
import {
  CreativeWritingService,
  WritingSettingsStore,
  WritingSetupService,
  toWritingActionError
} from '@studio/creative-writing'
import { EncryptedCredentialVault, EncryptedSecretMapVault } from '@studio/credential-vault'
import { ProjectStore } from '@studio/project-store'
import { AnthropicClient } from '@studio/provider-anthropic'
import { GeminiClient } from '@studio/provider-gemini'
import { OpenAiClient } from '@studio/provider-openai'
import { RunPodClient } from '@studio/provider-runpod'
import { ProductionOrchestrator } from '@studio/production-orchestrator'
import { verifyProductionReadiness } from '@studio/production-readiness'
import { LocalProductionService } from '@studio/local-production'
import { ReleaseStore } from '@studio/release-store'
import {
  ProductionStore,
  buildMediaImportInput,
  toProductionActionError
} from '@studio/production-store'
import { DeclarativeSkillRegistry, toExternalSkillActionError } from '@studio/skill-runtime'
import { SafeDiagnostics, type DiagnosticEventInput } from '@studio/support-diagnostics'
import { UpstreamAdapter, toUpstreamActionError } from '@studio/upstream-adapter'
import { WorkflowRegistry } from '@studio/workflow-registry'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'studio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  },
  {
    scheme: 'studio-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
])

app.enableSandbox()
const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let projectStore: ProjectStore | null = null
let cloudSetupService: CloudSetupService | null = null
let writingSetupService: WritingSetupService | null = null
let creativeWritingService: CreativeWritingService | null = null
let productionStore: ProductionStore | null = null
let productionOrchestrator: ProductionOrchestrator | null = null
let releaseStore: ReleaseStore | null = null
let localProductionService: LocalProductionService | null = null
let upstreamAdapter: UpstreamAdapter | null = null
let skillRegistry: DeclarativeSkillRegistry | null = null
let diagnostics: SafeDiagnostics | null = null
let storeClosed = false
let recoveryTimer: NodeJS.Timeout | null = null
let recoveryRunning = false

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

function registerStudioProtocol(): void {
  const rendererRoot = resolve(__dirname, '../renderer')

  protocol.handle('studio', (request) => {
    const requestUrl = new URL(request.url)
    if (requestUrl.host !== 'app') {
      return new Response('Not found', { status: 404 })
    }

    const requestedPath =
      decodeURIComponent(requestUrl.pathname) === '/'
        ? 'index.html'
        : decodeURIComponent(requestUrl.pathname).replace(/^[/\\]+/, '')
    const filePath = resolve(rendererRoot, requestedPath)
    const pathFromRoot = relative(rendererRoot, filePath)

    if (pathFromRoot.startsWith('..') || pathFromRoot.includes(`..${sep}`)) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })

  protocol.handle('studio-media', (request) => {
    try {
      const requestUrl = new URL(request.url)
      const pathParts = requestUrl.pathname.split('/').filter(Boolean)
      if (requestUrl.host !== 'asset' || pathParts.length !== 2) {
        return new Response('Not found', { status: 404 })
      }
      const projectId = UlidSchema.parse(pathParts[0])
      const assetId = UlidSchema.parse(pathParts[1])
      const media = requireProductionStore().resolveMediaPath(projectId, assetId)
      return net.fetch(pathToFileURL(media.path).toString(), {
        headers: request.headers
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    !event.senderFrame ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    return false
  }

  try {
    const senderUrl = new URL(event.senderFrame.url)
    const developmentUrl = process.env.ELECTRON_RENDERER_URL

    if (!app.isPackaged && developmentUrl) {
      return senderUrl.origin === new URL(developmentUrl).origin
    }

    return senderUrl.protocol === 'studio:' && senderUrl.host === 'app'
  } catch {
    return false
  }
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  if (!isTrustedSender(event)) {
    throw new Error('This request was blocked by the studio safety boundary.')
  }
}

function requireStore(): ProjectStore {
  if (!projectStore) {
    throw new Error('The local project library is not ready.')
  }

  return projectStore
}

function requireCloudSetup(): CloudSetupService {
  if (!cloudSetupService) {
    throw new Error('The cloud setup service is not ready.')
  }

  return cloudSetupService
}

function requireWritingSetup(): WritingSetupService {
  if (!writingSetupService) throw new Error('The writing setup service is not ready.')
  return writingSetupService
}

function requireCreativeWriting(): CreativeWritingService {
  if (!creativeWritingService) throw new Error('The creative writing service is not ready.')
  return creativeWritingService
}

function requireProductionStore(): ProductionStore {
  if (!productionStore) throw new Error('The local production workspace is not ready.')
  return productionStore
}

function requireProductionOrchestrator(): ProductionOrchestrator {
  if (!productionOrchestrator) throw new Error('The production workflow engine is not ready.')
  return productionOrchestrator
}

function requireReleaseStore(): ReleaseStore {
  if (!releaseStore) throw new Error('The edit and release workspace is not ready.')
  return releaseStore
}

function requireLocalProduction(): LocalProductionService {
  if (!localProductionService) throw new Error('The local render engine is not ready.')
  return localProductionService
}

function requireUpstreamAdapter(): UpstreamAdapter {
  if (!upstreamAdapter) throw new Error('The pinned upstream story importer is not ready.')
  return upstreamAdapter
}

function requireSkillRegistry(): DeclarativeSkillRegistry {
  if (!skillRegistry) throw new Error('The local creative-skill library is not ready.')
  return skillRegistry
}

function requireDiagnostics(): SafeDiagnostics {
  if (!diagnostics) {
    throw new Error('The local support recorder is not ready.')
  }

  return diagnostics
}

function recordDiagnostic(input: DiagnosticEventInput): void {
  void diagnostics?.record(input).catch(() => {
    // Diagnostics must never crash or unlock a production action.
  })
}

async function reconcileActiveProductionJobs(): Promise<void> {
  if (
    recoveryRunning ||
    !projectStore ||
    !productionStore ||
    !productionOrchestrator ||
    !cloudSetupService
  ) {
    return
  }
  recoveryRunning = true
  try {
    const cloud = await cloudSetupService.getStatus()
    if (!cloud.credentialStored) return
    const recoverableStates = new Set([
      'queued',
      'provisioning',
      'running',
      'downloading',
      'verifying',
      'awaiting-review',
      'cancel-requested',
      'failed',
      'cancelled',
      'succeeded'
    ])
    for (const project of projectStore.listProjects()) {
      const jobs = productionStore
        .getWorkspace(project.id)
        .jobs.filter(
          (job) => job.workerLeaseId && !job.workerClosedAt && recoverableStates.has(job.state)
        )
      for (const job of jobs) {
        const result = await productionOrchestrator.reconcileJob(project.id, job.jobId)
        if (!result.ok && result.error.code !== 'not-found') {
          recordDiagnostic({
            level: 'warning',
            area: 'production',
            eventName: 'production.worker.reconcile-attention',
            message: 'A protected worker session needs attention; no replacement was created.',
            context: {
              projectId: project.id,
              jobId: job.jobId,
              errorCode: result.error.code
            }
          })
        }
      }
    }
  } catch {
    // A recovery check must never crash the app or create a replacement worker.
  } finally {
    recoveryRunning = false
  }
}

function safeInputMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Check the project details and try again.'
  }

  return 'The project could not be created safely. No existing project was changed.'
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.systemGetStatus, async (event) => {
    assertTrustedSender(event)
    const store = requireStore()
    const indexedProjects = store.listProjects().length
    let cloudGpuState: 'not-configured' | 'account-connected' | 'attention' = 'attention'
    let generationState: 'locked' | 'ready' = 'locked'
    let generationReason = 'Production readiness could not be checked safely.'

    try {
      const cloudStatus = await requireCloudSetup().getStatus()
      cloudGpuState =
        cloudStatus.connectionState === 'connected'
          ? 'account-connected'
          : cloudStatus.connectionState
      generationState = cloudStatus.generationState
      generationReason = cloudStatus.generationReason
    } catch {
      cloudGpuState = 'attention'
    }

    return SystemStatusSchema.parse({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      storagePath: store.workspaceRoot,
      indexedProjects,
      catalogState: 'ready',
      cloudGpuState,
      generationState,
      generationReason
    })
  })

  ipcMain.handle(IPC_CHANNELS.projectsList, (event) => {
    assertTrustedSender(event)
    try {
      return ProjectSummarySchema.array().parse(requireStore().listProjects())
    } catch {
      throw new Error('The studio could not read the local project library safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsCreate, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = CreateProjectInputSchema.parse(unknownInput)
      const project = ProjectDetailsSchema.parse(requireStore().createProject(input))
      recordDiagnostic({
        level: 'info',
        area: 'project',
        eventName: 'project.created',
        message: 'A local project was created safely.',
        context: { projectId: project.manifest.id, projectType: project.manifest.type }
      })
      return project
    } catch (error) {
      recordDiagnostic({
        level: 'warning',
        area: 'project',
        eventName: 'project.create.failed',
        message: 'A local project could not be created safely.'
      })
      throw new Error(safeInputMessage(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsOpen, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return ProjectDetailsSchema.parse(requireStore().openProject(projectId))
    } catch {
      throw new Error('That project could not be opened safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsSaveCreativeDirection, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ProjectCreativeDirectionUpdateInputSchema.parse(unknownInput)
      const project = ProjectDetailsSchema.parse(requireStore().saveCreativeDirection(input))
      recordDiagnostic({
        level: 'info',
        area: 'project',
        eventName: 'project.creative-direction.saved',
        message: 'A new local creative-direction version was saved.',
        context: {
          projectId: project.manifest.id,
          profileId: project.creativeDirection?.profileId ?? null,
          revision: project.creativeDirection?.revision ?? null
        }
      })
      return project
    } catch (error) {
      recordDiagnostic({
        level: 'warning',
        area: 'project',
        eventName: 'project.creative-direction.failed',
        message: 'A creative-direction version could not be saved safely.'
      })
      throw new Error(safeInputMessage(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsListBackups, async (event) => {
    assertTrustedSender(event)
    try {
      return ProjectBackupSummarySchema.array().parse(await requireStore().listBackups())
    } catch {
      throw new Error('The studio could not verify the available project backups.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsBackup, async (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    const correlationId = randomUUID()
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      const backup = ProjectBackupSummarySchema.parse(await requireStore().createBackup(projectId))
      await requireDiagnostics().record({
        correlationId,
        level: 'info',
        area: 'backup',
        eventName: 'backup.completed',
        message: 'A verified local project backup completed.',
        context: {
          projectId: backup.projectId,
          backupId: backup.backupId,
          fileCount: backup.fileCount,
          totalBytes: backup.totalBytes
        }
      })
      return backup
    } catch {
      recordDiagnostic({
        correlationId,
        level: 'error',
        area: 'backup',
        eventName: 'backup.failed',
        message: 'A local project backup failed before verified completion.'
      })
      throw new Error(
        'The backup could not be completed and verified. The project itself was not changed.'
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsRestore, async (event, unknownBackupId: unknown) => {
    assertTrustedSender(event)
    const correlationId = randomUUID()
    try {
      const backupId = UlidSchema.parse(unknownBackupId)
      const restored = ProjectRestoreResultSchema.parse(
        await requireStore().restoreBackup(backupId)
      )
      await requireDiagnostics().record({
        correlationId,
        level: 'info',
        area: 'backup',
        eventName: 'restore.completed',
        message: 'A verified local project restore completed.',
        context: {
          projectId: restored.project.manifest.id,
          backupId: restored.backupId
        }
      })
      return restored
    } catch {
      recordDiagnostic({
        correlationId,
        level: 'error',
        area: 'backup',
        eventName: 'restore.failed',
        message: 'A local project restore failed before safe activation.'
      })
      throw new Error(
        'The project could not be restored safely. Existing project files were not overwritten.'
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsGetMigrationPreview, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return ProjectMigrationPreviewSchema.nullable().parse(
        requireStore().getMigrationPreview(projectId)
      )
    } catch {
      throw new Error('The project format update could not be previewed safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsMigrate, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const correlationId = randomUUID()
    try {
      const input = ProjectMigrationInputSchema.parse(unknownInput)
      const result = ProjectMigrationResultSchema.parse(await requireStore().migrateProject(input))
      await requireDiagnostics().record({
        correlationId,
        level: 'info',
        area: 'project',
        eventName: 'project.migration.completed',
        message: 'A project format update completed after verified backup.',
        context: {
          projectId: result.project.manifest.id,
          migrationId: result.migrationId,
          backupId: result.backup.backupId
        }
      })
      return result
    } catch {
      recordDiagnostic({
        correlationId,
        level: 'error',
        area: 'project',
        eventName: 'project.migration.failed',
        message: 'A project format update failed and automatic rollback was attempted.'
      })
      throw new Error(
        'The project format update could not finish safely. The verified recovery copy was retained.'
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.supportRecordRendererError, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = RendererErrorInputSchema.parse(unknownInput)
    await requireDiagnostics().record({
      level: 'error',
      area: 'renderer',
      eventName: 'renderer.boundary.failed',
      message: input.message,
      context: { componentStack: input.componentStack ?? null }
    })
  })

  ipcMain.handle(IPC_CHANNELS.supportCreateBundle, async (event) => {
    assertTrustedSender(event)
    try {
      let cloudConnectionState = 'attention'
      let generationState: 'locked' | 'ready' = 'locked'
      try {
        const cloudStatus = await requireCloudSetup().getStatus()
        cloudConnectionState = cloudStatus.connectionState
        generationState = cloudStatus.generationState
      } catch {
        // The support snapshot records attention without copying a provider error or payload.
      }

      await requireDiagnostics().record({
        level: 'info',
        area: 'application',
        eventName: 'support.bundle.requested',
        message: 'A redacted local support bundle was requested.'
      })
      return SupportBundleSummarySchema.parse(
        await requireDiagnostics().createBundle({
          appVersion: app.getVersion(),
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
          platform: process.platform,
          architecture: process.arch,
          projectCount: requireStore().listProjects().length,
          catalogState: 'ready',
          cloudConnectionState,
          generationState
        })
      )
    } catch {
      throw new Error(
        'The support file could not be created safely. No project or cloud resource was changed.'
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudGetStatus, async (event) => {
    assertTrustedSender(event)
    try {
      return CloudConnectionStatusSchema.parse(await requireCloudSetup().getStatus())
    } catch {
      throw new Error('The local cloud settings could not be read. No paid action was started.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudConnect, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = CloudConnectInputSchema.parse(unknownInput)
      const status = await requireCloudSetup().connect(input)
      const result = CloudActionResultSchema.parse({
        ok: true,
        status
      })
      recordDiagnostic({
        level: 'info',
        area: 'cloud',
        eventName: 'cloud.connection.completed',
        message: 'The no-cost cloud account check completed.',
        context: {
          activePods: status.account?.activePods ?? 0,
          validationCostUsd: status.validationCostUsd,
          generationState: status.generationState
        }
      })
      return result
    } catch (error) {
      const result = CloudActionResultSchema.parse(toCloudActionError(error))
      recordDiagnostic({
        level: 'warning',
        area: 'cloud',
        eventName: 'cloud.connection.failed',
        message: 'The no-cost cloud account check failed safely.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudRefresh, async (event) => {
    assertTrustedSender(event)
    try {
      const result = CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().refresh()
      })
      recordDiagnostic({
        level: 'info',
        area: 'cloud',
        eventName: 'cloud.connection.refreshed',
        message: 'The saved cloud connection was checked again without paid work.'
      })
      return result
    } catch (error) {
      const result = CloudActionResultSchema.parse(toCloudActionError(error))
      recordDiagnostic({
        level: 'warning',
        area: 'cloud',
        eventName: 'cloud.refresh.failed',
        message: 'The saved cloud connection refresh failed safely.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudDisconnect, async (event) => {
    assertTrustedSender(event)
    try {
      const result = CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().disconnect()
      })
      recordDiagnostic({
        level: 'info',
        area: 'security',
        eventName: 'credential.runpod.removed',
        message: 'The protected local RunPod credential was removed.'
      })
      return result
    } catch (error) {
      const result = CloudActionResultSchema.parse(toCloudActionError(error))
      recordDiagnostic({
        level: 'error',
        area: 'security',
        eventName: 'credential.runpod.remove-failed',
        message: 'The protected local RunPod credential could not be removed safely.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudSaveGuardrails, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = CloudGuardrailsSchema.parse(unknownInput)
      return CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().saveGuardrails(input)
      })
    } catch (error) {
      return CloudActionResultSchema.parse(toCloudActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingGetStatus, async (event) => {
    assertTrustedSender(event)
    return WritingSettingsStatusSchema.parse(await requireWritingSetup().getStatus())
  })

  ipcMain.handle(IPC_CHANNELS.writingConnect, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingConnectInputSchema.parse(unknownInput)
      const result = WritingSettingsActionResultSchema.parse({
        ok: true,
        status: await requireWritingSetup().connect(input)
      })
      recordDiagnostic({
        level: 'info',
        area: 'writing',
        eventName: 'writing.connection.completed',
        message: 'A writing provider passed the no-cost model-list check.',
        context: { provider: input.provider, validationCostUsd: 0 }
      })
      return result
    } catch (error) {
      const result = WritingSettingsActionResultSchema.parse(toWritingActionError(error))
      recordDiagnostic({
        level: 'warning',
        area: 'writing',
        eventName: 'writing.connection.failed',
        message: 'A writing provider connection check failed safely.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingRefresh, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingProviderInputSchema.parse(unknownInput)
      return WritingSettingsActionResultSchema.parse({
        ok: true,
        status: await requireWritingSetup().refresh(input)
      })
    } catch (error) {
      return WritingSettingsActionResultSchema.parse(toWritingActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingDisconnect, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingProviderInputSchema.parse(unknownInput)
      const result = WritingSettingsActionResultSchema.parse({
        ok: true,
        status: await requireWritingSetup().disconnect(input)
      })
      recordDiagnostic({
        level: 'info',
        area: 'security',
        eventName: `credential.${input.provider}.removed`,
        message: 'A protected writing-provider credential was removed.'
      })
      return result
    } catch (error) {
      return WritingSettingsActionResultSchema.parse(toWritingActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingSetEnabled, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingProviderEnabledInputSchema.parse(unknownInput)
      return WritingSettingsActionResultSchema.parse({
        ok: true,
        status: await requireWritingSetup().setEnabled(input)
      })
    } catch (error) {
      return WritingSettingsActionResultSchema.parse(toWritingActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingSaveDefaultProfile, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingDefaultProfileSchema.parse(unknownInput)
      return WritingSettingsActionResultSchema.parse({
        ok: true,
        status: await requireWritingSetup().saveDefaultProfile(input)
      })
    } catch (error) {
      return WritingSettingsActionResultSchema.parse(toWritingActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingPreviewContext, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = WritingContextPreviewInputSchema.parse(unknownInput)
      return WritingContextPreviewSchema.parse(requireCreativeWriting().previewContext(input))
    } catch {
      throw new Error('The selected local story context could not be previewed safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingGenerateDraft, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const correlationId = randomUUID()
    try {
      const input = WritingDraftRequestSchema.parse(unknownInput)
      const draft = await requireCreativeWriting().generateDraft(input)
      const result = WritingDraftActionResultSchema.parse({ ok: true, draft })
      await requireDiagnostics().record({
        correlationId,
        level: 'info',
        area: 'writing',
        eventName: 'writing.draft.saved',
        message: 'A provider response was validated and saved as a local proposal.',
        context: {
          projectId: draft.projectId,
          draftId: draft.draftId,
          provider: draft.provider,
          model: draft.model,
          inputTokens: draft.usage.inputTokens,
          outputTokens: draft.usage.outputTokens,
          skillsUsed: draft.skillsUsed.filter((receipt) => receipt.status === 'succeeded').length
        }
      })
      return result
    } catch (error) {
      const result = WritingDraftActionResultSchema.parse(toWritingActionError(error))
      recordDiagnostic({
        correlationId,
        level: 'warning',
        area: 'writing',
        eventName: 'writing.draft.failed',
        message: 'A writing request failed before a local proposal was saved.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.writingListDrafts, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return WritingDraftRecordSchema.array().parse(requireCreativeWriting().listDrafts(projectId))
    } catch {
      throw new Error('The saved writing proposals could not be read safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.productionGetWorkspace, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return ProductionWorkspaceSummarySchema.parse(
        requireProductionStore().getWorkspace(projectId)
      )
    } catch {
      throw new Error('The production workspace could not be read safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.productionPromoteDraft, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = PromoteWritingDraftInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return CanonActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the approval details.'
        }
      })
    }
    const result = requireProductionStore().promoteWritingDraft(input.data)
    recordDiagnostic({
      level: result.ok ? 'info' : 'warning',
      area: 'production',
      eventName: result.ok ? 'production.canon.approved' : 'production.canon.failed',
      message: result.ok
        ? 'A reviewed writing proposal became a versioned canon record.'
        : 'A canon approval was refused without changing the project.',
      context: {
        projectId: input.data.projectId,
        draftId: input.data.draftId,
        result: result.ok ? 'approved' : result.error.code
      }
    })
    return CanonActionResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.productionImportMedia, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ChooseMediaAssetInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return MediaActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the media details.'
        }
      })
    }
    requireStore().openProject(input.data.projectId)
    const options: OpenDialogOptions = {
      title: 'Choose media for this production',
      buttonLabel: 'Import safe local copy',
      properties: ['openFile'],
      filters: [
        {
          name: 'Supported production media',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'wav',
            'mp3',
            'mp4',
            'webm',
            'srt',
            'vtt',
            'json',
            'pdf'
          ]
        }
      ]
    }
    const selection = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (selection.canceled || !selection.filePaths[0]) {
      return MediaActionResultSchema.parse({
        ok: false,
        error: { code: 'invalid-input', message: 'No media file was selected.' }
      })
    }
    const result = await requireProductionStore().importMedia(
      buildMediaImportInput(input.data, selection.filePaths[0])
    )
    recordDiagnostic({
      level: result.ok ? 'info' : 'warning',
      area: 'production',
      eventName: result.ok ? 'production.media.imported' : 'production.media.import-failed',
      message: result.ok
        ? 'A verified local copy of a media file was added to one production.'
        : 'A media import was refused without changing an existing asset.',
      context: {
        projectId: input.data.projectId,
        result: result.ok ? 'candidate' : result.error.code
      }
    })
    return MediaActionResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.productionReviewMedia, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ReviewMediaAssetInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return MediaActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the review details.'
        }
      })
    }
    return MediaActionResultSchema.parse(requireProductionStore().reviewMedia(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.productionPlanJob, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ProductionJobInputSchema.parse(unknownInput)
      return ProductionJobActionResultSchema.parse(requireProductionStore().planJob(input))
    } catch (error) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: toProductionActionError(error)
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.productionApproveJob, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ProductionJobApprovalInputSchema.parse(unknownInput)
      return ProductionJobActionResultSchema.parse(requireProductionStore().approveJob(input))
    } catch (error) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: toProductionActionError(error)
      })
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.productionGetJob,
    (event, unknownProjectId: unknown, unknownJobId: unknown) => {
      assertTrustedSender(event)
      try {
        return ProductionJobDetailsSchema.parse(
          requireProductionStore().getProjectJob(
            UlidSchema.parse(unknownProjectId),
            UlidSchema.parse(unknownJobId)
          )
        )
      } catch {
        throw new Error('That production job could not be read safely.')
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.productionListWorkflows, (event) => {
    assertTrustedSender(event)
    return ProductionWorkflowSummarySchema.array().parse(
      requireProductionOrchestrator().listWorkflows()
    )
  })

  ipcMain.handle(IPC_CHANNELS.productionEstimateWorkflow, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ProductionWorkflowEstimateInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return ProductionWorkflowEstimateResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the workflow estimate details.'
        }
      })
    }
    return ProductionWorkflowEstimateResultSchema.parse(
      await requireProductionOrchestrator().estimateWorkflow(input.data)
    )
  })

  ipcMain.handle(IPC_CHANNELS.productionQueueJob, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ProductionQueueJobInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the start confirmation.'
        }
      })
    }
    const result = await requireProductionOrchestrator().queueApprovedJob(input.data)
    recordDiagnostic({
      level: result.ok ? 'info' : 'warning',
      area: 'worker',
      eventName: result.ok ? 'worker.lease.queued' : 'worker.lease.refused',
      message: result.ok
        ? 'A cost-approved worker lease entered provider reconciliation.'
        : 'A worker start was refused before an unsafe or unapproved action.',
      context: {
        projectId: input.data.projectId,
        jobId: input.data.jobId,
        result: result.ok ? result.details.job.state : result.error.code
      }
    })
    return ProductionJobActionResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.productionCancelJob, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ProductionCancelJobInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return ProductionJobActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the cancellation reason.'
        }
      })
    }
    return ProductionJobActionResultSchema.parse(
      await requireProductionOrchestrator().cancelJob(input.data)
    )
  })

  ipcMain.handle(
    IPC_CHANNELS.productionReconcileJob,
    async (event, unknownProjectId: unknown, unknownJobId: unknown) => {
      assertTrustedSender(event)
      try {
        return ProductionJobActionResultSchema.parse(
          await requireProductionOrchestrator().reconcileJob(
            UlidSchema.parse(unknownProjectId),
            UlidSchema.parse(unknownJobId)
          )
        )
      } catch {
        return ProductionJobActionResultSchema.parse({
          ok: false,
          error: {
            code: 'unknown',
            message: 'The worker could not be reconciled safely. No retry was started.'
          }
        })
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.finishGetWorkspace, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    return FinishWorkspaceSchema.parse(
      requireReleaseStore().getWorkspace(UlidSchema.parse(unknownProjectId))
    )
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveTimeline, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveProductionTimelineInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the timeline details.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().saveTimeline(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishLockTimeline, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = LockProductionTimelineInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the timeline lock confirmation.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().lockTimeline(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveReleaseDetails, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveReleaseDetailsInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the YouTube release details.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().saveReleaseDetails(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveAttestations, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveReleaseAttestationsInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Complete every human release decision.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().saveAttestations(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveReleaseProfile, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveProjectReleaseProfileInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the release-profile details.'
        }
      })
    }
    return FinishActionResultSchema.parse(
      requireReleaseStore().saveProjectReleaseProfile(input.data)
    )
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveIdea, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveReleaseIdeaInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the Idea Library entry.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().saveIdea(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishSavePerformanceSnapshot, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SavePerformanceSnapshotInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the performance evidence.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().savePerformanceSnapshot(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishSaveLearning, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = SaveReleaseLearningInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the learning proposal.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().saveLearning(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishReviewLearning, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ReviewReleaseLearningInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the learning review decision.'
        }
      })
    }
    return FinishActionResultSchema.parse(requireReleaseStore().reviewLearning(input.data))
  })

  ipcMain.handle(IPC_CHANNELS.finishCreateReleasePackage, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = CreateReleasePackageInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return FinishActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the final package selection.'
        }
      })
    }
    const result = requireReleaseStore().createReleasePackage(input.data)
    recordDiagnostic({
      level: result.ok ? 'info' : 'warning',
      area: 'export',
      eventName: result.ok ? 'release.package.locked' : 'release.package.refused',
      message: result.ok
        ? 'A hash-inventoried manual-upload package was locked locally.'
        : 'Release packaging was refused without changing a prior package.',
      context: {
        projectId: input.data.projectId,
        result: result.ok ? 'locked' : result.error.code
      }
    })
    return FinishActionResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.finishGetLocalMediaStatus, (event) => {
    assertTrustedSender(event)
    return LocalMediaRuntimeStatusSchema.parse(requireLocalProduction().getStatus())
  })

  ipcMain.handle(
    IPC_CHANNELS.finishInstallLocalMediaTools,
    async (event, unknownInput: unknown) => {
      assertTrustedSender(event)
      const input = InstallLocalMediaToolsInputSchema.parse(unknownInput)
      const result = await requireLocalProduction().installRuntime(input)
      recordDiagnostic({
        level: result.ok ? 'info' : 'warning',
        area: 'export',
        eventName: result.ok ? 'local-media.install.completed' : 'local-media.install.failed',
        message: result.ok
          ? 'The free local media tools passed their feature check.'
          : 'The free local media-tool setup did not pass verification.',
        context: { result: result.ok ? 'ready' : result.error.code }
      })
      return LocalMediaInstallResultSchema.parse(result)
    }
  )

  ipcMain.handle(IPC_CHANNELS.finishRenderTimeline, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = RenderTimelineInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return LocalMediaActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the master render settings.'
        }
      })
    }
    const result = await requireLocalProduction().renderTimeline(input.data)
    recordDiagnostic({
      level: result.ok ? 'info' : 'warning',
      area: 'export',
      eventName: result.ok ? 'timeline.render.completed' : 'timeline.render.refused',
      message: result.ok
        ? 'A deterministic local master candidate was created.'
        : 'The local master render stopped without replacing earlier media.',
      context: {
        projectId: input.data.projectId,
        result: result.ok ? 'candidate' : result.error.code
      }
    })
    return LocalMediaActionResultSchema.parse(result)
  })

  ipcMain.handle(IPC_CHANNELS.finishExportCaptions, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = ExportCaptionsInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return LocalMediaActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the caption export settings.'
        }
      })
    }
    return LocalMediaActionResultSchema.parse(
      await requireLocalProduction().exportCaptions(input.data)
    )
  })

  ipcMain.handle(IPC_CHANNELS.finishRenderThumbnail, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    const input = RenderThumbnailInputSchema.safeParse(unknownInput)
    if (!input.success) {
      return LocalMediaActionResultSchema.parse({
        ok: false,
        error: {
          code: 'invalid-input',
          message: input.error.issues[0]?.message ?? 'Check the thumbnail settings.'
        }
      })
    }
    return LocalMediaActionResultSchema.parse(
      await requireLocalProduction().renderThumbnail(input.data)
    )
  })

  ipcMain.handle(IPC_CHANNELS.upstreamChooseImport, async (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      requireStore().openProject(projectId)
      const options: OpenDialogOptions = {
        title: 'Choose the upstream story-package folder',
        buttonLabel: 'Check story package',
        properties: ['openDirectory']
      }
      const selection = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options)
      if (selection.canceled || !selection.filePaths[0]) {
        return UpstreamImportActionResultSchema.parse({
          ok: false,
          error: { code: 'cancelled', message: 'No story-package folder was selected.' }
        })
      }
      const result = await requireUpstreamAdapter().importFromFolder(
        projectId,
        selection.filePaths[0]
      )
      recordDiagnostic({
        level: result.ok && result.record.state !== 'validation-failed' ? 'info' : 'warning',
        area: 'production',
        eventName:
          result.ok && result.record.state !== 'validation-failed'
            ? 'production.upstream.previewed'
            : 'production.upstream.refused',
        message:
          result.ok && result.record.state !== 'validation-failed'
            ? 'A pinned upstream package was validated and normalized for review.'
            : 'An upstream package did not advance to an accepted production plan.',
        context: {
          projectId,
          result: result.ok ? result.record.state : result.error.code
        }
      })
      return UpstreamImportActionResultSchema.parse(result)
    } catch (error) {
      return UpstreamImportActionResultSchema.parse({
        ok: false,
        error: toUpstreamActionError(error)
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.upstreamListImports, (event, unknownProjectId: unknown) => {
    assertTrustedSender(event)
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return UpstreamImportRecordSchema.array().parse(
        requireUpstreamAdapter().listImports(projectId)
      )
    } catch {
      throw new Error('The upstream import history could not be read safely.')
    }
  })

  ipcMain.handle(IPC_CHANNELS.upstreamAcceptImport, (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = AcceptUpstreamImportInputSchema.parse(unknownInput)
      const result = requireUpstreamAdapter().acceptImport(input)
      recordDiagnostic({
        level: result.ok ? 'info' : 'warning',
        area: 'production',
        eventName: result.ok ? 'production.upstream.accepted' : 'production.upstream.accept-failed',
        message: result.ok
          ? 'A reviewed long-form normalization was accepted into the project.'
          : 'An upstream normalization acceptance was refused without changing the active plan.',
        context: {
          projectId: input.projectId,
          importId: input.importId,
          result: result.ok ? result.record.state : result.error.code
        }
      })
      return UpstreamImportActionResultSchema.parse(result)
    } catch (error) {
      return UpstreamImportActionResultSchema.parse({
        ok: false,
        error: toUpstreamActionError(error)
      })
    }
  })

  ipcMain.handle(IPC_CHANNELS.skillsGetStatus, async (event) => {
    assertTrustedSender(event)
    return ExternalSkillStatusSchema.parse(await requireSkillRegistry().getStatus())
  })

  ipcMain.handle(IPC_CHANNELS.skillsInstall, async (event) => {
    assertTrustedSender(event)
    try {
      const options: OpenDialogOptions = {
        title: 'Choose a declarative creative-skill package',
        buttonLabel: 'Review and install skill',
        properties: ['openFile'],
        filters: [{ name: 'Creative skill package', extensions: ['json'] }]
      }
      const selection = mainWindow
        ? await dialog.showOpenDialog(mainWindow, options)
        : await dialog.showOpenDialog(options)
      if (selection.canceled || !selection.filePaths[0]) {
        return ExternalSkillActionResultSchema.parse({
          ok: false,
          error: { code: 'cancelled', message: 'No skill package was selected.' }
        })
      }
      const status = await requireSkillRegistry().installFromFile(selection.filePaths[0])
      const installed = [...status.installed].sort((left, right) =>
        right.manifest.installedAt.localeCompare(left.manifest.installedAt)
      )[0]
      recordDiagnostic({
        level: 'info',
        area: 'skill',
        eventName: 'skill.installed',
        message: 'A declarative creative skill was installed without executing package code.',
        context: {
          skillId: installed?.manifest.skillId ?? 'unknown',
          version: installed?.manifest.version ?? 'unknown',
          enabledProjects: 0
        }
      })
      return ExternalSkillActionResultSchema.parse({ ok: true, status })
    } catch (error) {
      const result = ExternalSkillActionResultSchema.parse(toExternalSkillActionError(error))
      recordDiagnostic({
        level: 'warning',
        area: 'skill',
        eventName: 'skill.install.failed',
        message: 'A creative-skill package was rejected or could not be stored safely.',
        context: { errorCode: result.ok ? 'unknown' : result.error.code }
      })
      return result
    }
  })

  ipcMain.handle(IPC_CHANNELS.skillsSetProjectEnabled, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ExternalSkillSetProjectEnabledInputSchema.parse(unknownInput)
      requireStore().openProject(input.projectId)
      const status = await requireSkillRegistry().setProjectEnabled(input)
      recordDiagnostic({
        level: 'info',
        area: 'skill',
        eventName: input.enabled ? 'skill.project-enabled' : 'skill.project-disabled',
        message: input.enabled
          ? 'A creative skill was enabled for one project.'
          : 'A creative skill was disabled for one project.',
        context: { skillId: input.skillId, projectId: input.projectId }
      })
      return ExternalSkillActionResultSchema.parse({ ok: true, status })
    } catch (error) {
      return ExternalSkillActionResultSchema.parse(toExternalSkillActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.skillsRemove, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ExternalSkillRemoveInputSchema.parse(unknownInput)
      const status = await requireSkillRegistry().remove(input.skillId)
      recordDiagnostic({
        level: 'info',
        area: 'skill',
        eventName: 'skill.removed',
        message:
          'A creative skill was removed from the active registry. Historical receipts remain.',
        context: { skillId: input.skillId }
      })
      return ExternalSkillActionResultSchema.parse({ ok: true, status })
    } catch (error) {
      return ExternalSkillActionResultSchema.parse(toExternalSkillActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.skillsPreviewPlan, async (event, unknownInput: unknown) => {
    assertTrustedSender(event)
    try {
      const input = ExternalSkillPlanPreviewInputSchema.parse(unknownInput)
      return ExternalSkillPlanPreviewSchema.parse(
        await requireCreativeWriting().previewSkillPlan(input.projectId, input.taskKind)
      )
    } catch {
      throw new Error('The attached-skill plan could not be previewed safely.')
    }
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: 'Animated Series Studio',
    width: 1440,
    height: 920,
    minWidth: 1060,
    minHeight: 720,
    show: false,
    backgroundColor: '#11161f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && developmentUrl) {
    void mainWindow.loadURL(developmentUrl)
  } else {
    void mainWindow.loadURL('studio://app/index.html')
  }
}

void app
  .whenReady()
  .then(() => {
    if (!hasSingleInstanceLock) {
      return
    }

    Menu.setApplicationMenu(null)
    const userDataRoot = app.getPath('userData')
    const workspaceRoot = join(userDataRoot, 'projects')
    diagnostics = new SafeDiagnostics({
      logRoot: join(userDataRoot, 'logs'),
      bundleRoot: join(userDataRoot, 'support'),
      redactedPaths: [
        { path: workspaceRoot, label: '<PROJECTS>' },
        { path: userDataRoot, label: '<APP_DATA>' },
        { path: homedir(), label: '<USER_HOME>' },
        { path: process.cwd(), label: '<APPLICATION>' }
      ]
    })
    projectStore = new ProjectStore({
      workspaceRoot,
      backupRoot: join(userDataRoot, 'backups'),
      studioVersion: app.getVersion()
    })
    productionStore = new ProductionStore({ projectStore })
    releaseStore = new ReleaseStore({ projectStore, productionStore })
    localProductionService = new LocalProductionService({
      productionStore,
      releaseStore,
      bundledRuntimeRoot: app.isPackaged
        ? join(process.resourcesPath, 'media-tools')
        : join(process.cwd(), 'tools', 'media-tools')
    })
    try {
      const upstreamRoot = app.isPackaged
        ? join(process.resourcesPath, 'upstream')
        : join(process.cwd(), 'vendor', 'shuohao-skills')
      const runtimeManifestPath = app.isPackaged
        ? join(process.resourcesPath, 'upstream.runtime.json')
        : join(process.cwd(), 'config', 'upstream.runtime.json')
      upstreamAdapter = new UpstreamAdapter({
        projectStore,
        upstreamRoot,
        runtimeManifestPath,
        nodeExecutable: process.execPath,
        nodeEnvironment: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      })
    } catch (error) {
      upstreamAdapter = null
      recordDiagnostic({
        level: 'error',
        area: 'production',
        eventName: 'production.upstream.unavailable',
        message: 'The pinned upstream runtime failed its startup integrity check.',
        context: { errorCode: toUpstreamActionError(error).code }
      })
    }
    const secretProtector = {
      isEncryptionAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
      encryptString: (value: string) => safeStorage.encryptStringAsync(value),
      decryptString: (value: Buffer) => safeStorage.decryptStringAsync(value)
    }
    const developmentProductionPack = join(process.cwd(), 'config', 'workflow-pack.production.json')
    const packagedProductionPack = join(process.resourcesPath, 'workflow-pack.production.json')
    const workflowPackPath = app.isPackaged
      ? existsSync(packagedProductionPack)
        ? packagedProductionPack
        : join(process.resourcesPath, 'workflow-pack.candidate.json')
      : existsSync(developmentProductionPack)
        ? developmentProductionPack
        : join(process.cwd(), 'config', 'workflow-pack.candidate.json')
    const readinessReceiptPath = app.isPackaged
      ? join(process.resourcesPath, 'production-readiness.json')
      : join(process.cwd(), 'config', 'production-readiness.json')
    const productionReadiness = verifyProductionReadiness(workflowPackPath, readinessReceiptPath)
    const credentialVault = new EncryptedCredentialVault({
      filePath: join(userDataRoot, 'secure', 'runpod-api-key.bin'),
      protector: secretProtector
    })
    const runPodClient = new RunPodClient()
    cloudSetupService = new CloudSetupService({
      vault: credentialVault,
      provider: runPodClient,
      settingsStore: new CloudSettingsStore(join(userDataRoot, 'settings', 'cloud-setup.json')),
      productionReadiness: () => ({
        modelStorageReady: productionReadiness.modelStorageReady,
        workerImageReady: productionReadiness.workerImageReady,
        automaticShutdownTested: productionReadiness.automaticShutdownTested
      })
    })
    productionOrchestrator = new ProductionOrchestrator({
      workflowRegistry: new WorkflowRegistry(workflowPackPath),
      productionStore,
      cloud: cloudSetupService,
      runPodCredential: credentialVault,
      leaseTokenVault: new EncryptedSecretMapVault({
        filePath: join(userDataRoot, 'secure', 'worker-session-tokens.bin'),
        protector: secretProtector,
        maximumEntries: 12
      }),
      runPod: runPodClient
    })
    writingSetupService = new WritingSetupService({
      vaults: {
        openai: new EncryptedCredentialVault({
          filePath: join(userDataRoot, 'secure', 'openai-api-key.bin'),
          protector: secretProtector
        }),
        anthropic: new EncryptedCredentialVault({
          filePath: join(userDataRoot, 'secure', 'anthropic-api-key.bin'),
          protector: secretProtector
        }),
        gemini: new EncryptedCredentialVault({
          filePath: join(userDataRoot, 'secure', 'gemini-api-key.bin'),
          protector: secretProtector
        })
      },
      providers: {
        openai: new OpenAiClient(),
        anthropic: new AnthropicClient(),
        gemini: new GeminiClient()
      },
      settingsStore: new WritingSettingsStore(
        join(userDataRoot, 'settings', 'creative-writing.json')
      )
    })
    skillRegistry = new DeclarativeSkillRegistry({
      rootPath: join(userDataRoot, 'skills'),
      studioVersion: app.getVersion()
    })
    creativeWritingService = new CreativeWritingService({
      setup: writingSetupService,
      projectStore,
      skillPlanner: skillRegistry
    })
    recordDiagnostic({
      level: 'info',
      area: 'application',
      eventName: 'application.started',
      message: 'The local studio foundation started safely.',
      context: { appVersion: app.getVersion(), generationState: 'locked' }
    })

    registerStudioProtocol()
    registerIpcHandlers()
    createWindow()
    void reconcileActiveProductionJobs()
    recoveryTimer = setInterval(() => void reconcileActiveProductionJobs(), 15_000)
    recoveryTimer.unref()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error && error.message.includes('already open')
        ? error.message
        : 'The local project library could not be opened safely. No project or cloud resource was changed.'
    recordDiagnostic({
      level: 'error',
      area: 'application',
      eventName: 'application.start.failed',
      message
    })
    dialog.showErrorBox('Animated Series Studio could not open', message)
    app.quit()
  })

app.on('before-quit', () => {
  if (recoveryTimer) {
    clearInterval(recoveryTimer)
    recoveryTimer = null
  }
  if (!storeClosed) {
    projectStore?.close()
    storeClosed = true
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

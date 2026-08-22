import { randomUUID } from 'node:crypto'
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
  CloudActionResultSchema,
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGuardrailsSchema,
  CreateProjectInputSchema,
  ExternalSkillActionResultSchema,
  ExternalSkillPlanPreviewInputSchema,
  ExternalSkillPlanPreviewSchema,
  ExternalSkillRemoveInputSchema,
  ExternalSkillSetProjectEnabledInputSchema,
  ExternalSkillStatusSchema,
  IPC_CHANNELS,
  ProjectBackupSummarySchema,
  ProjectCreativeDirectionUpdateInputSchema,
  ProjectDetailsSchema,
  ProjectMigrationInputSchema,
  ProjectMigrationPreviewSchema,
  ProjectMigrationResultSchema,
  ProjectRestoreResultSchema,
  ProjectSummarySchema,
  RendererErrorInputSchema,
  SupportBundleSummarySchema,
  SystemStatusSchema,
  UlidSchema,
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
import { EncryptedCredentialVault } from '@studio/credential-vault'
import { ProjectStore } from '@studio/project-store'
import { AnthropicClient } from '@studio/provider-anthropic'
import { GeminiClient } from '@studio/provider-gemini'
import { OpenAiClient } from '@studio/provider-openai'
import { RunPodClient } from '@studio/provider-runpod'
import { DeclarativeSkillRegistry, toExternalSkillActionError } from '@studio/skill-runtime'
import { SafeDiagnostics, type DiagnosticEventInput } from '@studio/support-diagnostics'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'studio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
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
let skillRegistry: DeclarativeSkillRegistry | null = null
let diagnostics: SafeDiagnostics | null = null
let storeClosed = false

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

    try {
      const cloudStatus = await requireCloudSetup().getStatus()
      cloudGpuState =
        cloudStatus.connectionState === 'connected'
          ? 'account-connected'
          : cloudStatus.connectionState
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
      generationState: 'locked',
      generationReason:
        'Paid generation stays locked until the worker image, model storage, and independent shutdown guards pass a controlled test.'
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
      try {
        cloudConnectionState = (await requireCloudSetup().getStatus()).connectionState
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
          generationState: 'locked'
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
    const credentialVault = new EncryptedCredentialVault({
      filePath: join(userDataRoot, 'secure', 'runpod-api-key.bin'),
      protector: {
        isEncryptionAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
        encryptString: (value) => safeStorage.encryptStringAsync(value),
        decryptString: (value) => safeStorage.decryptStringAsync(value)
      }
    })
    cloudSetupService = new CloudSetupService({
      vault: credentialVault,
      provider: new RunPodClient(),
      settingsStore: new CloudSettingsStore(join(userDataRoot, 'settings', 'cloud-setup.json'))
    })
    const secretProtector = {
      isEncryptionAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
      encryptString: (value: string) => safeStorage.encryptStringAsync(value),
      decryptString: (value: Buffer) => safeStorage.decryptStringAsync(value)
    }
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

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
  type IpcMainInvokeEvent
} from 'electron'
import { ZodError } from 'zod'
import {
  CloudActionResultSchema,
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGuardrailsSchema,
  CreateProjectInputSchema,
  IPC_CHANNELS,
  ProjectBackupSummarySchema,
  ProjectDetailsSchema,
  ProjectRestoreResultSchema,
  ProjectSummarySchema,
  RendererErrorInputSchema,
  SupportBundleSummarySchema,
  SystemStatusSchema,
  UlidSchema
} from '@studio/contracts'
import { CloudSettingsStore, CloudSetupService, toCloudActionError } from '@studio/cloud-setup'
import { EncryptedCredentialVault } from '@studio/credential-vault'
import { ProjectStore } from '@studio/project-store'
import { RunPodClient } from '@studio/provider-runpod'
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

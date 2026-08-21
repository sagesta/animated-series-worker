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
  SystemStatusSchema,
  UlidSchema
} from '@studio/contracts'
import { CloudSettingsStore, CloudSetupService, toCloudActionError } from '@studio/cloud-setup'
import { EncryptedCredentialVault } from '@studio/credential-vault'
import { ProjectStore } from '@studio/project-store'
import { RunPodClient } from '@studio/provider-runpod'

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
      return ProjectDetailsSchema.parse(requireStore().createProject(input))
    } catch (error) {
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
    try {
      const projectId = UlidSchema.parse(unknownProjectId)
      return ProjectBackupSummarySchema.parse(await requireStore().createBackup(projectId))
    } catch {
      throw new Error(
        'The backup could not be completed and verified. The project itself was not changed.'
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.projectsRestore, async (event, unknownBackupId: unknown) => {
    assertTrustedSender(event)
    try {
      const backupId = UlidSchema.parse(unknownBackupId)
      return ProjectRestoreResultSchema.parse(await requireStore().restoreBackup(backupId))
    } catch {
      throw new Error(
        'The project could not be restored safely. Existing project files were not overwritten.'
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
      return CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().connect(input)
      })
    } catch (error) {
      return CloudActionResultSchema.parse(toCloudActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudRefresh, async (event) => {
    assertTrustedSender(event)
    try {
      return CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().refresh()
      })
    } catch (error) {
      return CloudActionResultSchema.parse(toCloudActionError(error))
    }
  })

  ipcMain.handle(IPC_CHANNELS.cloudDisconnect, async (event) => {
    assertTrustedSender(event)
    try {
      return CloudActionResultSchema.parse({
        ok: true,
        status: await requireCloudSetup().disconnect()
      })
    } catch (error) {
      return CloudActionResultSchema.parse(toCloudActionError(error))
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

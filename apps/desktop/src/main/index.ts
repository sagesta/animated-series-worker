import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, Menu, net, protocol, type IpcMainInvokeEvent } from 'electron'
import { ZodError } from 'zod'
import {
  CreateProjectInputSchema,
  IPC_CHANNELS,
  ProjectDetailsSchema,
  ProjectSummarySchema,
  SystemStatusSchema,
  UlidSchema
} from '@studio/contracts'
import { ProjectStore } from '@studio/project-store'

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

let mainWindow: BrowserWindow | null = null
let projectStore: ProjectStore | null = null
let storeClosed = false

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

function safeInputMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? 'Check the project details and try again.'
  }

  return 'The project could not be created safely. No existing project was changed.'
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.systemGetStatus, (event) => {
    assertTrustedSender(event)
    const store = requireStore()
    const indexedProjects = store.listProjects().length

    return SystemStatusSchema.parse({
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      storagePath: store.workspaceRoot,
      indexedProjects,
      catalogState: 'ready',
      cloudGpuState: 'not-configured',
      generationState: 'locked',
      generationReason:
        'Cloud setup stays locked until local projects, recovery, and spending safeguards are ready.'
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

void app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  const workspaceRoot = join(app.getPath('userData'), 'projects')
  projectStore = new ProjectStore({ workspaceRoot })

  registerStudioProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
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

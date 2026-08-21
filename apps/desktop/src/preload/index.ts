import { contextBridge, ipcRenderer } from 'electron'
import {
  CloudActionResultSchema,
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGuardrailsSchema,
  CreateProjectInputSchema,
  IPC_CHANNELS,
  ProjectBackupSummarySchema,
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
  type StudioApi
} from '@studio/contracts'

const studioApi: StudioApi = {
  system: {
    async getStatus() {
      return SystemStatusSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.systemGetStatus))
    }
  },
  projects: {
    async list() {
      return ProjectSummarySchema.array().parse(await ipcRenderer.invoke(IPC_CHANNELS.projectsList))
    },
    async create(input) {
      const safeInput = CreateProjectInputSchema.parse(input)
      return ProjectDetailsSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsCreate, safeInput)
      )
    },
    async open(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return ProjectDetailsSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsOpen, safeProjectId)
      )
    },
    async listBackups() {
      return ProjectBackupSummarySchema.array().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsListBackups)
      )
    },
    async backup(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return ProjectBackupSummarySchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsBackup, safeProjectId)
      )
    },
    async restore(backupId) {
      const safeBackupId = UlidSchema.parse(backupId)
      return ProjectRestoreResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsRestore, safeBackupId)
      )
    },
    async getMigrationPreview(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return ProjectMigrationPreviewSchema.nullable().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsGetMigrationPreview, safeProjectId)
      )
    },
    async migrate(input) {
      const safeInput = ProjectMigrationInputSchema.parse(input)
      return ProjectMigrationResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsMigrate, safeInput)
      )
    }
  },
  support: {
    async recordRendererError(input) {
      const safeInput = RendererErrorInputSchema.parse(input)
      await ipcRenderer.invoke(IPC_CHANNELS.supportRecordRendererError, safeInput)
    },
    async createBundle() {
      return SupportBundleSummarySchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.supportCreateBundle)
      )
    }
  },
  cloud: {
    async getStatus() {
      return CloudConnectionStatusSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.cloudGetStatus)
      )
    },
    async connect(input) {
      const safeInput = CloudConnectInputSchema.parse(input)
      return CloudActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.cloudConnect, safeInput)
      )
    },
    async refresh() {
      return CloudActionResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.cloudRefresh))
    },
    async disconnect() {
      return CloudActionResultSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.cloudDisconnect))
    },
    async saveGuardrails(guardrails) {
      const safeGuardrails = CloudGuardrailsSchema.parse(guardrails)
      return CloudActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.cloudSaveGuardrails, safeGuardrails)
      )
    }
  }
}

contextBridge.exposeInMainWorld('studio', studioApi)

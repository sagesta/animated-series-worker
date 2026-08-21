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
  WritingSettingsStatusSchema,
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
  },
  writing: {
    async getStatus() {
      return WritingSettingsStatusSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingGetStatus)
      )
    },
    async connect(input) {
      const safeInput = WritingConnectInputSchema.parse(input)
      return WritingSettingsActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingConnect, safeInput)
      )
    },
    async refresh(input) {
      const safeInput = WritingProviderInputSchema.parse(input)
      return WritingSettingsActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingRefresh, safeInput)
      )
    },
    async disconnect(input) {
      const safeInput = WritingProviderInputSchema.parse(input)
      return WritingSettingsActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingDisconnect, safeInput)
      )
    },
    async setEnabled(input) {
      const safeInput = WritingProviderEnabledInputSchema.parse(input)
      return WritingSettingsActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingSetEnabled, safeInput)
      )
    },
    async saveDefaultProfile(input) {
      const safeInput = WritingDefaultProfileSchema.parse(input)
      return WritingSettingsActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingSaveDefaultProfile, safeInput)
      )
    },
    async previewContext(input) {
      const safeInput = WritingContextPreviewInputSchema.parse(input)
      return WritingContextPreviewSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingPreviewContext, safeInput)
      )
    },
    async generateDraft(input) {
      const safeInput = WritingDraftRequestSchema.parse(input)
      return WritingDraftActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingGenerateDraft, safeInput)
      )
    },
    async listDrafts(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return WritingDraftRecordSchema.array().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.writingListDrafts, safeProjectId)
      )
    }
  }
}

contextBridge.exposeInMainWorld('studio', studioApi)

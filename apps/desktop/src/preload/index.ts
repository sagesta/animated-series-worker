import { contextBridge, ipcRenderer } from 'electron'
import {
  AcceptUpstreamImportInputSchema,
  CloudActionResultSchema,
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGuardrailsSchema,
  CanonActionResultSchema,
  ChooseMediaAssetInputSchema,
  CopyMediaAssetInputSchema,
  CreateAdaptationDatasetInputSchema,
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
  OpenReleasePackageInputSchema,
  OpenReleasePackageResultSchema,
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
  WritingSettingsStatusSchema,
  YouTubePerformanceReportPreviewSchema,
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
    async saveCreativeDirection(input) {
      const safeInput = ProjectCreativeDirectionUpdateInputSchema.parse(input)
      return ProjectDetailsSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.projectsSaveCreativeDirection, safeInput)
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
  },
  production: {
    async getWorkspace(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return ProductionWorkspaceSummarySchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionGetWorkspace, safeProjectId)
      )
    },
    async promoteDraft(input) {
      const safeInput = PromoteWritingDraftInputSchema.parse(input)
      return CanonActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionPromoteDraft, safeInput)
      )
    },
    async importMedia(input) {
      const safeInput = ChooseMediaAssetInputSchema.parse(input)
      return MediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionImportMedia, safeInput)
      )
    },
    async createAdaptationDataset(input) {
      const safeInput = CreateAdaptationDatasetInputSchema.parse(input)
      return MediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionCreateAdaptationDataset, safeInput)
      )
    },
    async copyMedia(input) {
      const safeInput = CopyMediaAssetInputSchema.parse(input)
      return MediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionCopyMedia, safeInput)
      )
    },
    async reviewMedia(input) {
      const safeInput = ReviewMediaAssetInputSchema.parse(input)
      return MediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionReviewMedia, safeInput)
      )
    },
    async planJob(input) {
      const safeInput = ProductionJobInputSchema.parse(input)
      return ProductionJobActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionPlanJob, safeInput)
      )
    },
    async approveJob(input) {
      const safeInput = ProductionJobApprovalInputSchema.parse(input)
      return ProductionJobActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionApproveJob, safeInput)
      )
    },
    async getJob(projectId, jobId) {
      const safeProjectId = UlidSchema.parse(projectId)
      const safeJobId = UlidSchema.parse(jobId)
      return ProductionJobDetailsSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionGetJob, safeProjectId, safeJobId)
      )
    },
    async listWorkflows() {
      return ProductionWorkflowSummarySchema.array().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionListWorkflows)
      )
    },
    async estimateWorkflow(input) {
      const safeInput = ProductionWorkflowEstimateInputSchema.parse(input)
      return ProductionWorkflowEstimateResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionEstimateWorkflow, safeInput)
      )
    },
    async queueJob(input) {
      const safeInput = ProductionQueueJobInputSchema.parse(input)
      return ProductionJobActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionQueueJob, safeInput)
      )
    },
    async cancelJob(input) {
      const safeInput = ProductionCancelJobInputSchema.parse(input)
      return ProductionJobActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionCancelJob, safeInput)
      )
    },
    async reconcileJob(projectId, jobId) {
      const safeProjectId = UlidSchema.parse(projectId)
      const safeJobId = UlidSchema.parse(jobId)
      return ProductionJobActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.productionReconcileJob, safeProjectId, safeJobId)
      )
    }
  },
  finish: {
    async getWorkspace(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return FinishWorkspaceSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishGetWorkspace, safeProjectId)
      )
    },
    async saveTimeline(input) {
      const safeInput = SaveProductionTimelineInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveTimeline, safeInput)
      )
    },
    async lockTimeline(input) {
      const safeInput = LockProductionTimelineInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishLockTimeline, safeInput)
      )
    },
    async saveReleaseDetails(input) {
      const safeInput = SaveReleaseDetailsInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveReleaseDetails, safeInput)
      )
    },
    async saveAttestations(input) {
      const safeInput = SaveReleaseAttestationsInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveAttestations, safeInput)
      )
    },
    async saveReleaseProfile(input) {
      const safeInput = SaveProjectReleaseProfileInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveReleaseProfile, safeInput)
      )
    },
    async saveIdea(input) {
      const safeInput = SaveReleaseIdeaInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveIdea, safeInput)
      )
    },
    async savePerformanceSnapshot(input) {
      const safeInput = SavePerformanceSnapshotInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSavePerformanceSnapshot, safeInput)
      )
    },
    async choosePerformanceReport() {
      return YouTubePerformanceReportPreviewSchema.nullable().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishChoosePerformanceReport)
      )
    },
    async saveLearning(input) {
      const safeInput = SaveReleaseLearningInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishSaveLearning, safeInput)
      )
    },
    async reviewLearning(input) {
      const safeInput = ReviewReleaseLearningInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishReviewLearning, safeInput)
      )
    },
    async createReleasePackage(input) {
      const safeInput = CreateReleasePackageInputSchema.parse(input)
      return FinishActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishCreateReleasePackage, safeInput)
      )
    },
    async openReleasePackage(input) {
      const safeInput = OpenReleasePackageInputSchema.parse(input)
      return OpenReleasePackageResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishOpenReleasePackage, safeInput)
      )
    },
    async getLocalMediaStatus() {
      return LocalMediaRuntimeStatusSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishGetLocalMediaStatus)
      )
    },
    async installLocalMediaTools(input) {
      const safeInput = InstallLocalMediaToolsInputSchema.parse(input)
      return LocalMediaInstallResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishInstallLocalMediaTools, safeInput)
      )
    },
    async renderTimeline(input) {
      const safeInput = RenderTimelineInputSchema.parse(input)
      return LocalMediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishRenderTimeline, safeInput)
      )
    },
    async exportCaptions(input) {
      const safeInput = ExportCaptionsInputSchema.parse(input)
      return LocalMediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishExportCaptions, safeInput)
      )
    },
    async renderThumbnail(input) {
      const safeInput = RenderThumbnailInputSchema.parse(input)
      return LocalMediaActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.finishRenderThumbnail, safeInput)
      )
    }
  },
  upstream: {
    async chooseImport(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return UpstreamImportActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.upstreamChooseImport, safeProjectId)
      )
    },
    async listImports(projectId) {
      const safeProjectId = UlidSchema.parse(projectId)
      return UpstreamImportRecordSchema.array().parse(
        await ipcRenderer.invoke(IPC_CHANNELS.upstreamListImports, safeProjectId)
      )
    },
    async acceptImport(input) {
      const safeInput = AcceptUpstreamImportInputSchema.parse(input)
      return UpstreamImportActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.upstreamAcceptImport, safeInput)
      )
    }
  },
  skills: {
    async getStatus() {
      return ExternalSkillStatusSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.skillsGetStatus))
    },
    async install() {
      return ExternalSkillActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.skillsInstall)
      )
    },
    async setProjectEnabled(input) {
      const safeInput = ExternalSkillSetProjectEnabledInputSchema.parse(input)
      return ExternalSkillActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.skillsSetProjectEnabled, safeInput)
      )
    },
    async remove(input) {
      const safeInput = ExternalSkillRemoveInputSchema.parse(input)
      return ExternalSkillActionResultSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.skillsRemove, safeInput)
      )
    },
    async previewPlan(input) {
      const safeInput = ExternalSkillPlanPreviewInputSchema.parse(input)
      return ExternalSkillPlanPreviewSchema.parse(
        await ipcRenderer.invoke(IPC_CHANNELS.skillsPreviewPlan, safeInput)
      )
    }
  }
}

contextBridge.exposeInMainWorld('studio', studioApi)

import { contextBridge, ipcRenderer } from 'electron'
import {
  CreateProjectInputSchema,
  IPC_CHANNELS,
  ProjectDetailsSchema,
  ProjectSummarySchema,
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
    }
  }
}

contextBridge.exposeInMainWorld('studio', studioApi)

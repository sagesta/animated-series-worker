import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z, ZodError } from 'zod'
import {
  CloudConnectInputSchema,
  CloudConnectionStatusSchema,
  CloudGpuOptionSchema,
  CloudGuardrailsSchema,
  DEFAULT_CLOUD_GUARDRAILS,
  type CloudActionResult,
  type CloudConnectionStatus,
  type CloudErrorCode,
  type CloudGpuOption
} from '@studio/contracts'
import { CredentialVaultError } from '@studio/credential-vault'
import { RunPodConnectionError, type RunPodAccountCheck } from '@studio/provider-runpod'

const CloudSettingsRecordSchema = z
  .object({
    schemaVersion: z.literal(1),
    provider: z.literal('runpod'),
    guardrails: CloudGuardrailsSchema,
    guardrailsSaved: z.boolean(),
    account: z
      .object({
        checkedAt: z.string().datetime({ offset: true }),
        totalPods: z.number().int().nonnegative(),
        activePods: z.number().int().nonnegative(),
        activeHourlyCostUsd: z.number().nonnegative()
      })
      .strict()
      .nullable(),
    gpuCatalogCheckedAt: z.string().datetime({ offset: true }).nullable(),
    gpuOptions: CloudGpuOptionSchema.array().max(12),
    catalogMessage: z.string().nullable()
  })
  .strict()

type CloudSettingsRecord = z.infer<typeof CloudSettingsRecordSchema>

export interface CloudCredentialVault {
  hasSecret(): Promise<boolean>
  storeSecret(secret: string): Promise<void>
  readSecret(): Promise<string>
  removeSecret(): Promise<void>
}

export interface CloudProvider {
  validateAccount(apiKey: string): Promise<RunPodAccountCheck>
  listGpuOptions(apiKey: string): Promise<CloudGpuOption[]>
}

export interface CloudSetupServiceOptions {
  vault: CloudCredentialVault
  provider: CloudProvider
  settingsStore: CloudSettingsStore
  productionReadiness?: () => ProductionReadiness
  now?: () => Date
}

export interface ProductionReadiness {
  modelStorageReady: boolean
  workerImageReady: boolean
  automaticShutdownTested: boolean
}

const NOT_READY: ProductionReadiness = Object.freeze({
  modelStorageReady: false,
  workerImageReady: false,
  automaticShutdownTested: false
})

export class CloudSetupError extends Error {
  readonly code: 'settings-error' | 'not-connected'

  constructor(code: 'settings-error' | 'not-connected', message: string) {
    super(message)
    this.name = 'CloudSetupError'
    this.code = code
  }
}

function defaultRecord(): CloudSettingsRecord {
  return {
    schemaVersion: 1,
    provider: 'runpod',
    guardrails: { ...DEFAULT_CLOUD_GUARDRAILS },
    guardrailsSaved: false,
    account: null,
    gpuCatalogCheckedAt: null,
    gpuOptions: [],
    catalogMessage: null
  }
}

async function atomicWriteJson(filePath: string, value: CloudSettingsRecord): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await mkdir(dirname(filePath), { recursive: true })

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    })
    await rename(temporaryPath, filePath)
  } catch (error) {
    try {
      await unlink(temporaryPath)
    } catch {
      // The temporary file may not have been created.
    }
    throw error
  }
}

export class CloudSettingsStore {
  readonly filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<CloudSettingsRecord> {
    try {
      return CloudSettingsRecordSchema.parse(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultRecord()
      }
      throw new CloudSetupError(
        'settings-error',
        'The local cloud settings need repair. No paid action was started.'
      )
    }
  }

  async save(record: CloudSettingsRecord): Promise<void> {
    try {
      await atomicWriteJson(this.filePath, CloudSettingsRecordSchema.parse(record))
    } catch (error) {
      if (error instanceof CloudSetupError) {
        throw error
      }
      throw new CloudSetupError(
        'settings-error',
        'The cloud settings could not be saved. No paid action was started.'
      )
    }
  }
}

function catalogFailureMessage(error: unknown): string {
  if (error instanceof RunPodConnectionError && error.code === 'insufficient-permissions') {
    return 'Connected, but this key cannot read the current GPU price catalogue.'
  }
  return 'Connected, but current GPU prices could not be checked. Refresh later.'
}

function statusFrom(
  record: CloudSettingsRecord,
  credentialStored: boolean,
  readiness: ProductionReadiness
): CloudConnectionStatus {
  const connected = credentialStored && record.account !== null
  const connectionState = connected
    ? 'connected'
    : credentialStored
      ? 'attention'
      : 'not-configured'
  const generationReady =
    connected &&
    record.guardrailsSaved &&
    readiness.modelStorageReady &&
    readiness.workerImageReady &&
    readiness.automaticShutdownTested
  const missingReadiness: string[] = []
  if (!readiness.modelStorageReady) missingReadiness.push('verified model storage')
  if (!readiness.workerImageReady) missingReadiness.push('the pinned worker image')
  if (!readiness.automaticShutdownTested) missingReadiness.push('the automatic shutdown test')
  const generationReason = generationReady
    ? 'Production checks are complete. Each paid job still requires its own cost approval and a separate worker-start confirmation.'
    : !connected
      ? credentialStored
        ? 'A protected key exists, but the account check is incomplete. Refresh or reconnect RunPod.'
        : 'Connect RunPod with a no-cost account check. Connecting never rents a GPU.'
      : !record.guardrailsSaved
        ? 'RunPod is connected. Save the spending and shutdown limits before paid generation can start.'
        : `RunPod is connected. Paid generation stays locked until ${missingReadiness.join(', ')} ${missingReadiness.length === 1 ? 'is' : 'are'} proven.`

  return CloudConnectionStatusSchema.parse({
    provider: 'runpod',
    connectionState,
    credentialStored,
    guardrails: record.guardrails,
    guardrailsSaved: record.guardrailsSaved,
    account: connected ? record.account : null,
    gpuCatalogCheckedAt: connected ? record.gpuCatalogCheckedAt : null,
    gpuOptions: connected ? record.gpuOptions : [],
    catalogMessage: connected ? record.catalogMessage : null,
    validationCostUsd: 0,
    setupChecklist: {
      accountConnected: connected,
      guardrailsSaved: record.guardrailsSaved,
      modelStorageReady: readiness.modelStorageReady,
      workerImageReady: readiness.workerImageReady,
      automaticShutdownTested: readiness.automaticShutdownTested
    },
    generationState: generationReady ? 'ready' : 'locked',
    generationReason
  })
}

export class CloudSetupService {
  private readonly vault: CloudCredentialVault
  private readonly provider: CloudProvider
  private readonly settingsStore: CloudSettingsStore
  private readonly productionReadiness: () => ProductionReadiness
  private readonly now: () => Date

  constructor(options: CloudSetupServiceOptions) {
    this.vault = options.vault
    this.provider = options.provider
    this.settingsStore = options.settingsStore
    this.productionReadiness = options.productionReadiness ?? (() => NOT_READY)
    this.now = options.now ?? (() => new Date())
  }

  async getStatus(): Promise<CloudConnectionStatus> {
    const [record, credentialStored] = await Promise.all([
      this.settingsStore.load(),
      this.vault.hasSecret()
    ])
    return statusFrom(record, credentialStored, this.productionReadiness())
  }

  async connect(input: unknown): Promise<CloudConnectionStatus> {
    const { apiKey } = CloudConnectInputSchema.parse(input)
    const account = await this.provider.validateAccount(apiKey)
    const checkedAt = this.now().toISOString()
    const record = await this.settingsStore.load()
    let gpuOptions: CloudGpuOption[] = []
    let gpuCatalogCheckedAt: string | null = null
    let catalogMessage: string | null = null

    try {
      gpuOptions = CloudGpuOptionSchema.array()
        .max(12)
        .parse(await this.provider.listGpuOptions(apiKey))
      gpuCatalogCheckedAt = checkedAt
    } catch (error) {
      catalogMessage = catalogFailureMessage(error)
    }

    await this.vault.storeSecret(apiKey)
    await this.settingsStore.save({
      ...record,
      account: { checkedAt, ...account },
      gpuCatalogCheckedAt,
      gpuOptions,
      catalogMessage
    })

    return this.getStatus()
  }

  async refresh(): Promise<CloudConnectionStatus> {
    if (!(await this.vault.hasSecret())) {
      throw new CloudSetupError('not-connected', 'Connect RunPod before refreshing the account.')
    }

    const apiKey = await this.vault.readSecret()
    return this.connect({ apiKey })
  }

  async disconnect(): Promise<CloudConnectionStatus> {
    await this.vault.removeSecret()
    const record = await this.settingsStore.load()
    await this.settingsStore.save({
      ...record,
      account: null,
      gpuCatalogCheckedAt: null,
      gpuOptions: [],
      catalogMessage: null
    })
    return this.getStatus()
  }

  async saveGuardrails(guardrails: unknown): Promise<CloudConnectionStatus> {
    const safeGuardrails = CloudGuardrailsSchema.parse(guardrails)
    const record = await this.settingsStore.load()
    await this.settingsStore.save({
      ...record,
      guardrails: safeGuardrails,
      guardrailsSaved: true
    })
    return this.getStatus()
  }
}

export function toCloudActionError(error: unknown): Extract<CloudActionResult, { ok: false }> {
  if (error instanceof RunPodConnectionError) {
    return { ok: false, error: { code: error.code, message: error.message } }
  }
  if (error instanceof CredentialVaultError) {
    const code: CloudErrorCode =
      error.code === 'unavailable' ? 'secure-storage-unavailable' : 'secure-storage-error'
    return { ok: false, error: { code, message: error.message } }
  }
  if (error instanceof CloudSetupError) {
    return { ok: false, error: { code: error.code, message: error.message } }
  }
  if (error instanceof ZodError) {
    return {
      ok: false,
      error: {
        code: 'invalid-input',
        message: error.issues[0]?.message ?? 'Check the cloud setup details and try again.'
      }
    }
  }

  return {
    ok: false,
    error: {
      code: 'unknown',
      message: 'The cloud setup could not be completed safely. No paid action was started.'
    }
  }
}

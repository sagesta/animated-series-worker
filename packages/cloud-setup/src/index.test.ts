import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CloudGpuOption } from '@studio/contracts'
import {
  CloudSettingsStore,
  CloudSetupService,
  type CloudCredentialVault,
  type CloudProvider
} from './index'

const temporaryDirectories: string[] = []

async function temporarySettingsPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'studio-cloud-'))
  temporaryDirectories.push(directory)
  return join(directory, 'cloud-setup.json')
}

class MemoryVault implements CloudCredentialVault {
  secret: string | undefined

  async hasSecret(): Promise<boolean> {
    return this.secret !== undefined
  }

  async storeSecret(secret: string): Promise<void> {
    this.secret = secret
  }

  async readSecret(): Promise<string> {
    if (!this.secret) throw new Error('missing')
    return this.secret
  }

  async removeSecret(): Promise<void> {
    this.secret = undefined
  }
}

const gpuOption: CloudGpuOption = {
  id: 'NVIDIA A100-SXM4-80GB',
  name: 'A100 SXM',
  memoryGb: 80,
  secureHourlyUsd: 1.89,
  communityHourlyUsd: 1.39,
  ltxCompatibility: 'meets-baseline'
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('cloud setup service', () => {
  it('validates before storing and keeps the API key out of local settings', async () => {
    const settingsPath = await temporarySettingsPath()
    const vault = new MemoryVault()
    const provider: CloudProvider = {
      validateAccount: vi.fn().mockResolvedValue({
        totalPods: 2,
        activePods: 1,
        activeHourlyCostUsd: 0.74
      }),
      listGpuOptions: vi.fn().mockResolvedValue([gpuOption])
    }
    const service = new CloudSetupService({
      vault,
      provider,
      settingsStore: new CloudSettingsStore(settingsPath),
      now: () => new Date('2026-08-21T18:00:00.000Z')
    })
    const apiKey = 'rpa_valid_secret_value_123456789'

    const status = await service.connect({ apiKey })

    expect(status.connectionState).toBe('connected')
    expect(status.account).toMatchObject({ activePods: 1, activeHourlyCostUsd: 0.74 })
    expect(status.validationCostUsd).toBe(0)
    expect(vault.secret).toBe(apiKey)
    expect(await readFile(settingsPath, 'utf8')).not.toContain(apiKey)
  })

  it('saves conservative limits separately and keeps generation locked', async () => {
    const settingsPath = await temporarySettingsPath()
    const vault = new MemoryVault()
    const provider: CloudProvider = {
      validateAccount: vi.fn(),
      listGpuOptions: vi.fn()
    }
    const service = new CloudSetupService({
      vault,
      provider,
      settingsStore: new CloudSettingsStore(settingsPath)
    })

    const status = await service.saveGuardrails({
      maxSessionCostUsd: 12,
      maxRuntimeMinutes: 180,
      idleTimeoutMinutes: 8,
      maxConcurrentGpus: 2
    })

    expect(status.guardrailsSaved).toBe(true)
    expect(status.guardrails).toMatchObject({ maxSessionCostUsd: 12, maxConcurrentGpus: 2 })
    expect(status.generationState).toBe('locked')
  })

  it('removes only the cloud credential and retains saved safety defaults', async () => {
    const settingsPath = await temporarySettingsPath()
    const vault = new MemoryVault()
    const provider: CloudProvider = {
      validateAccount: vi.fn().mockResolvedValue({
        totalPods: 0,
        activePods: 0,
        activeHourlyCostUsd: 0
      }),
      listGpuOptions: vi.fn().mockResolvedValue([gpuOption])
    }
    const service = new CloudSetupService({
      vault,
      provider,
      settingsStore: new CloudSettingsStore(settingsPath)
    })
    await service.saveGuardrails({
      maxSessionCostUsd: 10,
      maxRuntimeMinutes: 120,
      idleTimeoutMinutes: 10,
      maxConcurrentGpus: 1
    })
    await service.connect({ apiKey: 'rpa_valid_secret_value_123456789' })

    const status = await service.disconnect()

    expect(status.connectionState).toBe('not-configured')
    expect(status.guardrailsSaved).toBe(true)
    expect(await vault.hasSecret()).toBe(false)
  })
})

import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DecryptedSecret {
  result: string
  shouldReEncrypt: boolean
}

export interface SecretProtector {
  isEncryptionAvailable(): Promise<boolean>
  encryptString(value: string): Promise<Buffer>
  decryptString(value: Buffer): Promise<DecryptedSecret>
}

export type CredentialVaultErrorCode =
  'unavailable' | 'read-failed' | 'write-failed' | 'remove-failed'

export class CredentialVaultError extends Error {
  readonly code: CredentialVaultErrorCode

  constructor(code: CredentialVaultErrorCode, message: string) {
    super(message)
    this.name = 'CredentialVaultError'
    this.code = code
  }
}

export interface EncryptedCredentialVaultOptions {
  filePath: string
  protector: SecretProtector
}

export interface EncryptedSecretMapVaultOptions {
  filePath: string
  protector: SecretProtector
  maximumEntries?: number
}

const MAX_ENCRYPTED_SECRET_BYTES = 64 * 1024

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function atomicWrite(filePath: string, contents: Buffer): Promise<void> {
  const directory = dirname(filePath)
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await mkdir(directory, { recursive: true, mode: 0o700 })

  try {
    await writeFile(temporaryPath, contents, { flag: 'wx', mode: 0o600 })
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

export class EncryptedCredentialVault {
  readonly filePath: string
  private readonly protector: SecretProtector

  constructor(options: EncryptedCredentialVaultOptions) {
    this.filePath = options.filePath
    this.protector = options.protector
  }

  async hasSecret(): Promise<boolean> {
    return pathExists(this.filePath)
  }

  async storeSecret(secret: string): Promise<void> {
    if (!(await this.protector.isEncryptionAvailable())) {
      throw new CredentialVaultError(
        'unavailable',
        'Windows secure storage is not available. The API key was not saved.'
      )
    }

    try {
      const encrypted = await this.protector.encryptString(secret)
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SECRET_BYTES) {
        throw new Error('Encrypted credential size is invalid.')
      }
      await atomicWrite(this.filePath, encrypted)
    } catch (error) {
      if (error instanceof CredentialVaultError) {
        throw error
      }
      throw new CredentialVaultError(
        'write-failed',
        'Windows could not protect and save the API key. The key was not stored.'
      )
    }
  }

  async readSecret(): Promise<string> {
    if (!(await this.protector.isEncryptionAvailable())) {
      throw new CredentialVaultError(
        'unavailable',
        'Windows secure storage is temporarily unavailable.'
      )
    }

    try {
      const encrypted = await readFile(this.filePath)
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SECRET_BYTES) {
        throw new Error('Encrypted credential size is invalid.')
      }

      let decrypted = await this.protector.decryptString(encrypted)
      if (decrypted.shouldReEncrypt) {
        decrypted = await this.protector.decryptString(encrypted)
        const refreshedEncryption = await this.protector.encryptString(decrypted.result)
        await atomicWrite(this.filePath, refreshedEncryption)
      }

      return decrypted.result
    } catch (error) {
      if (error instanceof CredentialVaultError) {
        throw error
      }
      throw new CredentialVaultError(
        'read-failed',
        'The saved API key could not be unlocked. Reconnect this service with a fresh key.'
      )
    }
  }

  async removeSecret(): Promise<void> {
    try {
      await unlink(this.filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      throw new CredentialVaultError(
        'remove-failed',
        'The saved API key could not be removed safely.'
      )
    }
  }
}

export class EncryptedSecretMapVault {
  readonly filePath: string
  private readonly protector: SecretProtector
  private readonly maximumEntries: number

  constructor(options: EncryptedSecretMapVaultOptions) {
    this.filePath = options.filePath
    this.protector = options.protector
    this.maximumEntries = options.maximumEntries ?? 20
  }

  async listKeys(): Promise<string[]> {
    return Object.keys(await this.readMap()).sort()
  }

  async hasSecret(key: string): Promise<boolean> {
    return key in (await this.readMap())
  }

  async storeSecret(key: string, secret: string): Promise<void> {
    const safeKey = this.validateKey(key)
    const safeSecret = this.validateSecret(secret)
    const values = await this.readMap()
    if (!(safeKey in values) && Object.keys(values).length >= this.maximumEntries) {
      throw new CredentialVaultError(
        'write-failed',
        'The protected worker-session store is full. Finish or remove an old session first.'
      )
    }
    values[safeKey] = safeSecret
    await this.writeMap(values)
  }

  async readSecret(key: string): Promise<string> {
    const values = await this.readMap()
    const value = values[this.validateKey(key)]
    if (!value) {
      throw new CredentialVaultError(
        'read-failed',
        'The protected worker-session token could not be found. Reconcile or terminate the worker.'
      )
    }
    return value
  }

  async removeSecret(key: string): Promise<void> {
    const values = await this.readMap()
    delete values[this.validateKey(key)]
    if (Object.keys(values).length === 0) {
      try {
        await unlink(this.filePath)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new CredentialVaultError(
            'remove-failed',
            'The protected worker-session token could not be removed safely.'
          )
        }
      }
      return
    }
    await this.writeMap(values)
  }

  private async readMap(): Promise<Record<string, string>> {
    if (!(await pathExists(this.filePath))) return {}
    if (!(await this.protector.isEncryptionAvailable())) {
      throw new CredentialVaultError(
        'unavailable',
        'Windows secure storage is temporarily unavailable.'
      )
    }
    try {
      const encrypted = await readFile(this.filePath)
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SECRET_BYTES) {
        throw new Error('Encrypted worker-session store size is invalid.')
      }
      const decrypted = await this.protector.decryptString(encrypted)
      const parsed: unknown = JSON.parse(decrypted.result)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
        throw new Error('Invalid map.')
      const values: Record<string, string> = {}
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        values[this.validateKey(key)] = this.validateSecret(value)
      }
      if (decrypted.shouldReEncrypt) await this.writeMap(values)
      return values
    } catch (error) {
      if (error instanceof CredentialVaultError) throw error
      throw new CredentialVaultError(
        'read-failed',
        'The protected worker-session store could not be unlocked. Reconcile active Pods in RunPod.'
      )
    }
  }

  private async writeMap(values: Record<string, string>): Promise<void> {
    if (!(await this.protector.isEncryptionAvailable())) {
      throw new CredentialVaultError(
        'unavailable',
        'Windows secure storage is not available. The worker was not started.'
      )
    }
    try {
      const encrypted = await this.protector.encryptString(JSON.stringify(values))
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SECRET_BYTES) {
        throw new Error('Encrypted worker-session store size is invalid.')
      }
      await atomicWrite(this.filePath, encrypted)
    } catch (error) {
      if (error instanceof CredentialVaultError) throw error
      throw new CredentialVaultError(
        'write-failed',
        'Windows could not protect the worker-session token. The worker was not started.'
      )
    }
  }

  private validateKey(value: unknown): string {
    if (typeof value !== 'string' || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
      throw new CredentialVaultError('read-failed', 'A worker-session identity is invalid.')
    }
    return value
  }

  private validateSecret(value: unknown): string {
    if (typeof value !== 'string' || value.length < 32 || value.length > 200) {
      throw new CredentialVaultError('read-failed', 'A protected worker-session token is invalid.')
    }
    return value
  }
}

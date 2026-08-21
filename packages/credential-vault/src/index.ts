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

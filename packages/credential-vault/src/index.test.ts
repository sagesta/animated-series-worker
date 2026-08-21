import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { CredentialVaultError, EncryptedCredentialVault, type SecretProtector } from './index'

const temporaryDirectories: string[] = []

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'studio-vault-'))
  temporaryDirectories.push(directory)
  return directory
}

function createProtector(available = true): SecretProtector {
  return {
    async isEncryptionAvailable() {
      return available
    },
    async encryptString(value) {
      return Buffer.from(Buffer.from(value, 'utf8').toString('base64').split('').reverse().join(''))
    },
    async decryptString(value) {
      const encoded = value.toString('utf8').split('').reverse().join('')
      return {
        result: Buffer.from(encoded, 'base64').toString('utf8'),
        shouldReEncrypt: false
      }
    }
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('encrypted credential vault', () => {
  it('stores no plaintext secret and can replace and read it', async () => {
    const directory = await createTemporaryDirectory()
    const filePath = join(directory, 'secure', 'runpod.bin')
    const vault = new EncryptedCredentialVault({ filePath, protector: createProtector() })

    await vault.storeSecret('rpa_first_secret_value_123456')
    expect((await readFile(filePath)).includes(Buffer.from('rpa_first_secret_value_123456'))).toBe(
      false
    )
    expect(await vault.readSecret()).toBe('rpa_first_secret_value_123456')

    await vault.storeSecret('rpa_replacement_secret_987654')
    expect(await vault.readSecret()).toBe('rpa_replacement_secret_987654')
  })

  it('removes the encrypted credential without affecting other files', async () => {
    const directory = await createTemporaryDirectory()
    const vault = new EncryptedCredentialVault({
      filePath: join(directory, 'runpod.bin'),
      protector: createProtector()
    })

    await vault.storeSecret('rpa_secret_value_for_removal')
    expect(await vault.hasSecret()).toBe(true)
    await vault.removeSecret()
    expect(await vault.hasSecret()).toBe(false)
  })

  it('fails closed when operating-system encryption is unavailable', async () => {
    const directory = await createTemporaryDirectory()
    const vault = new EncryptedCredentialVault({
      filePath: join(directory, 'runpod.bin'),
      protector: createProtector(false)
    })

    await expect(vault.storeSecret('rpa_secret_value_not_saved')).rejects.toMatchObject({
      code: 'unavailable'
    } satisfies Partial<CredentialVaultError>)
    expect(await vault.hasSecret()).toBe(false)
  })
})

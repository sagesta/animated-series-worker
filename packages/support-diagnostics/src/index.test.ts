import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SafeDiagnostics, redactSupportText } from './index'

const roots: string[] = []

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studio-diagnostics-test-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('SafeDiagnostics', () => {
  it('redacts provider keys, bearer credentials, protected fields, and private paths', async () => {
    const root = createRoot()
    const privatePath = join(root, 'projects', 'secret-show')
    const diagnostics = new SafeDiagnostics({
      logRoot: join(root, 'logs'),
      bundleRoot: join(root, 'support'),
      redactedPaths: [{ path: root, label: '<APP_DATA>' }]
    })

    await diagnostics.record({
      level: 'error',
      area: 'cloud',
      eventName: 'cloud.connection.failed',
      message:
        'Keys rpa_1234567890abcdefghijklmnopqrstuvwxyz, sk-ant-api03-abcdefghijklmnopqrstuvwxyz, and AIzaSyExampleGeminiKey1234567890 failed with Bearer abcdefghijklmnop at ' +
        privatePath,
      context: {
        apiKey: 'totally-unknown-secret-format',
        projectPath: privatePath,
        retryable: false
      }
    })

    const summary = await diagnostics.createBundle({
      appVersion: 'test',
      electronVersion: 'test',
      nodeVersion: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      projectCount: 1,
      catalogState: 'ready',
      cloudConnectionState: 'attention',
      generationState: 'locked'
    })
    const bundleText = readFileSync(summary.bundlePath, 'utf8')
    const logText = readFileSync(diagnostics.logPath, 'utf8')

    expect(summary.redactionState).toBe('passed')
    expect(summary.eventCount).toBe(1)
    expect(bundleText).not.toContain('rpa_1234567890')
    expect(bundleText).not.toContain('sk-ant-api03')
    expect(bundleText).not.toContain('AIzaSyExampleGeminiKey')
    expect(bundleText).not.toContain('abcdefghijklmnop')
    expect(bundleText).not.toContain('totally-unknown-secret-format')
    expect(bundleText).not.toContain(root)
    expect(bundleText).toContain('[REDACTED_SECRET]')
    expect(bundleText).toContain('<APP_DATA>')
    expect(logText).not.toContain('totally-unknown-secret-format')
    expect(logText).not.toContain(root)
  })

  it('keeps harmless operational context readable', () => {
    expect(redactSupportText('Backup verified: 14 files, $0 spend.')).toBe(
      'Backup verified: 14 files, $0 spend.'
    )
  })
})

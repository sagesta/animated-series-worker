import { randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs'
import { open, readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  SupportBundleSummarySchema,
  SupportEventSchema,
  type SupportBundleSummary,
  type SupportEvent
} from '@studio/contracts'

const MAX_EVENTS_IN_BUNDLE = 2_000
const MAX_LOG_FILES_IN_BUNDLE = 8

const SECRET_KEY_PATTERN =
  /^(?:api[-_]?key|authorization|password|secret|client[-_]?secret|access[-_]?token|refresh[-_]?token|credential|cookie)$/i

const SECRET_VALUE_PATTERNS = [
  /\brpa_[a-z0-9_-]{12,}\b/gi,
  /\bsk-ant-[a-z0-9_-]{12,}\b/gi,
  /\bsk-(?:proj-)?[a-z0-9_-]{16,}\b/gi,
  /\bAIza[a-z0-9_-]{20,}\b/gi,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}\b/gi,
  /\b(?:api[-_]?key|password|secret|access[-_]?token|refresh[-_]?token)\s*[:=]\s*["']?[^\s"',}]{6,}/gi
]

export interface PathReplacement {
  path: string
  label: string
}

export interface SafeDiagnosticsOptions {
  logRoot: string
  bundleRoot: string
  redactedPaths?: PathReplacement[]
}

export interface DiagnosticEventInput {
  correlationId?: string
  level: SupportEvent['level']
  area: SupportEvent['area']
  eventName: string
  message: string
  context?: Record<string, unknown>
}

export interface SupportSnapshot {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  platform: string
  architecture: string
  projectCount: number
  catalogState: string
  cloudConnectionState: string
  generationState: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`
}

function replaceKnownSecrets(value: string): string {
  return SECRET_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[REDACTED_SECRET]'),
    value
  )
}

export function redactSupportText(
  value: string,
  pathReplacements: readonly PathReplacement[] = []
): string {
  let redacted = replaceKnownSecrets(value)
  const orderedReplacements = [...pathReplacements]
    .filter((replacement) => replacement.path.length > 2)
    .sort((left, right) => right.path.length - left.path.length)

  for (const replacement of orderedReplacements) {
    const pathVariants = new Set([
      resolve(replacement.path),
      resolve(replacement.path).replaceAll('\\', '/'),
      resolve(replacement.path).replaceAll('/', '\\')
    ])
    for (const pathVariant of pathVariants) {
      redacted = redacted.replace(
        new RegExp(escapeRegExp(pathVariant), process.platform === 'win32' ? 'gi' : 'g'),
        () => replacement.label
      )
    }
  }

  return redacted
}

function sanitizeContext(
  context: Record<string, unknown>,
  pathReplacements: readonly PathReplacement[]
): SupportEvent['context'] {
  const sanitized: SupportEvent['context'] = {}

  for (const [rawKey, rawValue] of Object.entries(context).slice(0, 40)) {
    const key = truncate(rawKey, 80)
    if (SECRET_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED_SECRET]'
      continue
    }

    if (typeof rawValue === 'string') {
      sanitized[key] = truncate(redactSupportText(rawValue, pathReplacements), 500)
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      sanitized[key] = rawValue
    } else if (typeof rawValue === 'boolean' || rawValue === null) {
      sanitized[key] = rawValue
    } else if (rawValue !== undefined) {
      sanitized[key] = truncate(
        redactSupportText(
          (() => {
            try {
              return JSON.stringify(rawValue)
            } catch {
              return '[UNSERIALIZABLE]'
            }
          })(),
          pathReplacements
        ),
        500
      )
    }
  }

  return sanitized
}

function hasKnownSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

function atomicWrite(filePath: string, value: string): void {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  mkdirSync(dirname(filePath), { recursive: true })
  const descriptor = openSync(temporaryPath, 'wx')
  try {
    writeFileSync(descriptor, value, 'utf8')
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporaryPath, filePath)
}

export class SafeDiagnostics {
  readonly logRoot: string
  readonly bundleRoot: string
  readonly logPath: string
  private readonly pathReplacements: PathReplacement[]
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(options: SafeDiagnosticsOptions) {
    this.logRoot = resolve(options.logRoot)
    this.bundleRoot = resolve(options.bundleRoot)
    this.pathReplacements = options.redactedPaths ?? []
    mkdirSync(this.logRoot, { recursive: true })
    mkdirSync(this.bundleRoot, { recursive: true })
    this.logPath = join(
      this.logRoot,
      `studio-${new Date().toISOString().slice(0, 10)}-${randomUUID()}.jsonl`
    )
  }

  async record(input: DiagnosticEventInput): Promise<SupportEvent> {
    const event = SupportEventSchema.parse({
      schemaVersion: 1,
      eventId: randomUUID(),
      correlationId: input.correlationId ?? randomUUID(),
      timestamp: new Date().toISOString(),
      level: input.level,
      area: input.area,
      eventName: input.eventName,
      message: truncate(redactSupportText(input.message, this.pathReplacements), 500),
      context: sanitizeContext(input.context ?? {}, this.pathReplacements)
    })
    const line = `${JSON.stringify(event)}\n`

    this.writeQueue = this.writeQueue.then(async () => {
      const handle = await open(this.logPath, 'a')
      try {
        await handle.writeFile(line, 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
    })
    await this.writeQueue
    return event
  }

  async flush(): Promise<void> {
    await this.writeQueue
  }

  async createBundle(snapshot: SupportSnapshot): Promise<SupportBundleSummary> {
    await this.flush()
    const events = await this.readRecentEvents()
    const bundleId = randomUUID()
    const createdAt = new Date().toISOString()
    const bundle = {
      schemaVersion: 1,
      bundleId,
      createdAt,
      privacy: {
        state: 'redacted',
        includesCredentials: false,
        includesProjectContent: false,
        includesProviderPayloads: false
      },
      system: sanitizeContext({ ...snapshot }, this.pathReplacements),
      events
    }
    const bundleText = `${JSON.stringify(bundle, null, 2)}\n`
    if (hasKnownSecret(bundleText)) {
      throw new Error('The support bundle failed its secret scan and was not saved.')
    }

    const safeTimestamp = createdAt.replace(/[:.]/g, '-')
    const bundlePath = join(this.bundleRoot, `support-${safeTimestamp}-${bundleId}.json`)
    atomicWrite(bundlePath, bundleText)

    return SupportBundleSummarySchema.parse({
      bundleId,
      createdAt,
      eventCount: events.length,
      bundlePath,
      redactionState: 'passed'
    })
  }

  private async readRecentEvents(): Promise<SupportEvent[]> {
    const entries = (await readdir(this.logRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .sort((left, right) => right.name.localeCompare(left.name))
      .slice(0, MAX_LOG_FILES_IN_BUNDLE)
      .reverse()

    const events: SupportEvent[] = []
    for (const entry of entries) {
      const text = await readFile(join(this.logRoot, entry.name), 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        try {
          const parsed = SupportEventSchema.parse(JSON.parse(line))
          events.push(
            SupportEventSchema.parse({
              ...parsed,
              message: redactSupportText(parsed.message, this.pathReplacements),
              context: sanitizeContext(parsed.context, this.pathReplacements)
            })
          )
        } catch {
          // A malformed or incompatible line is omitted instead of weakening the bundle contract.
        }
      }
    }

    return events
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .slice(-MAX_EVENTS_IN_BUNDLE)
  }
}

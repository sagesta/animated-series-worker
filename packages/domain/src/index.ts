import {
  CreateProjectInputSchema,
  ProjectManifestSchema,
  UlidSchema,
  type CreateProjectInput,
  type ProjectManifest
} from '@studio/contracts'

const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeTimestamp(timestamp: number): string {
  let remaining = Math.floor(timestamp)
  let encoded = ''

  for (let index = 0; index < 10; index += 1) {
    encoded = CROCKFORD_BASE32[remaining % 32] + encoded
    remaining = Math.floor(remaining / 32)
  }

  return encoded
}

function encodeRandomness(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => CROCKFORD_BASE32[byte & 31]).join('')
}

export function createUlid(timestamp = Date.now()): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 281_474_976_710_655) {
    throw new Error('The timestamp cannot be used to create a project identity.')
  }

  return UlidSchema.parse(`${encodeTimestamp(timestamp)}${encodeRandomness()}`)
}

export function normalizeProjectCode(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
    .replace(/-$/g, '')
}

interface BuildManifestOptions {
  id?: string
  now?: Date
}

export function buildProjectManifest(
  input: CreateProjectInput,
  options: BuildManifestOptions = {}
): ProjectManifest {
  const parsed = CreateProjectInputSchema.parse(input)
  const id = UlidSchema.parse(options.id ?? createUlid())
  const now = (options.now ?? new Date()).toISOString()
  const code =
    normalizeProjectCode(parsed.code ?? '') || normalizeProjectCode(parsed.title) || 'PROJECT'
  const folderName = `${code.toLowerCase()}-${id.toLowerCase()}`

  return ProjectManifestSchema.parse({
    schemaVersion: 2,
    id,
    code,
    type: parsed.type,
    title: parsed.title,
    status: 'development',
    language: parsed.language,
    targetDurationMinutes: parsed.targetDurationMinutes,
    visualDirection: parsed.visualDirection,
    sourceMode: parsed.sourceMode,
    pilotBrief: parsed.pilotBrief,
    deliveryProfileId: 'youtube-1080p24-v1',
    budgetPolicyId: 'local-safe-default-v1',
    folderName,
    cloudGpuState: 'not-configured',
    lifecycle: {
      archivedAt: null,
      statusBeforeArchive: null
    },
    safeCheckpoint: {
      label: 'Project created safely',
      createdAt: now
    },
    createdAt: now,
    updatedAt: now
  })
}

import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { z, ZodError } from 'zod'
import {
  ExternalSkillActionResultSchema,
  ExternalSkillManifestSchema,
  ExternalSkillPackageSchema,
  ExternalSkillPlanPreviewSchema,
  ExternalSkillRemoveInputSchema,
  ExternalSkillSetProjectEnabledInputSchema,
  ExternalSkillStatusSchema,
  type ExternalSkillActionResult,
  type ExternalSkillErrorCode,
  type ExternalSkillManifest,
  type ExternalSkillPlanItem,
  type ExternalSkillPlanPreview,
  type ExternalSkillSetProjectEnabledInput,
  type ExternalSkillStatus,
  type InstalledExternalSkill,
  type WritingTaskKind
} from '@studio/contracts'

const MAX_PACKAGE_BYTES = 256 * 1024
const MAX_READY_SKILLS = 4
const SUPPORTED_PERMISSIONS = new Set(['read-project', 'read-creative-direction'])

const StoredSkillSchema = z
  .object({
    manifest: ExternalSkillManifestSchema,
    enabledProjectIds: z.string().array()
  })
  .strict()

const RegistrySchema = z
  .object({
    schemaVersion: z.literal(1),
    installed: StoredSkillSchema.array()
  })
  .strict()

type Registry = z.infer<typeof RegistrySchema>

export interface ResolvedExternalSkillPlan {
  preview: ExternalSkillPlanPreview
  readyManifests: ExternalSkillManifest[]
}

export interface ExternalSkillRegistryOptions {
  rootPath: string
  studioVersion: string
  now?: () => Date
}

export class ExternalSkillRuntimeError extends Error {
  readonly code: ExternalSkillErrorCode

  constructor(code: ExternalSkillErrorCode, message: string) {
    super(message)
    this.name = 'ExternalSkillRuntimeError'
    this.code = code
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareVersions(left: string, right: string): number {
  const leftParts = left
    .split('-')[0]
    .split('.')
    .map((item) => Number.parseInt(item, 10) || 0)
  const rightParts = right
    .split('-')[0]
    .split('.')
    .map((item) => Number.parseInt(item, 10) || 0)
  const length = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index++) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
}

function compatibility(
  manifest: ExternalSkillManifest,
  studioVersion: string
): {
  state: InstalledExternalSkill['compatibilityState']
  reason: string
} {
  if (
    manifest.compatibility.minStudioVersion &&
    compareVersions(studioVersion, manifest.compatibility.minStudioVersion) < 0
  ) {
    return {
      state: 'incompatible',
      reason: `Needs studio ${manifest.compatibility.minStudioVersion} or newer.`
    }
  }
  if (
    manifest.compatibility.maxStudioVersion &&
    compareVersions(studioVersion, manifest.compatibility.maxStudioVersion) > 0
  ) {
    return {
      state: 'incompatible',
      reason: `Supports studio ${manifest.compatibility.maxStudioVersion} or older.`
    }
  }
  return { state: 'compatible', reason: `Compatible with studio ${studioVersion}.` }
}

function atomicJson(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  return mkdir(dirname(filePath), { recursive: true })
    .then(() =>
      writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      })
    )
    .then(() => rename(temporaryPath, filePath))
    .catch(async (error: unknown) => {
      await unlink(temporaryPath).catch(() => undefined)
      throw error
    })
}

function canonicalPlanHash(
  projectId: string,
  taskKind: WritingTaskKind,
  required: ExternalSkillPlanItem[],
  optional: ExternalSkillPlanItem[]
): string {
  return hash(JSON.stringify({ projectId, taskKind, required, optional }))
}

function planItem(
  manifest: ExternalSkillManifest,
  taskKind: WritingTaskKind,
  state: ExternalSkillPlanItem['state'],
  reason: string
): ExternalSkillPlanItem {
  return {
    skillId: manifest.skillId,
    displayName: manifest.displayName,
    version: manifest.version,
    publisher: manifest.publisher,
    source: manifest.source,
    packageSha256: manifest.packageSha256,
    signatureStatus: manifest.signatureStatus,
    executionClass: manifest.executionClass,
    taskKind,
    required: manifest.required,
    requestedPermissions: manifest.requestedPermissions,
    requiredContext: manifest.inputSchema.requiredContext,
    instructionsSha256: hash(manifest.instructions),
    state,
    reason
  }
}

function readyIdsFor(items: ExternalSkillPlanItem[]): Set<string> {
  return new Set(items.filter((item) => item.state === 'ready').map((item) => item.skillId))
}

export class DeclarativeSkillRegistry {
  readonly rootPath: string
  readonly registryPath: string
  private readonly studioVersion: string
  private readonly now: () => Date

  constructor(options: ExternalSkillRegistryOptions) {
    this.rootPath = resolve(options.rootPath)
    this.registryPath = join(this.rootPath, 'registry.json')
    this.studioVersion = options.studioVersion
    this.now = options.now ?? (() => new Date())
  }

  async getStatus(): Promise<ExternalSkillStatus> {
    const registry = await this.load()
    return ExternalSkillStatusSchema.parse({
      installed: registry.installed.map((entry) => {
        const result = compatibility(entry.manifest, this.studioVersion)
        return {
          manifest: entry.manifest,
          enabledProjectIds: entry.enabledProjectIds,
          compatibilityState: result.state,
          compatibilityReason: result.reason
        }
      })
    })
  }

  async installFromFile(sourcePath: string): Promise<ExternalSkillStatus> {
    const candidatePath = resolve(sourcePath)
    if (extname(candidatePath).toLowerCase() !== '.json') {
      throw new ExternalSkillRuntimeError(
        'invalid-package',
        'Choose a declarative skill package ending in .json.'
      )
    }

    const candidateStat = await stat(candidatePath).catch(() => null)
    if (!candidateStat?.isFile() || candidateStat.size > MAX_PACKAGE_BYTES) {
      throw new ExternalSkillRuntimeError(
        'invalid-package',
        'The selected skill package is missing or larger than 256 KB.'
      )
    }

    const quarantinePath = join(
      this.rootPath,
      'quarantine',
      `${randomUUID()}-${basename(candidatePath)}`
    )
    await mkdir(dirname(quarantinePath), { recursive: true })
    await copyFile(candidatePath, quarantinePath)

    try {
      const packageText = await readFile(quarantinePath, 'utf8')
      const parsedPackage = ExternalSkillPackageSchema.parse(JSON.parse(packageText))
      const packageSha256 = hash(packageText)
      const registry = await this.load()
      const sameVersion = registry.installed.find(
        (entry) =>
          entry.manifest.skillId === parsedPackage.skillId &&
          entry.manifest.version === parsedPackage.version
      )
      if (sameVersion && sameVersion.manifest.packageSha256 !== packageSha256) {
        throw new ExternalSkillRuntimeError(
          'version-conflict',
          'This skill version has different contents. The publisher must use a new version number.'
        )
      }
      if (sameVersion) return this.getStatus()

      const manifest = ExternalSkillManifestSchema.parse({
        ...parsedPackage,
        packageSha256,
        signatureStatus: 'unverified',
        installedAt: this.now().toISOString()
      })
      const packagePath = join(
        this.rootPath,
        'packages',
        manifest.skillId,
        manifest.version,
        `${manifest.packageSha256}.json`
      )
      await mkdir(dirname(packagePath), { recursive: true })
      await copyFile(quarantinePath, packagePath)

      const next: Registry = {
        schemaVersion: 1,
        installed: [
          ...registry.installed.filter((entry) => entry.manifest.skillId !== manifest.skillId),
          { manifest, enabledProjectIds: [] }
        ].sort((left, right) => left.manifest.displayName.localeCompare(right.manifest.displayName))
      }
      await atomicJson(this.registryPath, next)
      return this.getStatus()
    } catch (error) {
      if (error instanceof ExternalSkillRuntimeError) throw error
      if (error instanceof ZodError || error instanceof SyntaxError) {
        throw new ExternalSkillRuntimeError(
          'invalid-package',
          error instanceof ZodError
            ? (error.issues[0]?.message ?? 'The skill manifest is invalid.')
            : 'The selected file is not valid JSON.'
        )
      }
      throw new ExternalSkillRuntimeError(
        'storage-error',
        'The skill could not be copied into protected local storage.'
      )
    } finally {
      await rm(quarantinePath, { force: true }).catch(() => undefined)
    }
  }

  async setProjectEnabled(
    input: ExternalSkillSetProjectEnabledInput
  ): Promise<ExternalSkillStatus> {
    const safeInput = ExternalSkillSetProjectEnabledInputSchema.parse(input)
    const registry = await this.load()
    const existing = registry.installed.find(
      (entry) => entry.manifest.skillId === safeInput.skillId
    )
    if (!existing) {
      throw new ExternalSkillRuntimeError('not-found', 'That installed skill could not be found.')
    }
    const compatible = compatibility(existing.manifest, this.studioVersion)
    if (safeInput.enabled && compatible.state !== 'compatible') {
      throw new ExternalSkillRuntimeError('incompatible', compatible.reason)
    }
    const projectIds = new Set(existing.enabledProjectIds)
    if (safeInput.enabled) projectIds.add(safeInput.projectId)
    else projectIds.delete(safeInput.projectId)
    existing.enabledProjectIds = [...projectIds].sort()
    await atomicJson(this.registryPath, registry)
    return this.getStatus()
  }

  async remove(skillId: string): Promise<ExternalSkillStatus> {
    const safeInput = ExternalSkillRemoveInputSchema.parse({ skillId })
    const registry = await this.load()
    if (!registry.installed.some((entry) => entry.manifest.skillId === safeInput.skillId)) {
      throw new ExternalSkillRuntimeError('not-found', 'That installed skill could not be found.')
    }
    await atomicJson(this.registryPath, {
      schemaVersion: 1,
      installed: registry.installed.filter((entry) => entry.manifest.skillId !== safeInput.skillId)
    })
    return this.getStatus()
  }

  async getPlan(projectId: string, taskKind: WritingTaskKind): Promise<ResolvedExternalSkillPlan> {
    const registry = await this.load()
    const relevant = registry.installed.filter(
      (entry) =>
        entry.enabledProjectIds.includes(projectId) && entry.manifest.taskKinds.includes(taskKind)
    )
    const items = relevant.map((entry) => {
      const compatible = compatibility(entry.manifest, this.studioVersion)
      if (compatible.state !== 'compatible') {
        return planItem(entry.manifest, taskKind, 'incompatible', compatible.reason)
      }
      const unsupportedPermissions = entry.manifest.requestedPermissions.filter(
        (permission) => !SUPPORTED_PERMISSIONS.has(permission)
      )
      if (unsupportedPermissions.length > 0) {
        return planItem(
          entry.manifest,
          taskKind,
          'permission-blocked',
          `Permission not available yet: ${unsupportedPermissions.join(', ')}.`
        )
      }
      return planItem(
        entry.manifest,
        taskKind,
        'ready',
        `Matches ${taskKind.replaceAll('_', ' ')} and uses only approved local context.`
      )
    })
    const required = items.filter((item) => item.required)
    const optional = items.filter((item) => !item.required)
    const readyCount = items.filter((item) => item.state === 'ready').length
    const blockingIssues = required
      .filter((item) => item.state !== 'ready')
      .map((item) => `${item.displayName} ${item.version}: ${item.reason}`)
    if (readyCount > MAX_READY_SKILLS) {
      blockingIssues.push(
        `This task has ${readyCount} ready skills; the safe limit is ${MAX_READY_SKILLS}. Disable at least ${readyCount - MAX_READY_SKILLS}.`
      )
    }
    const compiledInstructionCharacters = relevant
      .filter((entry) => readyIdsFor(items).has(entry.manifest.skillId))
      .reduce(
        (total, entry) =>
          total +
          entry.manifest.instructions.length +
          entry.manifest.outputSchema.requiredSectionHeadings.join(', ').length +
          entry.manifest.displayName.length +
          entry.manifest.skillId.length +
          180,
        0
      )
    if (compiledInstructionCharacters > 9_000) {
      blockingIssues.push(
        'The matching skill instructions are too large for one safe writing request. Disable or simplify a skill.'
      )
    }
    const preview = ExternalSkillPlanPreviewSchema.parse({
      projectId,
      taskKind,
      planSha256: canonicalPlanHash(projectId, taskKind, required, optional),
      required,
      optional,
      blockingIssues,
      ready: blockingIssues.length === 0
    })
    const readyIds = readyIdsFor(items)
    return {
      preview,
      readyManifests: relevant
        .map((entry) => entry.manifest)
        .filter((manifest) => readyIds.has(manifest.skillId))
    }
  }

  private async load(): Promise<Registry> {
    try {
      return RegistrySchema.parse(JSON.parse(await readFile(this.registryPath, 'utf8')))
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code
      if (errorCode === 'ENOENT') return { schemaVersion: 1, installed: [] }
      if (error instanceof ZodError || error instanceof SyntaxError) {
        throw new ExternalSkillRuntimeError(
          'storage-error',
          'The local skill registry needs repair before skills can be used.'
        )
      }
      throw error
    }
  }
}

export function toExternalSkillActionError(
  error: unknown
): Extract<ExternalSkillActionResult, { ok: false }> {
  if (error instanceof ExternalSkillRuntimeError) {
    return ExternalSkillActionResultSchema.parse({
      ok: false,
      error: { code: error.code, message: error.message }
    }) as Extract<ExternalSkillActionResult, { ok: false }>
  }
  if (error instanceof ZodError) {
    return ExternalSkillActionResultSchema.parse({
      ok: false,
      error: {
        code: 'invalid-package',
        message: error.issues[0]?.message ?? 'Check the skill details and try again.'
      }
    }) as Extract<ExternalSkillActionResult, { ok: false }>
  }
  return ExternalSkillActionResultSchema.parse({
    ok: false,
    error: {
      code: 'unknown',
      message: 'The skill action could not be completed safely. No project was changed.'
    }
  }) as Extract<ExternalSkillActionResult, { ok: false }>
}

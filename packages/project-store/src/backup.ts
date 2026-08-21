import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { constants } from 'node:fs'
import { copyFile, lstat, mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  ProjectBackupManifestSchema,
  ProjectBackupSummarySchema,
  ProjectManifestSchema,
  UlidSchema,
  type ProjectBackupFile,
  type ProjectBackupManifest,
  type ProjectBackupSummary,
  type ProjectManifest
} from '@studio/contracts'
import { createUlid } from '@studio/domain'

interface FileDigest {
  byteSize: number
  sha256: string
}

interface VerifiedBackup {
  manifest: ProjectBackupManifest
  snapshotPath: string
  summary: ProjectBackupSummary
}

export interface BackupServiceOptions {
  workspaceRoot: string
  backupRoot: string
  studioVersion: string
}

export interface RestoredProjectSnapshot {
  backupId: string
  manifest: ProjectManifest
  manifestSha256: string
  workspacePath: string
}

export interface RestoreHooks {
  beforeCopy?(manifest: ProjectBackupManifest): void | Promise<void>
  validateSnapshot?(snapshotPath: string): void | Promise<void>
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const pathFromRoot = relative(rootPath, candidatePath)
  return pathFromRoot !== '' && !pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot)
}

function resolveInside(rootPath: string, ...parts: string[]): string {
  const candidatePath = resolve(rootPath, ...parts)
  if (!isInside(rootPath, candidatePath)) {
    throw new Error('A backup path tried to leave its protected folder.')
  }

  return candidatePath
}

function portablePath(rootPath: string, filePath: string): string {
  return relative(rootPath, filePath).split(sep).join('/')
}

function isTransientFile(name: string): boolean {
  const lowerName = name.toLowerCase()
  return lowerName.endsWith('.tmp') || lowerName.endsWith('-wal') || lowerName.endsWith('-shm')
}

async function digestFile(filePath: string): Promise<FileDigest> {
  const hash = createHash('sha256')
  let byteSize = 0

  for await (const chunk of createReadStream(filePath)) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    byteSize += buffer.byteLength
    hash.update(buffer)
  }

  return { byteSize, sha256: hash.digest('hex') }
}

async function collectFiles(rootPath: string): Promise<string[]> {
  const rootStats = await lstat(rootPath)
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error('The backup source is not a safe project folder.')
  }

  const files: string[] = []

  async function visit(directoryPath: string): Promise<void> {
    const entries = await readdir(directoryPath, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(
          'Projects containing shortcuts or linked folders cannot be backed up safely.'
        )
      }

      if (entry.isDirectory()) {
        await visit(entryPath)
        continue
      }

      if (!entry.isFile()) {
        throw new Error('The project contains an unsupported special file.')
      }

      if (!isTransientFile(entry.name)) {
        files.push(entryPath)
      }
    }
  }

  await visit(rootPath)
  return files
}

async function copyAndVerifyFile(sourcePath: string, destinationPath: string): Promise<FileDigest> {
  const sourceDigest = await digestFile(sourcePath)
  await mkdir(dirname(destinationPath), { recursive: true })
  await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL)
  const destinationHandle = await open(destinationPath, 'r+')
  try {
    await destinationHandle.sync()
  } finally {
    await destinationHandle.close()
  }
  const destinationDigest = await digestFile(destinationPath)

  if (
    sourceDigest.byteSize !== destinationDigest.byteSize ||
    sourceDigest.sha256 !== destinationDigest.sha256
  ) {
    throw new Error('A copied backup file did not match its source.')
  }

  return destinationDigest
}

async function copyInventory(
  sourceRoot: string,
  destinationRoot: string,
  files: readonly string[]
): Promise<ProjectBackupFile[]> {
  const inventory: ProjectBackupFile[] = []

  for (const sourcePath of files) {
    const relativePath = portablePath(sourceRoot, sourcePath)
    const destinationPath = resolveInside(destinationRoot, ...relativePath.split('/'))
    const digest = await copyAndVerifyFile(sourcePath, destinationPath)
    inventory.push({ relativePath, ...digest })
  }

  return inventory
}

function toSummary(manifest: ProjectBackupManifest, backupPath: string): ProjectBackupSummary {
  return ProjectBackupSummarySchema.parse({
    backupId: manifest.backupId,
    projectId: manifest.projectId,
    projectCode: manifest.projectCode,
    projectTitle: manifest.projectTitle,
    createdAt: manifest.createdAt,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    backupPath,
    verificationState: 'verified'
  })
}

export class ProjectBackupService {
  readonly workspaceRoot: string
  readonly backupRoot: string
  private readonly studioVersion: string

  constructor(options: BackupServiceOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot)
    this.backupRoot = resolve(options.backupRoot)
    this.studioVersion = options.studioVersion
  }

  async create(
    workspacePath: string,
    projectManifest: ProjectManifest
  ): Promise<ProjectBackupSummary> {
    const resolvedWorkspacePath = resolve(workspacePath)
    if (!isInside(this.workspaceRoot, resolvedWorkspacePath)) {
      throw new Error('The project is outside the studio workspace.')
    }

    await mkdir(this.backupRoot, { recursive: true })
    const backupId = createUlid()
    const finalPath = resolveInside(this.backupRoot, backupId.toLowerCase())
    const temporaryPath = resolveInside(
      this.backupRoot,
      `.incomplete-${backupId.toLowerCase()}-${randomUUID()}`
    )
    const snapshotPath = join(temporaryPath, 'snapshot')

    await mkdir(snapshotPath, { recursive: true })

    try {
      const files = await collectFiles(resolvedWorkspacePath)
      const inventory = await copyInventory(resolvedWorkspacePath, snapshotPath, files)
      const projectFile = inventory.find((file) => file.relativePath === 'project.json')
      if (!projectFile) {
        throw new Error('The project manifest was missing from the backup.')
      }

      const backupManifest = ProjectBackupManifestSchema.parse({
        schemaVersion: 1,
        backupId,
        projectId: projectManifest.id,
        projectCode: projectManifest.code,
        projectTitle: projectManifest.title,
        projectFolderName: projectManifest.folderName,
        projectManifestSha256: projectFile.sha256,
        studioVersion: this.studioVersion,
        createdAt: new Date().toISOString(),
        fileCount: inventory.length,
        totalBytes: inventory.reduce((total, file) => total + file.byteSize, 0),
        files: inventory
      })

      const manifestHandle = await open(join(temporaryPath, 'backup.json'), 'wx')
      try {
        await manifestHandle.writeFile(`${JSON.stringify(backupManifest, null, 2)}\n`, 'utf8')
        await manifestHandle.sync()
      } finally {
        await manifestHandle.close()
      }
      await rename(temporaryPath, finalPath)
      return (await this.verify(backupId)).summary
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true })
      throw error
    }
  }

  async list(): Promise<ProjectBackupSummary[]> {
    await mkdir(this.backupRoot, { recursive: true })
    const entries = await readdir(this.backupRoot, { withFileTypes: true })
    const summaries: ProjectBackupSummary[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      try {
        const backupId = UlidSchema.parse(entry.name.toUpperCase())
        summaries.push((await this.verify(backupId)).summary)
      } catch {
        // Incomplete, damaged, or unrelated folders are preserved but never presented as restorable.
      }
    }

    return summaries.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async verify(backupId: string): Promise<VerifiedBackup> {
    const validBackupId = UlidSchema.parse(backupId)
    const backupPath = resolveInside(this.backupRoot, validBackupId.toLowerCase())
    const manifestPath = join(backupPath, 'backup.json')
    const snapshotPath = join(backupPath, 'snapshot')
    const manifest = ProjectBackupManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, 'utf8'))
    )

    if (manifest.backupId !== validBackupId) {
      throw new Error('The backup identity does not match its folder.')
    }

    const actualFiles = await collectFiles(snapshotPath)
    if (actualFiles.length !== manifest.fileCount || manifest.files.length !== manifest.fileCount) {
      throw new Error('The backup file inventory is incomplete.')
    }

    const expectedFiles = new Map(manifest.files.map((file) => [file.relativePath, file]))
    let totalBytes = 0
    for (const filePath of actualFiles) {
      const relativePath = portablePath(snapshotPath, filePath)
      const expected = expectedFiles.get(relativePath)
      if (!expected) {
        throw new Error('The backup contains an unexpected file.')
      }

      const digest = await digestFile(filePath)
      if (digest.byteSize !== expected.byteSize || digest.sha256 !== expected.sha256) {
        throw new Error(`The backup copy of ${relativePath} did not pass verification.`)
      }

      expectedFiles.delete(relativePath)
      totalBytes += digest.byteSize
    }

    if (expectedFiles.size > 0 || totalBytes !== manifest.totalBytes) {
      throw new Error('The backup inventory did not pass verification.')
    }

    const projectManifestText = await readFile(join(snapshotPath, 'project.json'), 'utf8')
    const projectManifestSha256 = createHash('sha256').update(projectManifestText).digest('hex')
    const projectManifest = ProjectManifestSchema.parse(JSON.parse(projectManifestText))
    if (
      projectManifestSha256 !== manifest.projectManifestSha256 ||
      projectManifest.id !== manifest.projectId ||
      projectManifest.code !== manifest.projectCode ||
      projectManifest.title !== manifest.projectTitle ||
      projectManifest.folderName !== manifest.projectFolderName
    ) {
      throw new Error('The project identity inside the backup does not match its backup record.')
    }

    return {
      manifest,
      snapshotPath,
      summary: toSummary(manifest, backupPath)
    }
  }

  async restore(backupId: string, hooks: RestoreHooks = {}): Promise<RestoredProjectSnapshot> {
    const verified = await this.verify(backupId)
    await hooks.beforeCopy?.(verified.manifest)
    const finalPath = resolveInside(this.workspaceRoot, verified.manifest.projectFolderName)

    try {
      await stat(finalPath)
      throw new Error(
        'That project folder still exists. The studio will not overwrite it during restore.'
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }

    const temporaryPath = resolveInside(
      this.workspaceRoot,
      `.restore-${verified.manifest.backupId.toLowerCase()}-${randomUUID()}`
    )
    await mkdir(temporaryPath, { recursive: false })

    try {
      const sourceFiles = await collectFiles(verified.snapshotPath)
      await copyInventory(verified.snapshotPath, temporaryPath, sourceFiles)
      await this.verifyRestoredCopy(verified.manifest, temporaryPath)
      await hooks.validateSnapshot?.(temporaryPath)
      const manifestText = await readFile(join(temporaryPath, 'project.json'), 'utf8')
      const projectManifest = ProjectManifestSchema.parse(JSON.parse(manifestText))
      const manifestSha256 = createHash('sha256').update(manifestText).digest('hex')
      await rename(temporaryPath, finalPath)

      return {
        backupId: verified.manifest.backupId,
        manifest: projectManifest,
        manifestSha256,
        workspacePath: finalPath
      }
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true })
      throw error
    }
  }

  private async verifyRestoredCopy(
    backupManifest: ProjectBackupManifest,
    restoredPath: string
  ): Promise<void> {
    const restoredFiles = await collectFiles(restoredPath)
    if (restoredFiles.length !== backupManifest.fileCount) {
      throw new Error('The restored copy is incomplete.')
    }

    const expectedFiles = new Map(backupManifest.files.map((file) => [file.relativePath, file]))
    for (const filePath of restoredFiles) {
      const relativePath = portablePath(restoredPath, filePath)
      const expected = expectedFiles.get(relativePath)
      if (!expected) {
        throw new Error('The restored copy contains an unexpected file.')
      }

      const digest = await digestFile(filePath)
      if (digest.byteSize !== expected.byteSize || digest.sha256 !== expected.sha256) {
        throw new Error(`The restored copy of ${relativePath} did not pass verification.`)
      }

      expectedFiles.delete(relativePath)
    }

    if (expectedFiles.size > 0) {
      throw new Error('The restored copy is missing one or more files.')
    }
  }
}

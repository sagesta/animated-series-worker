import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  ProjectDetailsSchema,
  ProjectManifestSchema,
  ProjectManifestV2Schema,
  ProjectMigrationInputSchema,
  ProjectMigrationPreviewSchema,
  ProjectMigrationResultSchema,
  ProjectRestoreResultSchema,
  ProjectSummarySchema,
  UlidSchema,
  WritingDraftRecordSchema,
  type CreateProjectInput,
  type ProjectBackupSummary,
  type ProjectDetails,
  type ProjectManifest,
  type ProjectMigrationInput,
  type ProjectMigrationPreview,
  type ProjectMigrationResult,
  type ProjectRestoreResult,
  type ProjectSummary,
  type WritingDraftRecord
} from '@studio/contracts'
import { buildProjectManifest } from '@studio/domain'
import { ProjectBackupService } from './backup'
import { WorkspaceWriterLock } from './writer-lock'

const PROJECT_DIRECTORIES = [
  'source/shuohao',
  'bibles/style',
  'bibles/characters',
  'bibles/voices',
  'bibles/locations',
  'bibles/props',
  'productions/seasons',
  'productions/film/sequences',
  'assets/images',
  'assets/audio',
  'assets/video',
  'assets/documents',
  'controls',
  'animatics',
  'adaptations',
  'provenance/writing',
  'provenance/skills',
  'manifests',
  'jobs',
  'timelines',
  'exports'
] as const

interface ProjectRow {
  id: string
  workspace_path: string
}

export interface ProjectStoreOptions {
  workspaceRoot: string
  catalogPath?: string
  backupRoot?: string
  studioVersion?: string
  migrationFailureInjector?: (point: ProjectMigrationFailurePoint) => void
}

export type ProjectMigrationFailurePoint =
  | 'after-backup'
  | 'before-manifest-activation'
  | 'after-manifest-activation'
  | 'after-database-commit'

function atomicWriteText(filePath: string, text: string): string {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  const sha256 = createHash('sha256').update(text).digest('hex')
  mkdirSync(dirname(filePath), { recursive: true })

  const fileDescriptor = openSync(temporaryPath, 'wx')
  try {
    writeFileSync(fileDescriptor, text, 'utf8')
    fsyncSync(fileDescriptor)
  } finally {
    closeSync(fileDescriptor)
  }

  renameSync(temporaryPath, filePath)
  return sha256
}

function atomicWriteJson(filePath: string, value: unknown): { json: string; sha256: string } {
  const json = `${JSON.stringify(value, null, 2)}\n`
  const sha256 = atomicWriteText(filePath, json)
  return {
    json,
    sha256
  }
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const pathFromRoot = relative(rootPath, candidatePath)
  return pathFromRoot !== '' && !pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot)
}

function toSummary(manifest: ProjectManifest, workspacePath: string): ProjectSummary {
  return ProjectSummarySchema.parse({
    id: manifest.id,
    code: manifest.code,
    title: manifest.title,
    type: manifest.type,
    status: manifest.status,
    targetDurationMinutes: manifest.targetDurationMinutes,
    visualDirection: manifest.visualDirection,
    safeCheckpointAt: manifest.safeCheckpoint.createdAt,
    updatedAt: manifest.updatedAt,
    workspacePath
  })
}

export class ProjectStore {
  readonly workspaceRoot: string
  readonly catalogPath: string
  readonly backupRoot: string
  private catalog!: DatabaseSync
  private readonly backupService: ProjectBackupService
  private readonly writerLock: WorkspaceWriterLock
  private readonly migrationFailureInjector?: ProjectStoreOptions['migrationFailureInjector']
  private operationInProgress = false
  private closed = false

  constructor(options: ProjectStoreOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot)
    this.catalogPath = resolve(
      options.catalogPath ?? join(this.workspaceRoot, '.studio', 'catalog.sqlite')
    )
    this.backupRoot = resolve(options.backupRoot ?? join(this.workspaceRoot, '.studio', 'backups'))
    this.migrationFailureInjector = options.migrationFailureInjector

    mkdirSync(this.workspaceRoot, { recursive: true })
    mkdirSync(dirname(this.catalogPath), { recursive: true })
    mkdirSync(this.backupRoot, { recursive: true })
    this.writerLock = WorkspaceWriterLock.acquire(
      join(this.workspaceRoot, '.studio', 'writer.lock'),
      this.workspaceRoot
    )
    this.backupService = new ProjectBackupService({
      workspaceRoot: this.workspaceRoot,
      backupRoot: this.backupRoot,
      studioVersion: options.studioVersion ?? 'development'
    })

    try {
      this.catalog = new DatabaseSync(this.catalogPath)
      this.catalog.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = FULL;

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO schema_migrations (version, applied_at)
      VALUES (1, CURRENT_TIMESTAMP);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        workspace_path TEXT NOT NULL UNIQUE,
        manifest_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS projects_updated_at
      ON projects(updated_at DESC);
    `)

      this.reconcile()
    } catch (error) {
      try {
        this.catalog?.close()
      } catch {
        // The original initialization error remains the useful failure.
      }
      this.writerLock.release()
      throw error
    }
  }

  close(): void {
    if (this.closed) {
      return
    }

    this.closed = true
    try {
      this.catalog.close()
    } finally {
      this.writerLock.release()
    }
  }

  createProject(input: CreateProjectInput): ProjectDetails {
    this.assertAvailableForWrite()
    const manifest = buildProjectManifest(input)
    const workspacePath = this.resolveProjectFolder(manifest.folderName)

    if (existsSync(workspacePath)) {
      throw new Error('A project folder with this identity already exists.')
    }

    mkdirSync(workspacePath)
    for (const directory of PROJECT_DIRECTORIES) {
      mkdirSync(join(workspacePath, ...directory.split('/')), { recursive: true })
    }

    const { sha256 } = atomicWriteJson(join(workspacePath, 'project.json'), manifest)
    this.initializeProjectDatabase(workspacePath, manifest, sha256)
    this.indexManifest(manifest, workspacePath, sha256)

    return ProjectDetailsSchema.parse({ manifest, workspacePath })
  }

  async createBackup(projectId: string): Promise<ProjectBackupSummary> {
    return this.runExclusiveOperation(async () => {
      const project = this.openProject(projectId)
      this.assertProjectDatabaseHealthy(project.workspacePath, true)
      return this.backupService.create(project.workspacePath, project.manifest)
    })
  }

  async listBackups(): Promise<ProjectBackupSummary[]> {
    this.assertOpen()
    return this.backupService.list()
  }

  async restoreBackup(backupId: string): Promise<ProjectRestoreResult> {
    return this.runExclusiveOperation(async () => {
      const restored = await this.backupService.restore(backupId, {
        beforeCopy: (backupManifest) => {
          const existing = this.catalog
            .prepare('SELECT id, workspace_path FROM projects WHERE id = ?')
            .get(backupManifest.projectId) as unknown as ProjectRow | undefined

          if (existing && existsSync(resolve(existing.workspace_path))) {
            throw new Error(
              'That project is already present. The studio will not overwrite it during restore.'
            )
          }
        },
        validateSnapshot: (snapshotPath) => {
          this.assertProjectDatabaseHealthy(snapshotPath, false)
        }
      })

      for (const directory of PROJECT_DIRECTORIES) {
        mkdirSync(join(restored.workspacePath, ...directory.split('/')), { recursive: true })
      }
      this.indexManifest(restored.manifest, restored.workspacePath, restored.manifestSha256)

      return ProjectRestoreResultSchema.parse({
        backupId: restored.backupId,
        restoredAt: new Date().toISOString(),
        project: {
          manifest: restored.manifest,
          workspacePath: restored.workspacePath
        }
      })
    })
  }

  getMigrationPreview(projectId: string): ProjectMigrationPreview | null {
    const project = this.openProject(projectId)
    if (project.manifest.schemaVersion !== 1) {
      return null
    }

    return ProjectMigrationPreviewSchema.parse({
      migrationId: 'project-manifest-v1-to-v2',
      projectId: project.manifest.id,
      projectTitle: project.manifest.title,
      expectedUpdatedAt: project.manifest.updatedAt,
      fromVersion: 1,
      toVersion: 2,
      backupRequired: true,
      dataLossExpected: false,
      filesChanged: 1,
      changes: [
        'Add reversible archive and unarchive history fields.',
        'Keep every existing project setting, file, and approval unchanged.',
        'Create and verify a complete recovery backup before activation.'
      ]
    })
  }

  async migrateProject(input: ProjectMigrationInput): Promise<ProjectMigrationResult> {
    const safeInput = ProjectMigrationInputSchema.parse(input)
    return this.runExclusiveOperation(async () => {
      const project = this.openProject(safeInput.projectId)
      if (project.manifest.schemaVersion !== 1) {
        throw new Error('This project does not need the selected format update.')
      }
      if (project.manifest.updatedAt !== safeInput.expectedUpdatedAt) {
        throw new Error('The project changed after the update preview. Review it again first.')
      }

      const manifestPath = join(project.workspacePath, 'project.json')
      const originalText = readFileSync(manifestPath, 'utf8')
      const originalSha256 = createHash('sha256').update(originalText).digest('hex')
      this.assertProjectDatabaseHealthy(project.workspacePath, true)
      const backup = await this.backupService.create(project.workspacePath, project.manifest)
      this.injectMigrationFailure('after-backup')

      const migratedAt = new Date().toISOString()
      const migratedManifest = ProjectManifestV2Schema.parse({
        ...project.manifest,
        schemaVersion: 2,
        lifecycle:
          project.manifest.status === 'archived'
            ? {
                archivedAt: project.manifest.updatedAt,
                statusBeforeArchive: 'development'
              }
            : { archivedAt: null, statusBeforeArchive: null },
        safeCheckpoint: {
          label: 'Project format updated safely',
          createdAt: migratedAt
        },
        updatedAt: migratedAt
      })

      let manifestActivated = false
      let databaseMigrated = false
      try {
        this.injectMigrationFailure('before-manifest-activation')
        const { sha256 } = atomicWriteJson(manifestPath, migratedManifest)
        manifestActivated = true
        this.injectMigrationFailure('after-manifest-activation')
        this.applyProjectSchemaMigration(project.workspacePath, migratedAt, sha256)
        databaseMigrated = true
        this.injectMigrationFailure('after-database-commit')
        this.indexManifest(migratedManifest, project.workspacePath, sha256)

        return ProjectMigrationResultSchema.parse({
          migrationId: 'project-manifest-v1-to-v2',
          migratedAt,
          backup,
          project: { manifest: migratedManifest, workspacePath: project.workspacePath }
        })
      } catch (error) {
        try {
          if (databaseMigrated) {
            this.rollbackProjectSchemaMigration(project.workspacePath, originalSha256)
          }
          if (manifestActivated) {
            atomicWriteText(manifestPath, originalText)
          }
          this.indexManifest(project.manifest, project.workspacePath, originalSha256)
        } catch {
          throw new Error(
            `The format update failed and needs recovery from verified backup ${backup.backupId}.`
          )
        }
        throw error
      }
    })
  }

  listProjects(): ProjectSummary[] {
    this.reconcile()
    const rows = this.catalog
      .prepare('SELECT id, workspace_path FROM projects ORDER BY updated_at DESC, title ASC')
      .all() as unknown as ProjectRow[]

    const projects: ProjectSummary[] = []
    for (const row of rows) {
      try {
        const manifest = this.readManifest(row.workspace_path)
        projects.push(toSummary(manifest, row.workspace_path))
      } catch {
        // The catalog is an index. A missing or damaged canonical manifest is skipped safely.
      }
    }

    return projects
  }

  openProject(projectId: string): ProjectDetails {
    const validId = UlidSchema.parse(projectId)
    this.reconcile()
    const row = this.catalog
      .prepare('SELECT id, workspace_path FROM projects WHERE id = ?')
      .get(validId) as unknown as ProjectRow | undefined

    if (!row) {
      throw new Error('That project could not be found on this computer.')
    }

    const workspacePath = resolve(row.workspace_path)
    if (!isInside(this.workspaceRoot, workspacePath)) {
      throw new Error('The project location is outside the studio workspace.')
    }

    const manifest = this.readManifest(workspacePath)
    if (manifest.id !== validId) {
      throw new Error('The project identity does not match its catalog entry.')
    }

    return ProjectDetailsSchema.parse({ manifest, workspacePath })
  }

  saveWritingDraft(unknownDraft: WritingDraftRecord): WritingDraftRecord {
    this.assertAvailableForWrite()
    const draft = WritingDraftRecordSchema.parse(unknownDraft)
    const project = this.openProject(draft.projectId)
    const draftPath = join(
      project.workspacePath,
      'provenance',
      'writing',
      `draft-${draft.draftId}.json`
    )
    if (existsSync(draftPath)) {
      throw new Error('That writing proposal already exists and will not be overwritten.')
    }
    atomicWriteJson(draftPath, draft)
    return draft
  }

  listWritingDrafts(projectId: string): WritingDraftRecord[] {
    const project = this.openProject(projectId)
    const writingDirectory = join(project.workspacePath, 'provenance', 'writing')
    const drafts: WritingDraftRecord[] = []
    for (const entry of readdirSync(writingDirectory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^draft-[0-9A-HJKMNP-TV-Z]{26}\.json$/.test(entry.name)) {
        continue
      }
      try {
        drafts.push(
          WritingDraftRecordSchema.parse(
            JSON.parse(readFileSync(join(writingDirectory, entry.name), 'utf8'))
          )
        )
      } catch {
        // Damaged proposal records stay on disk for recovery and are not shown as healthy drafts.
      }
    }
    return drafts.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  reconcile(): void {
    this.assertOpen()
    const entries = readdirSync(this.workspaceRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.studio') {
        continue
      }

      const workspacePath = this.resolveProjectFolder(entry.name)
      const manifestPath = join(workspacePath, 'project.json')
      if (!existsSync(manifestPath)) {
        continue
      }

      try {
        const manifestText = readFileSync(manifestPath, 'utf8')
        const manifest = ProjectManifestSchema.parse(JSON.parse(manifestText))
        if (manifest.folderName !== entry.name) {
          continue
        }

        const sha256 = createHash('sha256').update(manifestText).digest('hex')
        this.indexManifest(manifest, workspacePath, sha256)
      } catch {
        // Invalid folders are preserved for recovery and are never indexed as healthy projects.
      }
    }
  }

  private resolveProjectFolder(folderName: string): string {
    const candidatePath = resolve(this.workspaceRoot, folderName)
    if (!isInside(this.workspaceRoot, candidatePath)) {
      throw new Error('The project folder is outside the studio workspace.')
    }

    return candidatePath
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('The local project library is closed.')
    }
  }

  private assertAvailableForWrite(): void {
    this.assertOpen()
    if (this.operationInProgress) {
      throw new Error(
        'A project safety operation is already running. Please wait for it to finish.'
      )
    }
  }

  private async runExclusiveOperation<T>(operation: () => Promise<T>): Promise<T> {
    this.assertAvailableForWrite()
    this.operationInProgress = true
    try {
      return await operation()
    } finally {
      this.operationInProgress = false
    }
  }

  private assertProjectDatabaseHealthy(workspacePath: string, checkpoint: boolean): void {
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    try {
      if (checkpoint) {
        database.exec('PRAGMA wal_checkpoint(TRUNCATE);')
      }

      const row = database.prepare('PRAGMA integrity_check').get() as
        Record<string, unknown> | undefined
      if (!row || Object.values(row)[0] !== 'ok') {
        throw new Error('The project database did not pass its safety check.')
      }
    } finally {
      database.close()
    }
  }

  private injectMigrationFailure(point: ProjectMigrationFailurePoint): void {
    this.migrationFailureInjector?.(point)
  }

  private applyProjectSchemaMigration(
    workspacePath: string,
    migratedAt: string,
    manifestSha256: string
  ): void {
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    try {
      database.exec('BEGIN IMMEDIATE')
      database
        .prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)')
        .run(migratedAt)
      database
        .prepare('UPDATE project_metadata SET manifest_sha256 = ? WHERE project_id = ?')
        .run(manifestSha256, this.readManifest(workspacePath).id)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    } finally {
      database.close()
    }
  }

  private rollbackProjectSchemaMigration(workspacePath: string, manifestSha256: string): void {
    const projectId = this.readManifest(workspacePath).id
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    try {
      database.exec('BEGIN IMMEDIATE')
      database.prepare('DELETE FROM schema_migrations WHERE version = 2').run()
      database
        .prepare('UPDATE project_metadata SET manifest_sha256 = ? WHERE project_id = ?')
        .run(manifestSha256, projectId)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    } finally {
      database.close()
    }
  }

  private readManifest(workspacePath: string): ProjectManifest {
    const resolvedWorkspace = resolve(workspacePath)
    if (!isInside(this.workspaceRoot, resolvedWorkspace)) {
      throw new Error('The project location is outside the studio workspace.')
    }

    return ProjectManifestSchema.parse(
      JSON.parse(readFileSync(join(resolvedWorkspace, 'project.json'), 'utf8'))
    )
  }

  private initializeProjectDatabase(
    workspacePath: string,
    manifest: ProjectManifest,
    manifestSha256: string
  ): void {
    const database = new DatabaseSync(join(workspacePath, 'project.sqlite'))
    try {
      database.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = FULL;

        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_metadata (
          project_id TEXT PRIMARY KEY,
          manifest_path TEXT NOT NULL,
          manifest_sha256 TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `)
      database
        .prepare(
          `INSERT INTO schema_migrations (version, applied_at)
           VALUES (1, ?)`
        )
        .run(manifest.createdAt)
      if (manifest.schemaVersion === 2) {
        database
          .prepare(
            `INSERT INTO schema_migrations (version, applied_at)
             VALUES (2, ?)`
          )
          .run(manifest.createdAt)
      }
      database
        .prepare(
          `INSERT INTO project_metadata
           (project_id, manifest_path, manifest_sha256, created_at)
           VALUES (?, ?, ?, ?)`
        )
        .run(manifest.id, 'project.json', manifestSha256, manifest.createdAt)
    } finally {
      database.close()
    }
  }

  private indexManifest(
    manifest: ProjectManifest,
    workspacePath: string,
    manifestSha256: string
  ): void {
    this.catalog.exec('BEGIN IMMEDIATE')
    try {
      this.catalog
        .prepare(
          `INSERT INTO projects
           (id, code, title, type, status, workspace_path, manifest_sha256, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             code = excluded.code,
             title = excluded.title,
             type = excluded.type,
             status = excluded.status,
             workspace_path = excluded.workspace_path,
             manifest_sha256 = excluded.manifest_sha256,
             updated_at = excluded.updated_at`
        )
        .run(
          manifest.id,
          manifest.code,
          manifest.title,
          manifest.type,
          manifest.status,
          workspacePath,
          manifestSha256,
          manifest.createdAt,
          manifest.updatedAt
        )
      this.catalog.exec('COMMIT')
    } catch (error) {
      this.catalog.exec('ROLLBACK')
      throw error
    }
  }
}

export { PROJECT_DIRECTORIES }

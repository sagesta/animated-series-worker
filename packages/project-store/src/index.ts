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
  ProjectSummarySchema,
  UlidSchema,
  type CreateProjectInput,
  type ProjectDetails,
  type ProjectManifest,
  type ProjectSummary
} from '@studio/contracts'
import { buildProjectManifest } from '@studio/domain'

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
}

function atomicWriteJson(filePath: string, value: unknown): { json: string; sha256: string } {
  const json = `${JSON.stringify(value, null, 2)}\n`
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  const sha256 = createHash('sha256').update(json).digest('hex')
  mkdirSync(dirname(filePath), { recursive: true })

  const fileDescriptor = openSync(temporaryPath, 'wx')
  try {
    writeFileSync(fileDescriptor, json, 'utf8')
    fsyncSync(fileDescriptor)
  } finally {
    closeSync(fileDescriptor)
  }

  renameSync(temporaryPath, filePath)
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
  private readonly catalog: DatabaseSync

  constructor(options: ProjectStoreOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot)
    this.catalogPath = resolve(
      options.catalogPath ?? join(this.workspaceRoot, '.studio', 'catalog.sqlite')
    )

    mkdirSync(this.workspaceRoot, { recursive: true })
    mkdirSync(dirname(this.catalogPath), { recursive: true })

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
  }

  close(): void {
    this.catalog.close()
  }

  createProject(input: CreateProjectInput): ProjectDetails {
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

  reconcile(): void {
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

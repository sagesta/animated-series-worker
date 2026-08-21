import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProjectManifestSchema } from '@studio/contracts'
import { PROJECT_DIRECTORIES, ProjectStore } from './index'

const temporaryRoots: string[] = []

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'animated-series-studio-test-'))
  temporaryRoots.push(root)
  return root
}

function input(title: string, type: 'series' | 'film') {
  return {
    title,
    type,
    language: 'English',
    targetDurationMinutes: type === 'series' ? 25 : 12,
    visualDirection: type === 'series' ? ('2d' as const) : ('3d-look' as const),
    sourceMode: 'original' as const,
    pilotBrief: ''
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('ProjectStore', () => {
  it('AT-001 foundation slice creates and reopens an isolated series and film', () => {
    const workspaceRoot = createRoot()
    const store = new ProjectStore({ workspaceRoot })
    const series = store.createProject(input('Lantern Keepers', 'series'))
    const film = store.createProject(input('The Last Kite', 'film'))

    expect(series.workspacePath).not.toBe(film.workspacePath)
    expect(series.manifest.type).toBe('series')
    expect(film.manifest.type).toBe('film')

    for (const project of [series, film]) {
      expect(existsSync(join(project.workspacePath, 'project.json'))).toBe(true)
      expect(existsSync(join(project.workspacePath, 'project.sqlite'))).toBe(true)
      for (const directory of PROJECT_DIRECTORIES) {
        expect(existsSync(join(project.workspacePath, ...directory.split('/')))).toBe(true)
      }

      const manifest = ProjectManifestSchema.parse(
        JSON.parse(readFileSync(join(project.workspacePath, 'project.json'), 'utf8'))
      )
      expect(manifest.id).toBe(project.manifest.id)
    }

    store.close()

    const reopenedStore = new ProjectStore({ workspaceRoot })
    const summaries = reopenedStore.listProjects()
    expect(summaries).toHaveLength(2)
    expect(reopenedStore.openProject(series.manifest.id).manifest.title).toBe('Lantern Keepers')
    expect(reopenedStore.openProject(film.manifest.id).manifest.title).toBe('The Last Kite')
    reopenedStore.close()
  })

  it('AT-031 foundation slice keeps same-title projects in distinct folders', () => {
    const workspaceRoot = createRoot()
    const store = new ProjectStore({ workspaceRoot })
    const first = store.createProject(input('Moon House', 'series'))
    const second = store.createProject(input('Moon House', 'series'))

    expect(first.manifest.code).toBe(second.manifest.code)
    expect(first.manifest.id).not.toBe(second.manifest.id)
    expect(first.workspacePath).not.toBe(second.workspacePath)
    expect(first.workspacePath.startsWith(workspaceRoot)).toBe(true)
    expect(second.workspacePath.startsWith(workspaceRoot)).toBe(true)
    store.close()
  })

  it('refuses invalid identities instead of interpreting them as paths', () => {
    const workspaceRoot = createRoot()
    const store = new ProjectStore({ workspaceRoot })

    expect(() => store.openProject('../../another-project')).toThrow()
    expect(store.listProjects()).toEqual([])
    store.close()
  })

  it('AT-001 creates a verified backup and restores every canonical file without overwrite', async () => {
    const root = createRoot()
    const workspaceRoot = join(root, 'projects')
    const backupRoot = join(root, 'backups')
    const store = new ProjectStore({ workspaceRoot, backupRoot, studioVersion: 'test' })
    const projects = [
      store.createProject(input('Lantern Keepers', 'series')),
      store.createProject(input('The Last Kite', 'film'))
    ]
    const backups = []

    for (const project of projects) {
      const fixtureValue = `locked-${project.manifest.type}-board-v1`
      writeFileSync(
        join(project.workspacePath, 'assets', 'images', 'character-board.txt'),
        fixtureValue,
        'utf8'
      )
      const backup = await store.createBackup(project.manifest.id)
      expect(backup.projectId).toBe(project.manifest.id)
      expect(backup.verificationState).toBe('verified')
      await expect(store.restoreBackup(backup.backupId)).rejects.toThrow(/will not overwrite/i)
      backups.push({ backup, fixtureValue, project })
    }

    expect(await store.listBackups()).toHaveLength(2)
    for (const { project } of backups) {
      renameSync(project.workspacePath, join(root, `preserved-${project.manifest.type}`))
    }

    for (const { backup, fixtureValue, project } of backups) {
      const restored = await store.restoreBackup(backup.backupId)
      expect(restored.project.manifest.id).toBe(project.manifest.id)
      expect(
        readFileSync(
          join(restored.project.workspacePath, 'assets', 'images', 'character-board.txt'),
          'utf8'
        )
      ).toBe(fixtureValue)
      expect(store.openProject(project.manifest.id).workspacePath).toBe(
        restored.project.workspacePath
      )
    }
    store.close()

    const reopenedStore = new ProjectStore({ workspaceRoot, backupRoot, studioVersion: 'test' })
    expect(reopenedStore.listProjects()).toHaveLength(2)
    reopenedStore.close()
  })

  it('rejects a damaged backup and leaves the healthy project untouched', async () => {
    const root = createRoot()
    const workspaceRoot = join(root, 'projects')
    const store = new ProjectStore({
      workspaceRoot,
      backupRoot: join(root, 'backups'),
      studioVersion: 'test'
    })
    const project = store.createProject(input('Signal Garden', 'film'))
    const backup = await store.createBackup(project.manifest.id)
    writeFileSync(join(backup.backupPath, 'snapshot', 'project.json'), '{}\n', 'utf8')

    await expect(store.restoreBackup(backup.backupId)).rejects.toThrow(/did not pass verification/i)
    expect(store.openProject(project.manifest.id).manifest.title).toBe('Signal Garden')
    expect(await store.listBackups()).toEqual([])
    store.close()
  })

  it('allows only one writer and recovers a preserved stale lock', () => {
    const root = createRoot()
    const workspaceRoot = join(root, 'projects')
    const firstStore = new ProjectStore({ workspaceRoot })

    expect(() => new ProjectStore({ workspaceRoot })).toThrow(/already open/i)
    firstStore.close()

    const studioDirectory = join(workspaceRoot, '.studio')
    mkdirSync(studioDirectory, { recursive: true })
    writeFileSync(
      join(studioDirectory, 'writer.lock'),
      `${JSON.stringify({
        schemaVersion: 1,
        pid: 2_147_483_647,
        token: '00000000-0000-4000-8000-000000000000',
        workspaceRoot,
        createdAt: '2026-08-21T12:00:00.000Z'
      })}\n`,
      'utf8'
    )

    const recoveredStore = new ProjectStore({ workspaceRoot })
    expect(readdirSync(studioDirectory).some((name) => name.startsWith('writer.lock.stale-'))).toBe(
      true
    )
    recoveredStore.close()
  })

  it('does not mistake a newly created incomplete writer record for a stale lock', () => {
    const root = createRoot()
    const workspaceRoot = join(root, 'projects')
    const studioDirectory = join(workspaceRoot, '.studio')
    mkdirSync(studioDirectory, { recursive: true })
    writeFileSync(join(studioDirectory, 'writer.lock'), '{', 'utf8')

    expect(() => new ProjectStore({ workspaceRoot })).toThrow(/already being opened/i)
    expect(readdirSync(studioDirectory)).toContain('writer.lock')
  })
})

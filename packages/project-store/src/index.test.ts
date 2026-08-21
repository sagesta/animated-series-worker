import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
})

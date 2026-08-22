import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExternalSkillPackage } from '@studio/contracts'
import { DeclarativeSkillRegistry } from './index'

const roots: string[] = []
const projectId = '01J00000000000000000000000'

function fixturePackage(overrides: Partial<ExternalSkillPackage> = {}): ExternalSkillPackage {
  return {
    schemaVersion: 1,
    skillId: 'story-emotion-map',
    displayName: 'Story Emotion Map',
    description: 'Checks that an outline contains a clear emotional turn and consequence.',
    publisher: 'Studio fixture publisher',
    version: '1.0.0',
    source: 'local-fixture',
    taskKinds: ['outline_episode'],
    instructionsEntry: 'inline',
    instructions:
      'Add a proposal section named Emotional Turn that explains the cause, choice, and consequence.',
    inputSchema: {
      contract: 'studio-writing-context-v1',
      requiredContext: ['project-brief']
    },
    outputSchema: {
      contract: 'studio-creative-draft-v1',
      minimumSections: 1,
      requiredSectionHeadings: ['Emotional Turn']
    },
    requestedPermissions: ['read-project'],
    executionClass: 'declarative',
    required: true,
    compatibility: { minStudioVersion: '0.8.0', maxStudioVersion: '0.8.9' },
    ...overrides
  }
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'skill-runtime-test-'))
  roots.push(root)
  return {
    root,
    registry: new DeclarativeSkillRegistry({
      rootPath: join(root, 'skills'),
      studioVersion: '0.8.0',
      now: () => new Date('2026-08-22T10:00:00.000Z')
    })
  }
}

function writePackage(root: string, value: ExternalSkillPackage, name = 'skill.json'): string {
  const filePath = join(root, name)
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
  return filePath
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('declarative external-skill registry', () => {
  it('quarantines and inspects a package without enabling it globally', async () => {
    const { root, registry } = createFixture()
    const status = await registry.installFromFile(writePackage(root, fixturePackage()))

    expect(status.installed).toHaveLength(1)
    expect(status.installed[0]).toMatchObject({
      enabledProjectIds: [],
      compatibilityState: 'compatible',
      manifest: {
        skillId: 'story-emotion-map',
        signatureStatus: 'unverified',
        executionClass: 'declarative'
      }
    })
    expect(status.installed[0]?.manifest.packageSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(readdirSync(join(root, 'skills', 'quarantine'))).toEqual([])
  })

  it('routes only matching project tasks and records exact ready-plan identity', async () => {
    const { root, registry } = createFixture()
    await registry.installFromFile(writePackage(root, fixturePackage()))
    await registry.setProjectEnabled({
      skillId: 'story-emotion-map',
      projectId,
      enabled: true
    })

    const matching = await registry.getPlan(projectId, 'outline_episode')
    const nonMatching = await registry.getPlan(projectId, 'draft_scene')

    expect(matching.preview).toMatchObject({
      projectId,
      taskKind: 'outline_episode',
      ready: true,
      required: [
        {
          skillId: 'story-emotion-map',
          version: '1.0.0',
          state: 'ready',
          required: true
        }
      ]
    })
    expect(matching.preview.planSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(matching.readyManifests).toHaveLength(1)
    expect(nonMatching.preview.required).toEqual([])
    expect(nonMatching.readyManifests).toEqual([])
  })

  it('blocks unsupported permission for a required skill before a provider request', async () => {
    const { root, registry } = createFixture()
    await registry.installFromFile(
      writePackage(root, fixturePackage({ requestedPermissions: ['read-writing-history'] }))
    )
    await registry.setProjectEnabled({
      skillId: 'story-emotion-map',
      projectId,
      enabled: true
    })

    const plan = await registry.getPlan(projectId, 'outline_episode')
    expect(plan.preview.ready).toBe(false)
    expect(plan.preview.required[0]?.state).toBe('permission-blocked')
    expect(plan.preview.blockingIssues[0]).toContain('Permission not available yet')
  })

  it('rejects changed contents under the same version and revokes project grants on update', async () => {
    const { root, registry } = createFixture()
    await registry.installFromFile(writePackage(root, fixturePackage(), 'skill-v1.json'))
    await registry.setProjectEnabled({
      skillId: 'story-emotion-map',
      projectId,
      enabled: true
    })

    await expect(
      registry.installFromFile(
        writePackage(
          root,
          fixturePackage({
            instructions: 'Changed instructions that still exceed twenty characters.'
          }),
          'skill-conflict.json'
        )
      )
    ).rejects.toMatchObject({ code: 'version-conflict' })

    const updated = await registry.installFromFile(
      writePackage(
        root,
        fixturePackage({
          version: '1.1.0',
          instructions: 'Updated instructions require a newly reviewed project grant.'
        }),
        'skill-v1-1.json'
      )
    )
    expect(updated.installed[0]).toMatchObject({
      enabledProjectIds: [],
      manifest: { version: '1.1.0' }
    })
    expect(existsSync(join(root, 'skills', 'packages', 'story-emotion-map', '1.0.0'))).toBe(true)
  })

  it('removes active use while preserving package evidence for historical receipts', async () => {
    const { root, registry } = createFixture()
    const installed = await registry.installFromFile(writePackage(root, fixturePackage()))
    const packageHash = installed.installed[0]!.manifest.packageSha256
    const status = await registry.remove('story-emotion-map')

    expect(status.installed).toEqual([])
    expect(
      existsSync(
        join(root, 'skills', 'packages', 'story-emotion-map', '1.0.0', `${packageHash}.json`)
      )
    ).toBe(true)
  })
})

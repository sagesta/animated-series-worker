import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

interface NovelCatalog {
  schemaVersion: 1
  fixtures: Array<{
    file: string
    title: string
    author: string
    genre: string
    sourceUrl: string
    ebookNumber: number
  }>
}

const projectRoot = resolve(import.meta.dirname, '..')
const novelRoot = resolve(projectRoot, 'tests', 'fixtures', 'novels')
const vendorRoot = resolve(projectRoot, 'vendor', 'shuohao-skills', 'skills')
const catalog = JSON.parse(readFileSync(resolve(novelRoot, 'catalog.json'), 'utf8')) as NovelCatalog
const temporaryRoots: string[] = []

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studio-novel-contract-'))
  temporaryRoots.push(root)
  return root
}

function run(script: string, args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [resolve(vendorRoot, script), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024
  })
}

const validatorFixtures = [
  {
    name: 'outline',
    script: 'novel-outline/scripts/novel-outline.mjs',
    input: 'novel-outline/examples/渡口-outline.json',
    args(input: string): string[] {
      return ['validate', input, '--stage', 'full']
    }
  },
  {
    name: 'characters',
    script: 'novel-characters/scripts/novel-characters.mjs',
    input: 'novel-characters/examples/渡口-cast.json',
    args(input: string): string[] {
      return ['validate', input, resolve(vendorRoot, 'novel-characters/examples/渡口.txt')]
    }
  },
  {
    name: 'art',
    script: 'novel-art/scripts/novel-art.mjs',
    input: 'novel-art/examples/渡口-art.json',
    args(input: string): string[] {
      return [
        'validate',
        input,
        '--cast',
        resolve(vendorRoot, 'novel-characters/examples/渡口-cast.json')
      ]
    }
  },
  {
    name: 'script',
    script: 'novel-script/scripts/novel-script.mjs',
    input: 'novel-script/examples/渡口-script.json',
    args(input: string): string[] {
      return [
        'validate',
        input,
        '--outline',
        resolve(vendorRoot, 'novel-outline/examples/渡口-outline.json'),
        '--art',
        resolve(vendorRoot, 'novel-art/examples/渡口-art.json')
      ]
    }
  },
  {
    name: 'storyboard',
    script: 'novel-storyboard/scripts/novel-storyboard.mjs',
    input: 'novel-storyboard/examples/渡口-storyboard.json',
    args(input: string): string[] {
      return [
        'validate',
        input,
        '--script',
        resolve(vendorRoot, 'novel-script/examples/渡口-script.json'),
        '--outline',
        resolve(vendorRoot, 'novel-outline/examples/渡口-outline.json'),
        '--cast',
        resolve(vendorRoot, 'novel-characters/examples/渡口-cast.json'),
        '--art',
        resolve(vendorRoot, 'novel-art/examples/渡口-art.json'),
        '--no-log'
      ]
    }
  }
] as const

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = resolve(root)
    if (!resolved.startsWith(resolve(tmpdir())) || !resolved.includes('studio-novel-contract-')) {
      throw new Error('Refused to remove an unexpected novel-contract directory.')
    }
    rmSync(resolved, { recursive: true, force: true })
  }
})

describe('real public-domain novel fixtures', () => {
  it('keeps five varied, attributed, offline fixtures and chunks each with both novel readers', () => {
    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.fixtures).toHaveLength(5)
    expect(new Set(catalog.fixtures.map((fixture) => fixture.genre)).size).toBe(5)
    expect(new Set(catalog.fixtures.map((fixture) => fixture.ebookNumber)).size).toBe(5)

    const lengths: number[] = []
    for (const fixture of catalog.fixtures) {
      expect(fixture.sourceUrl).toBe(`https://www.gutenberg.org/ebooks/${fixture.ebookNumber}`)
      const path = resolve(novelRoot, fixture.file)
      const text = readFileSync(path, 'utf8')
      lengths.push(text.length)
      expect(text).toContain(fixture.author)
      expect(text.length).toBeGreaterThan(500)

      const root = temporaryRoot()
      const outlineOutput = resolve(root, 'outline')
      const characterOutput = resolve(root, 'characters')
      const outline = run(
        'novel-outline/scripts/novel-outline.mjs',
        ['chunk', path, outlineOutput, '--per-volume', '2'],
        root
      )
      const characters = run(
        'novel-characters/scripts/novel-characters.mjs',
        ['chunk', path, characterOutput],
        root
      )
      expect(outline.status, outline.stderr).toBe(0)
      expect(characters.status, characters.stderr).toBe(0)
      expect(readdirSync(outlineOutput).some((name) => /^vol-\d+\.txt$/.test(name))).toBe(true)
      expect(readdirSync(characterOutput).some((name) => /^chunk-\d+\.txt$/.test(name))).toBe(true)
    }

    expect(new Set(lengths).size).toBe(5)
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(1_000)
  }, 60_000)

  it('bounds empty, one-character, and 500k-character novels without hanging or losing status', () => {
    const root = temporaryRoot()
    const cases = [
      ['empty', ''],
      ['single-character', 'A'],
      ['five-hundred-thousand', 'Chapter 1\n' + 'A'.repeat(499_990)]
    ] as const

    for (const [name, text] of cases) {
      const input = resolve(root, `${name}.txt`)
      writeFileSync(input, text, 'utf8')
      for (const [reader, script] of [
        ['outline', 'novel-outline/scripts/novel-outline.mjs'],
        ['characters', 'novel-characters/scripts/novel-characters.mjs']
      ] as const) {
        const output = resolve(root, `${name}-${reader}`)
        const result = run(script, ['chunk', input, output], root)
        expect(result.status, `${name}/${reader}: ${result.stderr}`).toBe(0)
        const files = readdirSync(output)
        if (name === 'empty') expect(files).toHaveLength(0)
        else expect(files.length).toBeGreaterThan(0)
        expect(files.length).toBeLessThanOrEqual(60)
      }
    }
  }, 60_000)
})

describe('five-stage upstream validator process boundary', () => {
  it.each(validatorFixtures)(
    '$name accepts the pinned valid fixture and a harmless forward-compatible extra field',
    (validator) => {
      const root = temporaryRoot()
      const input = resolve(vendorRoot, validator.input)
      const valid = run(validator.script, validator.args(input), root)
      expect(valid.status, valid.stderr).toBe(0)

      const extended = JSON.parse(readFileSync(input, 'utf8')) as Record<string, unknown>
      extended.__studioForwardCompatibilityFixture = { ignored: true }
      const extendedPath = resolve(root, `${validator.name}-extra.json`)
      writeFileSync(extendedPath, JSON.stringify(extended), 'utf8')
      const extra = run(validator.script, validator.args(extendedPath), root)
      expect(extra.status, extra.stderr).toBe(valid.status)
    },
    30_000
  )

  it.each(validatorFixtures)(
    '$name rejects broken JSON, a malformed top level, and missing required fields',
    (validator) => {
      const root = temporaryRoot()
      const cases: Array<[string, string]> = [
        ['broken', '{"source":'],
        ['malformed', '[]'],
        ['missing', '{}']
      ]
      for (const [kind, json] of cases) {
        const path = resolve(root, `${validator.name}-${kind}.json`)
        writeFileSync(path, json, 'utf8')
        const result = run(validator.script, validator.args(path), root)
        expect(result.status, `${validator.name}/${kind}`).not.toBe(0)
        expect(`${result.stdout}${result.stderr}`.length).toBeLessThan(64_000)
      }
    },
    30_000
  )
})

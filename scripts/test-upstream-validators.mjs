#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const skillsRoot = resolve(process.cwd(), 'vendor', 'shuohao-skills', 'skills')
const selfTests = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => resolve(skillsRoot, entry.name, 'scripts', 'selftest.mjs'))
  .filter((path) => {
    try {
      return readdirSync(resolve(path, '..')).includes('selftest.mjs')
    } catch {
      return false
    }
  })
  .sort()

if (selfTests.length !== 6) {
  throw new Error(`Expected six pinned upstream validator self-tests, found ${selfTests.length}.`)
}

for (const selfTest of selfTests) {
  const result = spawnSync(process.execPath, [selfTest], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    throw new Error(`Pinned upstream validator self-test failed: ${selfTest}`)
  }
  process.stdout.write(result.stdout)
}

console.log(`Pinned upstream validation passed for ${selfTests.length} skill families.`)

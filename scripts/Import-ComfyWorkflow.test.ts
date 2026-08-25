import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '..')
const importer = resolve(projectRoot, 'scripts', 'Import-ComfyWorkflow.mjs')

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'studio-workflow-import-'))
  const packPath = resolve(root, 'workflow-pack.candidate.json')
  const inputPath = resolve(root, 'input.json')
  writeFileSync(
    packPath,
    `${JSON.stringify(
      {
        packVersion: 'test-candidate.1',
        workflows: [
          {
            workflowId: 'fixture-workflow',
            engine: 'comfyui',
            parameters: [{ key: 'prompt' }],
            allowedNodeTypes: ['SaveImage', 'LoadImage']
          }
        ]
      },
      null,
      2
    )}\n`
  )
  return { root, packPath, inputPath }
}

function run(packPath: string, inputPath: string): string {
  return execFileSync(
    process.execPath,
    [
      importer,
      '--workflow-id',
      'fixture-workflow',
      '--input',
      inputPath,
      '--pack',
      packPath
    ],
    { encoding: 'utf8' }
  )
}

describe('ComfyUI workflow importer', () => {
  it('records the exact sorted node inventory and SHA-256 of API-format content', () => {
    const { root, packPath, inputPath } = fixture()
    const prompt = {
      '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } },
      '1': { class_type: 'LoadImage', inputs: { image: '$INPUT:0', prompt: '$PARAM:prompt' } }
    }
    const expectedOutput = `${JSON.stringify(prompt, null, 2)}\n`
    writeFileSync(inputPath, JSON.stringify(prompt))

    expect(run(packPath, inputPath)).toContain('Imported candidate workflow fixture-workflow.')

    const pack = JSON.parse(readFileSync(packPath, 'utf8'))
    const workflow = pack.workflows[0]
    expect(workflow.allowedNodeTypes).toEqual(['LoadImage', 'SaveImage'])
    expect(workflow.templatePath).toBe('workflows/candidate/fixture-workflow.api.json')
    expect(workflow.templateSha256).toBe(
      createHash('sha256').update(expectedOutput).digest('hex')
    )
    expect(
      readFileSync(resolve(root, workflow.templatePath), 'utf8')
    ).toBe(expectedOutput)
  })

  it('refuses ComfyUI UI-format content', () => {
    const { packPath, inputPath } = fixture()
    writeFileSync(inputPath, JSON.stringify({ nodes: [], links: [] }))

    expect(() => run(packPath, inputPath)).toThrow(/uses ComfyUI UI format/)
  })

  it('rejects node types that were not reviewed before import', () => {
    const { packPath, inputPath } = fixture()
    writeFileSync(
      inputPath,
      JSON.stringify({ '1': { class_type: 'ExecuteAnything', inputs: {} } })
    )

    expect(() => run(packPath, inputPath)).toThrow(/unauthorized node type: ExecuteAnything/)
    expect(JSON.parse(readFileSync(packPath, 'utf8')).workflows[0].templatePath).toBeUndefined()
  })
})

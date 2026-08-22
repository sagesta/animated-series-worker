#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

function fail(message) {
  throw new Error(message)
}

function argumentsFromCommandLine() {
  const values = Object.create(null)
  let replace = false
  for (let index = 2; index < process.argv.length; index += 1) {
    const key = process.argv[index]
    if (key === '--replace') {
      replace = true
      continue
    }
    const value = process.argv[index + 1]
    if (!key?.startsWith('--') || !value) fail('Use --workflow-id value --input path and optional --replace.')
    values[key.slice(2)] = value
    index += 1
  }
  if (!values['workflow-id'] || !values.input) fail('Both --workflow-id and --input are required.')
  return { values, replace }
}

function visit(value, callback) {
  callback(value)
  if (Array.isArray(value)) value.forEach((item) => visit(item, callback))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => visit(item, callback))
}

const { values, replace } = argumentsFromCommandLine()
if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(values['workflow-id'])) fail('Workflow ID is invalid.')
const root = resolve(import.meta.dirname, '..')
const packPath = resolve(root, values.pack ?? 'config/workflow-pack.candidate.json')
const inputPath = resolve(values.input)
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
if (!String(pack.packVersion).includes('-candidate')) fail('Only a candidate workflow pack may be updated by this tool.')
const workflow = pack.workflows?.find((item) => item.workflowId === values['workflow-id'])
if (!workflow || workflow.engine !== 'comfyui') fail('The selected ID is not a candidate ComfyUI workflow.')
const prompt = JSON.parse(readFileSync(inputPath, 'utf8'))
if (!prompt || Array.isArray(prompt) || typeof prompt !== 'object') fail('The file is not a ComfyUI API-format prompt object.')
const nodes = Object.values(prompt)
if (nodes.length < 1 || nodes.length > 500) fail('The workflow node count is outside the reviewed limit.')
const allowedParameters = new Set(workflow.parameters.map((parameter) => parameter.key))
const nodeTypes = new Set()
for (const node of nodes) {
  if (!node || typeof node !== 'object' || typeof node.class_type !== 'string' || !node.inputs || typeof node.inputs !== 'object') {
    fail('Every API workflow node must contain class_type and inputs.')
  }
  nodeTypes.add(node.class_type)
}
visit(prompt, (value) => {
  if (typeof value !== 'string') return
  if (/^https?:\/\//i.test(value) || /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\') || value.includes('../')) {
    fail('The workflow contains a URL or unsafe filesystem path.')
  }
  if (value.startsWith('$PARAM:') && !allowedParameters.has(value.slice(7))) fail(`Unknown parameter placeholder: ${value}`)
  if (value.startsWith('$INPUT:') && !/^\$INPUT:\d+$/.test(value)) fail(`Invalid input placeholder: ${value}`)
  if (value.startsWith('$') && !value.startsWith('$PARAM:') && !value.startsWith('$INPUT:')) fail(`Unknown workflow placeholder: ${value}`)
})
const targetDirectory = resolve(dirname(packPath), 'workflows', 'candidate')
const targetPath = resolve(targetDirectory, `${workflow.workflowId}.api.json`)
if (existsSync(targetPath) && !replace) fail(`${basename(targetPath)} already exists. Use --replace only after deliberate review.`)
mkdirSync(targetDirectory, { recursive: true })
const templateOutput = `${JSON.stringify(prompt, null, 2)}\n`
const templateHash = createHash('sha256').update(templateOutput).digest('hex')
workflow.templatePath = `workflows/candidate/${workflow.workflowId}.api.json`
workflow.templateSha256 = templateHash
workflow.allowedNodeTypes = [...nodeTypes].sort()
const packOutput = `${JSON.stringify(pack, null, 2)}\n`
const templateTemporary = `${targetPath}.${process.pid}.tmp`
const packTemporary = `${packPath}.${process.pid}.tmp`
writeFileSync(templateTemporary, templateOutput, { encoding: 'utf8', flag: 'wx' })
writeFileSync(packTemporary, packOutput, { encoding: 'utf8', flag: 'wx' })
renameSync(templateTemporary, targetPath)
renameSync(packTemporary, packPath)
console.log(`Imported candidate workflow ${workflow.workflowId}.`)
console.log(`Template SHA-256: ${templateHash}`)
console.log(`Review these node types before qualification: ${[...nodeTypes].sort().join(', ')}`)

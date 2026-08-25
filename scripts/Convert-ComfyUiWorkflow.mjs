#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const VIRTUAL_PRIMITIVES = new Set([
  'PrimitiveBoolean',
  'PrimitiveFloat',
  'PrimitiveInt',
  'PrimitiveString',
  'PrimitiveStringMultiline'
])

const WIDGET_INPUT_SCHEMAS = new Map([
  ['LoadImage', ['image', null]],
  ['LoadVideo', ['video', null]],
  ['SaveVideo', ['video', 'filename_prefix', 'format', 'codec']],
  ['UNETLoader', ['unet_name', 'weight_dtype']],
  ['CLIPLoader', ['clip_name', 'type', 'device']],
  ['ManualSigmas', ['sigmas']],
  ['LoadVideoDepthAnythingModel', ['model_name']],
  ['StringContains', ['string', 'substring', 'case_sensitive']],
  ['ComfyMathExpression', ['expression', 'values.a', 'values.b', 'values.c']],
  ['GemmaAPITextEncode', ['api_key', 'prompt', 'enhance_prompt', 'ckpt_name']],
  ['CreateVideo', ['images', 'audio', 'fps', 'bit_depth']],
  [
    'ResizeImageMaskNode',
    ['input', 'resize_type', 'resize_type.longer_size', 'scale_method']
  ],
  ['EmptyLTXVLatentVideo', ['width', 'height', 'length', 'batch_size']],
  [
    'LTXAddVideoICLoRAGuide',
    [
      'positive',
      'negative',
      'vae',
      'latent',
      'image',
      'frame_idx',
      'strength',
      'latent_downscale_factor',
      'crop',
      'use_tiled_encode',
      'tile_size',
      'tile_overlap'
    ]
  ],
  ['LTXVEmptyLatentAudio', ['frames_number', 'frame_rate', 'batch_size', 'audio_vae']]
])

function fail(message) {
  throw new Error(message)
}

function normalizedLinks(container) {
  return new Map(
    (container.links ?? []).map((link) => {
      if (Array.isArray(link)) {
        const [id, originId, originSlot, targetId, targetSlot, type] = link
        return [id, { id, origin_id: originId, origin_slot: originSlot, target_id: targetId, target_slot: targetSlot, type }]
      }
      return [link.id, link]
    })
  )
}

function inputDefinitions(node, subgraphDefinition) {
  if (subgraphDefinition) {
    const inputs = [...(node.inputs ?? [])]
    for (let index = inputs.length; index < subgraphDefinition.inputs.length; index += 1) {
      const input = subgraphDefinition.inputs[index]
      inputs.push({
        ...input,
        link: null,
        widget: { name: input.name }
      })
    }
    return inputs
  }
  const existing = node.inputs ?? []
  const schema = WIDGET_INPUT_SCHEMAS.get(node.type)
  if (!schema) return existing
  const byName = new Map(existing.map((input) => [input.name, input]))
  const inputs = schema.map((name) => {
    if (!name) {
      return {
        name: 'frontend-only',
        type: 'IMAGEUPLOAD',
        widget: { name: 'frontend-only' },
        link: null
      }
    }
    return (
      byName.get(name) ?? {
        name,
        type: 'WIDGET',
        widget: { name },
        link: null
      }
    )
  })
  inputs.push(...existing.filter((input) => !schema.includes(input.name)))
  return inputs
}

function isFrontendInput(input) {
  return input.type === 'IMAGEUPLOAD' || input.type === 'AUDIOUPLOAD' || input.type === 'AUDIO_UI'
}

function isPromptLink(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    Number.isInteger(value[1])
  )
}

export function applyPromptBindings(prompt, bindings) {
  for (const binding of bindings ?? []) {
    const matches = Object.values(prompt).filter(
      (node) =>
        (!binding.classType || node.class_type === binding.classType) &&
        (!binding.title || node._meta?.title === binding.title)
    )
    const selected =
      binding.occurrence === undefined ? matches : [matches[binding.occurrence]].filter(Boolean)
    if (selected.length !== 1) {
      fail(
        `Binding for ${binding.classType ?? '*'} ${binding.title ?? '*'} matched ${selected.length} nodes.`
      )
    }
    selected[0].inputs[binding.input] = binding.value
  }
  return prompt
}

export function optimizeComfyPrompt(prompt, outputTypes = ['SaveImage', 'SaveVideo']) {
  const outputTypeSet = new Set(outputTypes)
  const resolving = new Set()

  function resolveValue(value) {
    if (!isPromptLink(value)) return value
    const [nodeId, slot] = value
    const node = prompt[nodeId]
    if (!node) fail(`Prompt link references missing node ${nodeId}.`)
    if (resolving.has(nodeId)) fail(`Prompt contains a dependency cycle at node ${nodeId}.`)
    resolving.add(nodeId)
    let replacement
    if (node.class_type === 'StringContains') {
      const string = resolveValue(node.inputs.string)
      const substring = resolveValue(node.inputs.substring)
      const caseSensitive = resolveValue(node.inputs.case_sensitive)
      if (typeof string === 'string' && typeof substring === 'string' && typeof caseSensitive === 'boolean') {
        replacement = caseSensitive
          ? string.includes(substring)
          : string.toLowerCase().includes(substring.toLowerCase())
      }
    } else if (node.class_type === 'ComfyNotNode') {
      const input = resolveValue(node.inputs.value)
      if (typeof input === 'boolean') replacement = !input
    } else if (node.class_type === 'ComfySwitchNode') {
      const condition = resolveValue(node.inputs.switch)
      if (typeof condition === 'boolean') {
        replacement = resolveValue(condition ? node.inputs.on_true : node.inputs.on_false)
      }
    }
    resolving.delete(nodeId)
    return replacement === undefined ? [nodeId, slot] : replacement
  }

  const reachable = new Set()
  function visit(nodeId) {
    if (reachable.has(nodeId)) return
    const node = prompt[nodeId]
    if (!node) fail(`Prompt output references missing node ${nodeId}.`)
    reachable.add(nodeId)
    for (const [input, current] of Object.entries(node.inputs)) {
      const value = resolveValue(current)
      node.inputs[input] = value
      if (isPromptLink(value)) visit(value[0])
    }
  }

  const roots = Object.entries(prompt).filter(([, node]) => outputTypeSet.has(node.class_type))
  if (roots.length === 0) fail('The prompt has no reviewed output node after conversion.')
  roots.forEach(([nodeId]) => visit(nodeId))
  return Object.fromEntries(Object.entries(prompt).filter(([nodeId]) => reachable.has(nodeId)))
}

export function convertComfyUiWorkflow(workflow, options = {}) {
  if (!workflow || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.links)) {
    fail('The source must be a ComfyUI UI-format workflow with nodes and links.')
  }
  const outputTypes = new Set(options.outputTypes ?? ['SaveImage', 'SaveVideo'])
  const definitions = new Map(
    (workflow.definitions?.subgraphs ?? []).map((definition) => [definition.id, definition])
  )
  const prompt = Object.create(null)
  let nextPromptId = 1

  function expandContainer(container, externalInputs = []) {
    const links = normalizedLinks(container)
    const nodes = new Map((container.nodes ?? []).map((node) => [node.id, node]))
    const memo = new Map()
    const expanding = new Set()

    function widgetValues(node) {
      const values = node.widgets_values ?? []
      const inputs = inputDefinitions(node, definitions.get(node.type))
      let widgetIndex = 0
      return inputs.map((input) => {
        if (!input.widget) return undefined
        const value = values[widgetIndex]
        widgetIndex += 1
        return isFrontendInput(input) ? undefined : value
      })
    }

    function resolveLink(linkId) {
      const link = links.get(linkId)
      if (!link) fail(`Workflow link ${linkId} is missing.`)
      return resolveOrigin(link.origin_id, link.origin_slot)
    }

    function resolveOrigin(nodeId, slot) {
      if (nodeId === -10) {
        if (externalInputs[slot] === undefined) fail(`Subgraph input ${slot} is unbound.`)
        return externalInputs[slot]
      }
      const outputs = expandNode(nodeId)
      if (outputs[slot] === undefined) fail(`Node ${nodeId} output ${slot} is unavailable.`)
      return outputs[slot]
    }

    function expandNode(nodeId) {
      if (memo.has(nodeId)) return memo.get(nodeId)
      if (expanding.has(nodeId)) fail(`Workflow contains a dependency cycle at node ${nodeId}.`)
      const node = nodes.get(nodeId)
      if (!node) fail(`Workflow node ${nodeId} is missing.`)
      if ((node.mode ?? 0) !== 0) fail(`Disabled or bypassed node ${nodeId} must be resolved before conversion.`)
      expanding.add(nodeId)

      const inputs = inputDefinitions(node, definitions.get(node.type))
      const values = widgetValues(node)
      const resolvedInputs = inputs.map((input, index) =>
        input.link === null || input.link === undefined ? values[index] : resolveLink(input.link)
      )

      let outputs
      if (VIRTUAL_PRIMITIVES.has(node.type)) {
        const value = resolvedInputs[0] ?? (node.widgets_values ?? [])[0]
        outputs = (node.outputs?.length ? node.outputs : [{}]).map(() => value)
      } else if (node.type === 'Reroute') {
        if (resolvedInputs[0] === undefined) fail(`Reroute node ${nodeId} has no input.`)
        outputs = (node.outputs?.length ? node.outputs : [{}]).map(() => resolvedInputs[0])
      } else if (definitions.has(node.type)) {
        outputs = expandContainer(definitions.get(node.type), resolvedInputs)
      } else {
        const promptId = String(nextPromptId)
        nextPromptId += 1
        const apiInputs = Object.create(null)
        for (let index = 0; index < inputs.length; index += 1) {
          const input = inputs[index]
          const value = resolvedInputs[index]
          if (value !== undefined && value !== null && !isFrontendInput(input)) {
            apiInputs[input.name] = value
          }
        }
        prompt[promptId] = {
          class_type: node.type,
          inputs: apiInputs,
          _meta: { title: node.title ?? node.type }
        }
        outputs = (node.outputs?.length ? node.outputs : [{}]).map((_, slot) => [promptId, slot])
      }

      expanding.delete(nodeId)
      memo.set(nodeId, outputs)
      return outputs
    }

    const outputLinks = (container.links ?? [])
      .map((link) => (Array.isArray(link) ? normalizedLinks(container).get(link[0]) : link))
      .filter((link) => link.target_id === -20)
    if (container !== workflow) {
      return (container.outputs ?? []).map((_, slot) => {
        const link = outputLinks.find((candidate) => candidate.target_slot === slot)
        if (!link) fail(`Subgraph ${container.name ?? container.id} output ${slot} is unbound.`)
        return resolveOrigin(link.origin_id, link.origin_slot)
      })
    }

    const roots = [...nodes.values()].filter((node) => outputTypes.has(node.type))
    if (roots.length === 0) fail(`The workflow has no reviewed output node (${[...outputTypes].join(', ')}).`)
    roots.forEach((node) => expandNode(node.id))
    return []
  }

  expandContainer(workflow)
  return prompt
}

function commandLine() {
  const values = Object.create(null)
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index]
    const value = process.argv[index + 1]
    if (!key?.startsWith('--') || !value) fail('Use --input path --output path.')
    values[key.slice(2)] = value
  }
  if (!values.input || !values.output) fail('Both --input and --output are required.')
  const source = JSON.parse(readFileSync(resolve(values.input), 'utf8'))
  const bindings = values.bindings
    ? JSON.parse(readFileSync(resolve(values.bindings), 'utf8')).bindings
    : []
  const prompt = optimizeComfyPrompt(applyPromptBindings(convertComfyUiWorkflow(source), bindings))
  writeFileSync(resolve(values.output), `${JSON.stringify(prompt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: values.replace === 'true' ? 'w' : 'wx'
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) commandLine()

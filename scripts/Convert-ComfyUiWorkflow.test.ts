import { describe, expect, it } from 'vitest'
import {
  applyPromptBindings,
  convertComfyUiWorkflow,
  optimizeComfyPrompt
} from './Convert-ComfyUiWorkflow.mjs'

describe('ComfyUI UI workflow conversion', () => {
  it('expands subgraphs, collapses virtual inputs, and keeps only output ancestors', () => {
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'PrimitiveStringMultiline',
          mode: 0,
          inputs: [{ name: 'value', type: 'STRING', widget: { name: 'value' }, link: null }],
          outputs: [{ name: 'STRING', type: 'STRING', links: [10] }],
          widgets_values: ['reviewed prompt']
        },
        {
          id: 2,
          type: 'subgraph-one',
          mode: 0,
          inputs: [{ name: 'text', type: 'STRING', widget: { name: 'text' }, link: 10 }],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [11] }],
          widgets_values: ['ignored']
        },
        {
          id: 3,
          type: 'SaveImage',
          mode: 0,
          inputs: [
            { name: 'images', type: 'IMAGE', link: 11 },
            { name: 'filename_prefix', type: 'STRING', widget: { name: 'filename_prefix' }, link: null }
          ],
          outputs: [],
          widgets_values: ['studio/test']
        },
        { id: 4, type: 'MarkdownNote', mode: 0, inputs: [], outputs: [], widgets_values: ['UI only'] }
      ],
      links: [
        [10, 1, 0, 2, 0, 'STRING'],
        [11, 2, 0, 3, 0, 'IMAGE']
      ],
      definitions: {
        subgraphs: [
          {
            id: 'subgraph-one',
            name: 'Nested graph',
            nodes: [
              {
                id: 20,
                type: 'CLIPTextEncode',
                mode: 0,
                inputs: [{ name: 'text', type: 'STRING', widget: { name: 'text' }, link: 21 }],
                outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [22] }],
                widgets_values: ['ignored']
              },
              {
                id: 21,
                type: 'PreviewImage',
                mode: 0,
                inputs: [{ name: 'images', type: 'IMAGE', link: 22 }],
                outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [23] }],
                widgets_values: []
              }
            ],
            links: [
              { id: 21, origin_id: -10, origin_slot: 0, target_id: 20, target_slot: 0, type: 'STRING' },
              { id: 22, origin_id: 20, origin_slot: 0, target_id: 21, target_slot: 0, type: 'CONDITIONING' },
              { id: 23, origin_id: 21, origin_slot: 0, target_id: -20, target_slot: 0, type: 'IMAGE' }
            ],
            inputs: [{ name: 'text', type: 'STRING' }],
            outputs: [{ name: 'IMAGE', type: 'IMAGE' }]
          }
        ]
      }
    }

    const result = convertComfyUiWorkflow(workflow)

    expect(Object.values(result).map((node) => node.class_type)).toEqual([
      'CLIPTextEncode',
      'PreviewImage',
      'SaveImage'
    ])
    expect(result['1'].inputs.text).toBe('reviewed prompt')
    expect(result['3'].inputs.images).toEqual(['2', 0])
    expect(JSON.stringify(result)).not.toContain('MarkdownNote')
  })

  it('rejects missing subgraph bindings and bypassed nodes', () => {
    expect(() =>
      convertComfyUiWorkflow({ nodes: [{ id: 1, type: 'SaveImage', mode: 4, inputs: [], outputs: [] }], links: [] })
    ).toThrow(/Disabled or bypassed/)
  })

  it('binds reviewed placeholders and removes fixed unused network branches', () => {
    const prompt = {
      '1': {
        class_type: 'StringContains',
        inputs: { string: '', substring: 'ltxv_', case_sensitive: true },
        _meta: { title: 'has API key' }
      },
      '2': {
        class_type: 'GemmaAPITextEncode',
        inputs: { api_key: '', prompt: '' },
        _meta: { title: 'network branch' }
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: { text: '' },
        _meta: { title: 'local branch' }
      },
      '4': {
        class_type: 'ComfySwitchNode',
        inputs: { on_false: ['3', 0], on_true: ['2', 0], switch: ['1', 0] },
        _meta: { title: 'source' }
      },
      '5': {
        class_type: 'SaveImage',
        inputs: { images: ['4', 0], filename_prefix: 'studio/test' },
        _meta: { title: 'SaveImage' }
      }
    }

    applyPromptBindings(prompt, [
      { classType: 'CLIPTextEncode', title: 'local branch', input: 'text', value: '$PARAM:prompt' }
    ])
    const optimized = optimizeComfyPrompt(prompt)

    expect(optimized['5'].inputs.images).toEqual(['3', 0])
    expect(optimized['3'].inputs.text).toBe('$PARAM:prompt')
    expect(JSON.stringify(optimized)).not.toContain('GemmaAPITextEncode')
    expect(JSON.stringify(optimized)).not.toContain('StringContains')
  })

  it('passes a linked value through a converted primitive instead of its stale widget value', () => {
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'PrimitiveStringMultiline',
          mode: 0,
          inputs: [{ name: 'value', type: 'STRING', widget: { name: 'value' }, link: null }],
          outputs: [{ name: 'STRING', type: 'STRING', links: [1] }],
          widgets_values: ['current value']
        },
        {
          id: 2,
          type: 'PrimitiveStringMultiline',
          mode: 0,
          inputs: [{ name: 'value', type: 'STRING', widget: { name: 'value' }, link: 1 }],
          outputs: [{ name: 'STRING', type: 'STRING', links: [2] }],
          widgets_values: ['stale value']
        },
        {
          id: 3,
          type: 'SaveImage',
          mode: 0,
          inputs: [{ name: 'images', type: 'IMAGE', link: 2 }],
          outputs: [],
          widgets_values: []
        }
      ],
      links: [
        [1, 1, 0, 2, 0, 'STRING'],
        [2, 2, 0, 3, 0, 'STRING']
      ]
    }

    const result = convertComfyUiWorkflow(workflow)

    expect(result['1'].inputs.images).toBe('current value')
  })
})

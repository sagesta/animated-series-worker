import { describe, expect, it } from 'vitest'
import type { MediaAssetView } from '@studio/contracts'
import { targetedEditInputError, targetedEditParameters } from './targetedEdit'

function image(kind: MediaAssetView['kind'], mimeType = 'image/png'): MediaAssetView {
  return { kind, mimeType } as MediaAssetView
}

describe('targeted Qwen edit request', () => {
  it('requires the immutable parent followed by a region mask', () => {
    const parent = image('character-board')
    const mask = image('region-mask')

    expect(targetedEditInputError([parent, mask])).toBeNull()
    expect(targetedEditInputError([parent])).toMatch(/exactly two approved images/)
    expect(targetedEditInputError([mask, parent])).toMatch(/parent image.*region mask/)
    expect(targetedEditInputError([parent, image('reference-image')])).toMatch(/region mask/)
  })

  it('uses the qualified full-denoise setting for the scarf regression case', () => {
    expect(targetedEditParameters('Change only the scarf from red to deep blue.', 260827)).toEqual({
      instruction: 'Change only the scarf from red to deep blue.',
      seed: 260827,
      strength: 1
    })
  })
})

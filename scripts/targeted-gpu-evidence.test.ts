/* eslint-disable @typescript-eslint/no-require-imports -- tests exercise the CommonJS maintainer runner helper. */
import { describe, expect, it } from 'vitest'

const {
  compareMaskedBitmaps,
  validateDurationProbe,
  verifyUnaffectedWorkflowDefinitions
}: {
  compareMaskedBitmaps: (
    parent: Buffer,
    edited: Buffer,
    mask: Buffer,
    width: number,
    height: number
  ) => {
    passed: boolean
    insideChangedRatio: number
    insideBlueRatio: number
    outsideChangedPixels: number
  }
  validateDurationProbe: (
    probe: { durationSeconds: number; frameCount: number; framesPerSecond?: number },
    requestedDurationSeconds: number,
    framesPerSecond: number
  ) => { passed: boolean; durationErrorSeconds: number; toleranceSeconds: number }
  verifyUnaffectedWorkflowDefinitions: (
    pack: {
      workflows: Array<{
        workflowId: string
        version: string
        templatePath: string | null
        templateSha256: string | null
      }>
    },
    capability: { workflowHashes: Record<string, string> },
    workflowIds: string[]
  ) => { passed: boolean; workflows: Array<{ passed: boolean }> }
} = require('./targeted-gpu-evidence.cjs')

function pixel(blue: number, green: number, red: number): number[] {
  return [blue, green, red, 255]
}

describe('targeted GPU evidence checks', () => {
  it('accepts a blue change only inside the selected region', () => {
    const parent = Buffer.from([...pixel(0, 0, 255), ...pixel(0, 255, 0)])
    const edited = Buffer.from([...pixel(255, 0, 0), ...pixel(0, 255, 0)])
    const mask = Buffer.from([...pixel(255, 255, 255), ...pixel(0, 0, 0)])

    expect(compareMaskedBitmaps(parent, edited, mask, 2, 1)).toMatchObject({
      passed: true,
      insideChangedRatio: 1,
      insideBlueRatio: 1,
      outsideChangedPixels: 0
    })
  })

  it('rejects any pixel change outside the selected region', () => {
    const parent = Buffer.from([...pixel(0, 0, 255), ...pixel(0, 255, 0)])
    const edited = Buffer.from([...pixel(255, 0, 0), ...pixel(255, 255, 255)])
    const mask = Buffer.from([...pixel(255, 255, 255), ...pixel(0, 0, 0)])

    expect(compareMaskedBitmaps(parent, edited, mask, 2, 1)).toMatchObject({
      passed: false,
      outsideChangedPixels: 1
    })
  })

  it.each([1, 2, 4])('accepts %ss output within one frame at 24 fps', (requested) => {
    const result = validateDurationProbe(
      { durationSeconds: requested + 1 / 24, frameCount: requested * 24 + 1 },
      requested,
      24
    )
    expect(result.passed).toBe(true)
  })

  it('rejects the observed 0.75s result for a 1s request', () => {
    expect(
      validateDurationProbe({ durationSeconds: 0.75, frameCount: 9 }, 1, 12).passed
    ).toBe(false)
  })

  it('rejects a mismatched output frame rate', () => {
    expect(
      validateDurationProbe(
        { durationSeconds: 1, frameCount: 12, framesPerSecond: 12 },
        1,
        24
      ).passed
    ).toBe(false)
  })

  it('compares unchanged ComfyUI graphs while treating direct runners as hashless', () => {
    const result = verifyUnaffectedWorkflowDefinitions(
      {
        workflows: [
          {
            workflowId: 'image',
            version: '1.0.0',
            templatePath: 'image.json',
            templateSha256: 'a'.repeat(64)
          },
          {
            workflowId: 'voice',
            version: '1.0.0',
            templatePath: null,
            templateSha256: null
          }
        ]
      },
      { workflowHashes: { 'image@1.0.0': 'a'.repeat(64) } },
      ['image', 'voice']
    )
    expect(result.passed).toBe(true)
    expect(result.workflows).toHaveLength(2)
  })
})

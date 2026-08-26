/* eslint-disable @typescript-eslint/no-require-imports -- Electron maintainer runners load this shared CommonJS helper. */
const { createHash } = require('node:crypto')
const { readFile } = require('node:fs/promises')

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function verifyBaselineArtifacts(summary, excludedTestIds = []) {
  const excluded = new Set(excludedTestIds)
  const tests = []
  for (const test of summary.tests || []) {
    if (excluded.has(test.testId)) continue
    const artifacts = []
    for (const artifact of test.artifacts || []) {
      const bytes = await readFile(artifact.localPath)
      const actualSha256 = sha256(bytes)
      const passed = bytes.byteLength === artifact.byteSize && actualSha256 === artifact.sha256
      artifacts.push({
        name: artifact.name,
        expectedByteSize: artifact.byteSize,
        actualByteSize: bytes.byteLength,
        expectedSha256: artifact.sha256,
        actualSha256,
        passed
      })
    }
    tests.push({
      testId: test.testId,
      workflowId: test.workflowId,
      passed: artifacts.length > 0 && artifacts.every((artifact) => artifact.passed),
      artifacts
    })
  }
  return {
    passed: tests.length > 0 && tests.every((test) => test.passed),
    tests
  }
}

function verifyUnaffectedWorkflowDefinitions(pack, capability, workflowIds) {
  const workflows = workflowIds.map((workflowId) => {
    const workflow = pack.workflows.find((candidate) => candidate.workflowId === workflowId)
    if (!workflow) return { workflowId, passed: false, reason: 'missing-from-current-pack' }
    if (!workflow.templatePath) {
      return {
        workflowId,
        version: workflow.version,
        passed: true,
        templateHashCheck: 'not-applicable'
      }
    }
    const key = `${workflow.workflowId}@${workflow.version}`
    const baselineSha256 = capability.workflowHashes?.[key] ?? null
    return {
      workflowId,
      version: workflow.version,
      currentSha256: workflow.templateSha256,
      baselineSha256,
      passed: Boolean(baselineSha256) && workflow.templateSha256 === baselineSha256
    }
  })
  return {
    passed: workflows.every((workflow) => workflow.passed),
    workflows
  }
}

function compareMaskedBitmaps(parent, edited, mask, width, height) {
  const expectedLength = width * height * 4
  if ([parent, edited, mask].some((value) => value.length !== expectedLength)) {
    throw new Error('Parent, edited output, and mask must have identical RGBA dimensions.')
  }
  let insidePixels = 0
  let insideChangedPixels = 0
  let insideBluePixels = 0
  let outsidePixels = 0
  let outsideChangedPixels = 0
  for (let offset = 0; offset < expectedLength; offset += 4) {
    const selected = (mask[offset] + mask[offset + 1] + mask[offset + 2]) / 3 >= 128
    const changed =
      parent[offset] !== edited[offset] ||
      parent[offset + 1] !== edited[offset + 1] ||
      parent[offset + 2] !== edited[offset + 2]
    if (selected) {
      insidePixels += 1
      if (changed) insideChangedPixels += 1
      const blue = edited[offset]
      const green = edited[offset + 1]
      const red = edited[offset + 2]
      if (blue >= red + 16 && blue >= green + 8) insideBluePixels += 1
    } else {
      outsidePixels += 1
      if (changed) outsideChangedPixels += 1
    }
  }
  if (insidePixels === 0 || outsidePixels === 0) {
    throw new Error('The regression mask must select a bounded region, not zero or every pixel.')
  }
  const insideChangedRatio = insideChangedPixels / insidePixels
  const insideBlueRatio = insideBluePixels / insidePixels
  const outsideChangedRatio = outsideChangedPixels / outsidePixels
  return {
    insidePixels,
    insideChangedPixels,
    insideChangedRatio,
    insideBluePixels,
    insideBlueRatio,
    outsidePixels,
    outsideChangedPixels,
    outsideChangedRatio,
    passed:
      insideChangedRatio >= 0.2 &&
      insideBlueRatio >= 0.2 &&
      outsideChangedPixels === 0
  }
}

function validateDurationProbe(probe, requestedDurationSeconds, framesPerSecond) {
  const durationSeconds = Number(probe.durationSeconds)
  const frameCount = Number(probe.frameCount)
  const reportedFramesPerSecond = Number(probe.framesPerSecond ?? framesPerSecond)
  const toleranceSeconds = 1 / framesPerSecond
  const durationErrorSeconds = Math.abs(durationSeconds - requestedDurationSeconds)
  const frameRateMatches = Math.abs(reportedFramesPerSecond - framesPerSecond) <= 1e-6
  return {
    requestedDurationSeconds,
    durationSeconds,
    frameCount,
    framesPerSecond,
    reportedFramesPerSecond,
    frameRateMatches,
    toleranceSeconds,
    durationErrorSeconds,
    passed:
      Number.isFinite(durationSeconds) &&
      Number.isInteger(frameCount) &&
      frameCount > 0 &&
      frameRateMatches &&
      durationErrorSeconds <= toleranceSeconds + 1e-9
  }
}

module.exports = {
  compareMaskedBitmaps,
  sha256,
  validateDurationProbe,
  verifyBaselineArtifacts,
  verifyUnaffectedWorkflowDefinitions
}

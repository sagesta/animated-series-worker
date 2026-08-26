#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'config/model-install-manifest.candidate.json'), 'utf8'))
const pack = JSON.parse(readFileSync(join(root, 'config/workflow-pack.candidate.json'), 'utf8'))
const review = JSON.parse(readFileSync(join(root, 'config/model-license-review.candidate.json'), 'utf8'))
const promotionPolicy = JSON.parse(readFileSync(join(root, 'config/core-promotion-policy.json'), 'utf8'))
const errors = []

const fail = (message) => errors.push(message)
const sourceKey = (repository, revision) => `${repository}@${revision}`

if (review.candidateManifestVersion !== manifest.manifestVersion) {
  fail('License review and candidate model manifest versions do not match.')
}
if (review.decisionState !== 'pending-authorized-reviewer') {
  fail('Candidate license evidence must stay pending until an authorized reviewer decides it.')
}
if (review.legalAdvice !== false) fail('The evidence record must state that it is not legal advice.')
if (
  promotionPolicy.schemaVersion !== 1 ||
  typeof promotionPolicy.policyVersion !== 'string' ||
  promotionPolicy.policyVersion.trim().length === 0 ||
  promotionPolicy.decision?.status !== 'accepted' ||
  typeof promotionPolicy.decision?.decidedBy !== 'string' ||
  promotionPolicy.decision.decidedBy.trim().length === 0 ||
  Number.isNaN(Date.parse(promotionPolicy.decision?.decidedAt)) ||
  typeof promotionPolicy.decision?.reason !== 'string' ||
  promotionPolicy.decision.reason.trim().length === 0
) {
  fail('The core promotion policy must be accepted, named, dated, and explained.')
}

const manifestSources = new Map()
for (const model of manifest.models) {
  if (model.sha256 !== null || model.licenseReview !== 'required') {
    fail(`Candidate model ${model.modelId} must remain unhashed and license-review-required.`)
  }
  manifestSources.set(sourceKey(model.repository, model.revision), model)
}

const reviewSources = new Map()
const sourceIds = new Set()
for (const source of review.sources ?? []) {
  if (!source.sourceId || sourceIds.has(source.sourceId)) fail(`Duplicate or missing sourceId: ${source.sourceId ?? '<missing>'}`)
  sourceIds.add(source.sourceId)
  if (!Array.isArray(source.licenseEvidenceUrls) || source.licenseEvidenceUrls.length === 0) {
    fail(`License evidence is missing for ${source.sourceId}.`)
  }
  if (!Array.isArray(source.blockers) || source.blockers.length === 0) fail(`A pending blocker is missing for ${source.sourceId}.`)
  if (source.decision?.status === 'accepted') {
    if (
      typeof source.decision.reviewer !== 'string' ||
      source.decision.reviewer.trim().length === 0 ||
      Number.isNaN(Date.parse(source.decision.reviewedAt)) ||
      typeof source.decision.notes !== 'string' ||
      source.decision.notes.trim().length === 0
    ) {
      fail(`Accepted decision for ${source.sourceId} must be named, dated, and explained.`)
    }
  } else if (
    source.decision?.status !== 'pending-authorized-reviewer' ||
    source.decision?.reviewer !== null ||
    source.decision?.reviewedAt !== null
  ) {
    fail(`Pending decision for ${source.sourceId} must remain unnamed and undated.`)
  }
  if (source.manifestSource === true) {
    const key = sourceKey(source.repository, source.revision)
    if (reviewSources.has(key)) fail(`Duplicate manifest-source review: ${key}`)
    reviewSources.set(key, source)
  }
}

const ltxReview = review.sources.find((source) => source.sourceId === 'lightricks-ltx-2.5')
if (
  ltxReview?.decision?.status !== 'accepted' ||
  ltxReview?.useContext?.projectOwnership !== 'individual'
) {
  fail('The recorded LTX-2.5 decision must retain the individual-project acceptance context.')
}

for (const key of manifestSources.keys()) {
  if (!reviewSources.has(key)) fail(`No license evidence covers pinned model source ${key}.`)
}
for (const key of reviewSources.keys()) {
  if (!manifestSources.has(key)) fail(`License evidence references an unpinned manifest source ${key}.`)
}

const excludedWorkflowIds = new Set(promotionPolicy.excludedWorkflowIds ?? [])
if (!Array.isArray(promotionPolicy.excludedWorkflowIds)) {
  fail('The core promotion policy must declare an excludedWorkflowIds array.')
}
for (const workflowId of excludedWorkflowIds) {
  if (!pack.workflows.some((workflow) => workflow.workflowId === workflowId)) {
    fail(`The core promotion policy excludes unknown workflow ${workflowId}.`)
  }
}
const coreModelIds = new Set(
  pack.workflows
    .filter(
      (workflow) =>
        workflow.qualificationTier !== 'advanced' && !excludedWorkflowIds.has(workflow.workflowId)
    )
    .flatMap((workflow) => (workflow.requiredModels ?? []).map((model) => model.modelId))
)
const advancedModelIds = new Set(
  pack.workflows
    .filter(
      (workflow) =>
        workflow.qualificationTier === 'advanced' || excludedWorkflowIds.has(workflow.workflowId)
    )
    .flatMap((workflow) => (workflow.requiredModels ?? []).map((model) => model.modelId))
)
for (const [key, model] of manifestSources) {
  const source = reviewSources.get(key)
  const expectedScopes = new Set()
  for (const candidate of manifest.models.filter((item) => sourceKey(item.repository, item.revision) === key)) {
    if (coreModelIds.has(candidate.modelId)) expectedScopes.add('core')
    if (advancedModelIds.has(candidate.modelId)) expectedScopes.add('advanced')
  }
  for (const scope of expectedScopes) {
    if (!source.qualificationScopes.includes(scope)) fail(`${key} is missing its ${scope} qualification scope.`)
  }
  if (model.repository === 'Lightricks/LTX-2.5' && !source.transitiveSourceIds.includes('google-gemma-4-12b')) {
    fail('LTX-2.5 must retain the transitive Gemma 4 review link.')
  }
}

for (const source of review.sources ?? []) {
  for (const transitiveId of source.transitiveSourceIds ?? []) {
    if (!sourceIds.has(transitiveId)) fail(`${source.sourceId} references missing transitive source ${transitiveId}.`)
  }
}

if (errors.length > 0) {
  console.error('Model-license evidence checks failed:\n')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Model-license evidence checks passed for ${manifestSources.size} pinned sources and ${review.sources.length - manifestSources.size} transitive source.`)

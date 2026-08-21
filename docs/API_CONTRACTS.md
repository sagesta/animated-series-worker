# API and adapter contracts

This document defines behavior and shapes. The current source provides runtime Zod schemas and shared TypeScript types under `packages/contracts` for the implemented project lifecycle, verified backup/restore, no-cost cloud-account setup, protected writing-provider setup, context preview, and local structured proposals. Language-neutral JSON Schemas for worker/media contracts remain worker-phase work and must remain consistent with this document.

## 1. Contract rules

- All identifiers are strings; internal IDs are ULIDs.
- All timestamps are UTC RFC 3339.
- Durations are integer frames plus an explicit frame rate, or integer milliseconds for audio and infrastructure time.
- Content files use SHA-256 hashes.
- Persisted external/worker requests have `schemaVersion`, `requestId`, `projectId`, and `idempotencyKey` where they can cause work or spend. The current local project IPC is schema-validated and writes a schema-versioned manifest but does not pretend to be a paid/durable job request.
- Unknown required fields or unsupported versions fail closed with a useful error.
- Error responses include a stable code, safe message, retry classification, and correlation ID; secrets and provider payloads are redacted.

## 2. Desktop IPC surface

The React renderer can call only methods exposed by the Electron preload layer.

### Implemented in the current source

| Preload method | Internal channel | Purpose |
| --- | --- | --- |
| `system.getStatus()` | `studio:system:get-status` | Read local version/storage/catalog state and explicit cloud lock |
| `projects.list()` | `studio:projects:list` | List valid locally indexed projects |
| `projects.create(input)` | `studio:projects:create` | Validate and create an isolated series/film project |
| `projects.open(projectId)` | `studio:projects:open` | Validate identity and reopen canonical local metadata |
| `projects.listBackups()` | `studio:projects:list-backups` | Return completed backup generations that currently pass manifest, inventory, identity, size, and SHA-256 verification |
| `projects.backup(projectId)` | `studio:projects:backup` | Checkpoint/integrity-check SQLite, copy and flush canonical files, verify the copy, then atomically expose a completed backup |
| `projects.restore(backupId)` | `studio:projects:restore` | Re-verify and restore into an absent canonical project folder without overwriting existing work |
| `projects.getMigrationPreview(projectId)` | `studio:projects:get-migration-preview` | Return the exact current-format change, scope, expected timestamp, backup requirement, and no-data-loss expectation, or `null` when current |
| `projects.migrate(input)` | `studio:projects:migrate` | Refuse a stale preview, verify a pre-migration backup, activate the v1→v2 manifest/SQLite change, and return the retained backup plus updated project |
| `support.recordRendererError(input)` | `studio:support:record-renderer-error` | Record a bounded renderer-boundary failure only after structured secret/path redaction |
| `support.createBundle()` | `studio:support:create-bundle` | Flush recent safe events, re-redact/re-validate them, run the known-secret scan, and save a local-only support JSON without project content or provider payloads |
| `cloud.getStatus()` | `studio:cloud:get-status` | Read opaque RunPod connection, last account check, price catalogue, setup checklist, and saved local limits |
| `cloud.connect({ apiKey })` | `studio:cloud:connect` | Validate the key with `GET /v2/pods`, optionally read the GPU catalogue, then encrypt the key only after validation succeeds |
| `cloud.refresh()` | `studio:cloud:refresh` | Recheck the saved key and current price catalogue without creating a resource |
| `cloud.saveGuardrails(limits)` | `studio:cloud:save-guardrails` | Validate and save non-secret default cost/runtime/idle/concurrency limits locally |
| `cloud.disconnect()` | `studio:cloud:disconnect` | Remove only the protected local key and connection snapshot; never mutate provider resources |
| `writing.getStatus()` | `studio:writing:get-status` | Return opaque OpenAI/Anthropic/Gemini status, the live-available approved model intersection, enablement, and optional local default profile without keys |
| `writing.connect({ provider, apiKey })` | `studio:writing:connect` | Read the provider model list, then replace only that provider's protected key after successful validation |
| `writing.refresh({ provider })` | `studio:writing:refresh` | Recheck the protected key and current model list without a writing request |
| `writing.setEnabled({ provider, enabled })` | `studio:writing:set-enabled` | Disable/enable one provider locally without exposing or deleting its key |
| `writing.disconnect({ provider })` | `studio:writing:disconnect` | Remove one protected key and its non-secret snapshot without touching the other providers |
| `writing.saveDefaultProfile(profile)` | `studio:writing:save-default-profile` | Save an available approved provider/model/depth choice; no task benchmark winner is silently chosen |
| `writing.previewContext(input)` | `studio:writing:preview-context` | Return the exact selected local context text, SHA-256, and source-manifest version before disclosure |
| `writing.generateDraft(request)` | `studio:writing:generate-draft` | Require explicit paid confirmation, call one enabled provider, validate structured output, and save a new local proposal with lineage |
| `writing.listDrafts(projectId)` | `studio:writing:list-drafts` | List only valid proposal records inside the owning project without modifying damaged files |

The preload exposes no generic `send`, listener, filesystem, shell, or provider-resource method. The main process validates that each call comes from the expected top frame and production/development application origin. A submitted API key crosses typed IPC for validation, is cleared from the successful form, and is never returned; success responses contain only opaque state, checked model identifiers, or aggregate cloud counts/prices. Action failures use stable safe codes and do not include provider payloads or the key.

### Planned surface

| Channel family | Purpose |
| --- | --- |
| `project.close` | Remaining project lifecycle behavior |
| `import.preview/apply` | Upstream import with validation and impact preview |
| `asset.createVersion/submitReview/approve/lock/archive` | Versioned creative assets |
| `impact.preview/resolve` | Stale-dependency decisions |
| `job.estimate/authorize/cancel/retry/list` | Durable paid/local work |
| `worker.setup/start/status/stopNow` | Guided cloud control |
| `take.review/approve/reject/retake` | Candidate review |
| `timeline.assemble/validate/export` | Rough cut and delivery |
| `skill.inspect/install/enable/disable/remove/plan` | Permissioned external-skill lifecycle and routing preview |
| `media.open/thumbnail/proxy/compare/playbackState` | Project-scoped local media review without arbitrary filesystem access |
| `animatic.assemble/review/approve/version` | Timed storyboard/dialogue previsualization before bulk generation |
| `controlPack.create/import/validate/bind` | Versioned pose/depth/edge/mask/motion/reference controls |
| `layeredComposite.create/preview/approve` | Immutable-source layer separation and parallax recipe |
| `creativeQc.run/disposition/list` | Assistive evidence warnings without approval authority |
| `audioEffects.generate/import/review/approve` | Rights-aware ambience/effects/foley versions |
| `adaptation.estimate/authorize/train/evaluate/promote` | Explicit project-scoped LoRA candidate lifecycle |
| `releaseProfile.createVersion/bind/list` | Versioned channel/series packaging guidance and explicit project binding |
| `idea.create/importSignals/review/bind` | Source-labelled release idea backlog without automatic production authority |
| `thumbnail.createCandidate/import/preview/validate/select` | Public-facing candidate lineage, deterministic layout, responsive preview, and selection |
| `releaseDetails.draft/validate/select` | Title/description/chapter/caption/category/tag/playlist fields and factual support |
| `releaseReadiness.run/attest/status` | Prerequisite, rights, policy, originality, and human-review gate with explicit paid-probe consent |
| `releasePackage.preview/lock/verify/openFolder` | Immutable hash-inventoried manual-upload package and checklist |
| `performance.attachVideo/import/status` | Manual platform identity and evidence-file import |
| `youtubeReadOnly.connect/status/collect/disconnect` | Optional least-privilege analytics only; no version-1 mutation surface |
| `learning.list/review/applyProspectively` | Evidence-backed proposed constraints with explicit scope and human approval |

The renderer never receives a raw provider key. IPC validates caller, project scope, and payload schema.

## 3. GPU provider interface

```ts
interface GPUProvider {
  validateAccount(): Promise<AccountCapability>;
  listCompatibleOffers(requirement: WorkerRequirement): Promise<GPUOffer[]>;
  estimateLease(request: LeaseRequest): Promise<LeaseEstimate>;
  createLease(request: LeaseRequest): Promise<WorkerLease>;
  reconcileLease(idempotencyKey: string): Promise<WorkerLease | null>;
  getLease(leaseId: string): Promise<WorkerLease>;
  getCost(leaseId: string): Promise<LeaseCost>;
  terminateLease(leaseId: string, reason: string): Promise<TerminationReceipt>;
}
```

`createLease` must tag the provider resource with project, studio session, idempotency key, hard deadline, and worker-image version. A timeout is reconciled by tag before retry.

Version 0.5.0 retains only the non-mutating beginning of this interface: RunPod API v2 `GET /pods` for account/key validation and aggregate existing-Pod status, plus `GET /catalog/gpus` for current catalogue rates. It has no create, start, stop, terminate, template, network-volume, upload, or job method. A read-only check is not evidence that future write permissions or worker compatibility are ready.

## 4. Media-engine interfaces

```ts
interface ImageEngine {
  capabilities(): EngineCapabilities;
  validate(job: NeutralImageJob): ValidationResult;
  estimate(job: NeutralImageJob, hardware: HardwareClass): Estimate;
  compile(job: NeutralImageJob): CompiledWorkflow;
}

interface VoiceEngine {
  capabilities(): EngineCapabilities;
  validate(job: NeutralVoiceJob): ValidationResult;
  estimate(job: NeutralVoiceJob, hardware: HardwareClass): Estimate;
  compile(job: NeutralVoiceJob): CompiledWorkflow;
}

interface VideoEngine {
  capabilities(): EngineCapabilities;
  validate(job: NeutralVideoJob): ValidationResult;
  estimate(job: NeutralVideoJob, hardware: HardwareClass): Estimate;
  compile(job: NeutralVideoJob): CompiledWorkflow;
  compileRetake(job: NeutralRetakeJob): CompiledWorkflow;
}

interface AudioEffectsEngine {
  capabilities(): EngineCapabilities;
  validate(job: NeutralAudioEffectsJob): ValidationResult;
  estimate(job: NeutralAudioEffectsJob, hardware: HardwareClass): Estimate;
  compile(job: NeutralAudioEffectsJob): CompiledWorkflow;
}

interface AdaptationEngine {
  capabilities(): EngineCapabilities;
  validate(job: NeutralAdaptationJob): ValidationResult;
  estimate(job: NeutralAdaptationJob, hardware: HardwareClass): Estimate;
  compileTraining(job: NeutralAdaptationJob): CompiledWorkflow;
  evaluate(candidate: AdaptationArtifact, benchmark: BenchmarkPack): EvaluationResult;
}
```

Neutral jobs contain narrative and media intent, control roles, and immutable asset references—not ComfyUI node IDs. Compiled workflows record the adapter and workflow version that produced them. An unsupported control role, model/profile combination, runtime install request, or unapproved adaptation fails validation before estimation or authorization.

### Control-pack contract

```ts
type ControlRole =
  | 'start_frame'
  | 'end_frame'
  | 'pose'
  | 'depth'
  | 'edge'
  | 'segmentation'
  | 'mask'
  | 'motion_track'
  | 'reference_clip';

interface NeutralControlBinding {
  role: ControlRole;
  assetVersionId: string;
  sha256: string;
  coordinateBasis?: { width: number; height: number };
  frameRange?: { start: number; end: number };
  strengthIntent?: 'subtle' | 'balanced' | 'strict';
  rightsRecordId?: string;
}
```

Control strengths are intent-level values in canonical data. The adapter resolves tested numerical node parameters and records them only in the compiled manifest.

## 4.1 Writing-provider and external-skill contracts

Current version 0.5.0 implements the safe first subset: `develop_character`, `build_world`, `outline_episode`, `draft_scene`, `rewrite_dialogue`, and `check_continuity`; balanced/deep/custom depth; exact manifest-context preview/hash; structured output through OpenAI Responses, Anthropic Messages, and Gemini GenerateContent; and immutable proposal records with provider/model/profile, source versions, token usage, request ID, and dollar-cost state `not-calculated`. The release-controlled catalogue is intersected with each key's live model list before selection. The implemented request requires `paidConfirmed: true`. The current proposal contract requires empty skill-plan/skill-use arrays because the external-skill runtime is still locked. Story/season/board compilation, estimate/actual dollar profiles, skill execution, selective canon promotion, and approved creative versions remain the target contract below, not implemented behavior.

```ts
type WritingTaskKind =
  | 'develop_story'
  | 'develop_character'
  | 'develop_world'
  | 'outline_season'
  | 'outline_episode'
  | 'draft_scene'
  | 'rewrite_dialogue'
  | 'check_continuity'
  | 'compile_storyboard';

interface WritingProvider {
  validateAccount(): Promise<OpaqueWritingAccountStatus>;
  capabilities(): WritingCapabilities;
  estimate(task: NeutralWritingTask, skillPlan: SkillPlan): Promise<WritingEstimate>;
  generate(task: NeutralWritingTask, skillPlan: SkillPlan): Promise<WritingDraftResult>;
}

interface ExternalSkillManifest {
  schemaVersion: 1;
  skillId: string;
  version: string;
  displayName: string;
  source: SkillSource;
  packageSha256: string;
  signatureStatus: 'verified' | 'unverified' | 'invalid';
  taskKinds: WritingTaskKind[];
  instructionsEntry: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  requestedPermissions: SkillPermission[];
  executionClass: 'declarative' | 'local_tool' | 'remote_tool' | 'comfy_node';
  compatibility: SkillCompatibility;
}

interface SkillPlan {
  taskKind: WritingTaskKind;
  required: PlannedSkill[];
  optional: PlannedSkill[];
  excluded: Array<{ skillId: string; reason: string }>;
  approvedPermissionGrantIds: string[];
}

interface SkillExecutionReceipt {
  receiptId: string;
  skillId: string;
  skillVersion: string;
  packageSha256: string;
  executionClass: ExternalSkillManifest['executionClass'];
  inputHashes: string[];
  toolCalls: SanitizedToolCall[];
  outputSha256: string;
  status: 'succeeded' | 'failed' | 'timed_out' | 'blocked';
  startedAt: string;
  completedAt: string;
}
```

`NeutralWritingTask` references explicit local versions and contains only the context approved for that request. `WritingDraftResult` contains schema-validated proposals, provider/model/profile identity, token usage, estimate/actual API cost where supplied, and exact skill receipts. A draft cannot claim a required skill unless a matching successful receipt exists. Provider response/conversation IDs are lineage metadata, never the canonical story store.

API adapters may compile declared skills into provider tool/function definitions or task instructions. The studio router—not the model alone—determines the allowed skill set, validates calls/results, and rejects unapproved tools. Raw provider keys are injected only inside the main-process adapter and never appear in these contracts.

## 5. Worker gateway

Base path: `/v1`. Transport must be encrypted and authenticated with a short-lived session token bound to the lease and project.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Process health; no model load required |
| `GET /ready` | Runtime, mount, GPU, disk, and core workflow readiness |
| `GET /capabilities` | Exact worker image, GPU, model, workflow, and schema versions |
| `POST /uploads` | Resumable, size-limited input upload with expected hash |
| `POST /jobs` | Validate and enqueue a signed compiled job |
| `GET /jobs/{id}` | Durable status, progress, timing, and sanitized errors |
| `DELETE /jobs/{id}` | Request safe cancellation |
| `GET /jobs/{id}/events` | Ordered progress stream or cursor-based polling |
| `GET /artifacts/{id}` | Download with size, MIME type, and hash headers |
| `POST /drain` | Refuse new jobs and finish/cancel according to policy |
| `POST /purge` | Delete the session's temporary project data after sync proof |
| `POST /shutdown` | Begin local shutdown; provider termination remains authoritative |

### Example compiled video job

```json
{
  "schemaVersion": 1,
  "requestId": "01JREQ...",
  "projectId": "01JPROJ...",
  "idempotencyKey": "sha256:...",
  "jobId": "01JJOB...",
  "jobType": "video.ltx.a2v",
  "workflow": {
    "id": "ltx-a2v-dialogue",
    "version": "1.0.0",
    "sha256": "..."
  },
  "engine": {
    "name": "ltx-2.5",
    "modelRevision": "pinned-revision",
    "modelSha256": "..."
  },
  "inputs": [
    { "role": "first_frame", "assetId": "01JIMG...", "sha256": "..." },
    { "role": "locked_dialogue", "assetId": "01JAUD...", "sha256": "..." },
    { "role": "motion_track", "assetId": "01JCTRL...", "sha256": "..." }
  ],
  "intent": {
    "durationFrames": 121,
    "frameRate": { "numerator": 24, "denominator": 1 },
    "width": 960,
    "height": 544,
    "camera": "slow push toward the speaker",
    "action": "The character listens, answers calmly, then lowers their eyes.",
    "continuity": ["CHAR-A-v3", "STYLE-v2", "LOC-KITCHEN-v4"],
    "animaticVersionId": "01JANIM...",
    "controlPackVersionId": "01JCPACK..."
  },
  "output": {
    "container": "mp4",
    "requireAudioPreservation": true
  },
  "limits": {
    "deadline": "2026-08-21T12:30:00Z",
    "maxRuntimeSeconds": 900,
    "maxOutputBytes": 1073741824
  }
}
```

## 6. Worker job states and events

Worker states: `accepted`, `validating`, `waiting`, `loading`, `running`, `encoding`, `artifact_ready`, `succeeded`, `cancelled`, `failed`, `expired`.

Event envelope:

```json
{
  "schemaVersion": 1,
  "sequence": 27,
  "timestamp": "2026-08-21T10:10:00Z",
  "jobId": "01JJOB...",
  "type": "job.progress",
  "data": { "phase": "sampling", "completed": 6, "total": 8 }
}
```

Sequences are monotonically increasing per job so the desktop can resume after disconnect.

## 7. Artifact contract

Each artifact response and manifest provides:

- Artifact ID, role, MIME type, byte size, SHA-256.
- Producing job ID and workflow/model versions.
- Media probe: dimensions, duration, frames, frame rate, codec, audio streams, sample rate.
- QC summary and warnings.
- Creative-QC observations contain checker version, confidence, evidence frame/time references, and reviewer disposition but no approval state.
- Audio-effects artifacts declare their independent timeline role and cannot claim a dialogue or music role.
- Adaptation artifacts include dataset/base-model/training hashes and candidate evaluation; only promoted project-scoped versions can appear in production inputs.
- Local download state and verified local path are recorded by the desktop, not trusted from the worker.

Media artifacts additionally distinguish an immutable `original` from rebuildable `derivatives` such as thumbnails, poster frames, waveforms, and review proxies. Each derivative records its source hash, recipe/version, MIME type, dimensions/duration, and its own hash. The renderer receives only project-authorized `studio://media/...` handles, never arbitrary local paths.

## 7.1 Release-package and learning contracts

Release requests include `projectId`, release-profile or project-local-brief ID/version, expected input versions, ruleset version, and an idempotency key for package locking. A package request fails when the master/captions/thumbnail/details/attestation/QC inputs are stale, unapproved, missing, wrong-project, or changed since preview.

```ts
interface ReleasePackageService {
  preview(input: ReleasePackagePreviewInput): Promise<ReleasePackagePreview>;
  lock(input: ReleasePackageLockInput): Promise<ReleasePackageVersion>;
  verify(releasePackageId: string): Promise<InventoryVerification>;
}

interface PerformanceEvidenceProvider {
  validateReadOnlyAccount(): Promise<ReadOnlyChannelCapability>;
  collect(input: PerformanceWindowRequest): Promise<PerformanceSnapshot>;
  disconnect(): Promise<void>;
}
```

The version-1 YouTube evidence adapter, if O-009 enables it, is structurally incapable of inserting/updating/deleting videos, thumbnails, captions, playlists, schedules, or comments. OAuth scopes are allowlisted, stored through the credential vault, and never returned to the renderer. File imports pass schema, size, metric, date/window, channel/profile, duplicate, and content-safety validation before becoming evidence.

`ThumbnailCandidateVersion`, `ReleaseDetailsVersion`, `ReleaseAttestationVersion`, `ReleasePackageVersion`, `PerformanceSnapshot`, and `LearningRecommendation` use strict versioned schemas. A candidate-review record cannot contain an experiment winner unless it cites an accepted platform-result artifact for the exact candidate hashes. A learning approval creates only a prospective, scope-limited constraint; no contract permits it to mutate a locked creative or release record or authorize a paid job.

## 8. Upstream adapter contract

The adapter exposes stable studio operations:

```ts
interface UpstreamSkillsAdapter {
  inspectVersion(): Promise<UpstreamVersion>;
  validate(kind: UpstreamKind, sourcePath: string): Promise<ValidationReport>;
  import(kind: UpstreamKind, sourcePath: string): Promise<NormalizedImport>;
  renderReport(kind: UpstreamKind, sourcePath: string, language: string): Promise<ReportArtifact>;
  runCompatibilitySuite(): Promise<CompatibilityReport>;
}
```

The adapter executes scripts from the pinned path, never imports private modules, and applies time/output limits. Imported files are copied into the project source area with hashes before normalization.

Normalization rules include:

- Preserve upstream C/S/P/E IDs as source aliases, not global studio IDs.
- Convert episode duration into frames at the selected delivery profile.
- Preserve source language and evidence fields.
- Convert upstream segments/cuts into suggestions, then allow long-form pacing and non-generated production methods.
- Preserve `h3Prompt` as provenance; do not compile it as LTX instructions.
- Keep upstream validation results distinct from studio long-form validation.

## 9. Error contract

```json
{
  "schemaVersion": 1,
  "error": {
    "code": "WORKER_CAPABILITY_MISMATCH",
    "message": "This worker does not have enough verified GPU memory for the selected final-quality workflow.",
    "safeNextAction": "Choose another compatible GPU or switch this batch to Draft quality.",
    "retry": "after_user_change",
    "correlationId": "01JCORR...",
    "details": { "requiredVramGb": 32, "verifiedVramGb": 24 }
  }
}
```

Retry classifications: `never`, `automatic_safe`, `after_delay`, `after_reconcile`, `after_user_change`, `after_support_review`.

## 10. Compatibility rules

- Major schema versions must match exactly.
- Minor additions are allowed only when declared backward compatible and ignored safely.
- Worker readiness includes a signed capability document; the desktop compares it against the batch before uploading large files.
- A workflow/model hash mismatch blocks paid execution.
- Provider rate changes refresh the estimate and may require renewed user authorization.
- Writing-provider model/profile changes create new draft lineage; they never mutate an approved creative version in place.
- External skills are compatible only when skill schema, execution class, permission grant, provider capability, and package hash match the recorded plan.
- A required skill receipt, original artifact hash, or local media authorization mismatch fails closed.
- A production worker rejects runtime dependency installation, unknown control roles, unsupported LTX profile/version combinations, and unapproved adaptation artifacts.
- LTX-2.3-only or otherwise unvalidated Dub-It/Foley adapters cannot be silently compiled into the LTX-2.5 profile.
- Creative-QC and ASR results cannot call asset approval, take approval, release lock, or destructive media methods.
- Contract changes update this document, JSON Schema, generated types, contract tests, traceability, and changelog together.

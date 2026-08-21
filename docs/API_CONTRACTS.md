# API and adapter contracts

This document defines behavior and shapes. Version 0.3.0 provides runtime Zod schemas and shared TypeScript types under `packages/contracts` for the implemented project lifecycle and no-cost cloud-account setup. Language-neutral JSON Schemas for worker/media contracts remain worker-phase work and must remain consistent with this document.

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

### Implemented in version 0.3.0

| Preload method | Internal channel | Purpose |
| --- | --- | --- |
| `system.getStatus()` | `studio:system:get-status` | Read local version/storage/catalog state and explicit cloud lock |
| `projects.list()` | `studio:projects:list` | List valid locally indexed projects |
| `projects.create(input)` | `studio:projects:create` | Validate and create an isolated series/film project |
| `projects.open(projectId)` | `studio:projects:open` | Validate identity and reopen canonical local metadata |
| `cloud.getStatus()` | `studio:cloud:get-status` | Read opaque RunPod connection, last account check, price catalogue, setup checklist, and saved local limits |
| `cloud.connect({ apiKey })` | `studio:cloud:connect` | Validate the key with `GET /v2/pods`, optionally read the GPU catalogue, then encrypt the key only after validation succeeds |
| `cloud.refresh()` | `studio:cloud:refresh` | Recheck the saved key and current price catalogue without creating a resource |
| `cloud.saveGuardrails(limits)` | `studio:cloud:save-guardrails` | Validate and save non-secret default cost/runtime/idle/concurrency limits locally |
| `cloud.disconnect()` | `studio:cloud:disconnect` | Remove only the protected local key and connection snapshot; never mutate provider resources |

The preload exposes no generic `send`, listener, filesystem, shell, or provider-resource method. The main process validates that each call comes from the expected top frame and production/development application origin. The submitted API key crosses the typed IPC boundary once for validation; success responses contain only opaque state and aggregate counts/prices. Action failures use stable safe codes and do not include provider payloads or the key.

### Planned surface

| Channel family | Purpose |
| --- | --- |
| `project.close` | Remaining project lifecycle behavior |
| `project.backup/restore/verify` | Safe recovery |
| `import.preview/apply` | Upstream import with validation and impact preview |
| `asset.createVersion/submitReview/approve/lock/archive` | Versioned creative assets |
| `impact.preview/resolve` | Stale-dependency decisions |
| `job.estimate/authorize/cancel/retry/list` | Durable paid/local work |
| `worker.setup/start/status/stopNow` | Guided cloud control |
| `take.review/approve/reject/retake` | Candidate review |
| `timeline.assemble/validate/export` | Rough cut and delivery |
| `support.bundle.create` | Redacted diagnostics |

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

Version 0.3.0 implements only the non-mutating beginning of this interface: RunPod API v2 `GET /pods` for account/key validation and aggregate existing-Pod status, plus `GET /catalog/gpus` for current catalogue rates. It has no create, start, stop, terminate, template, network-volume, upload, or job method. A read-only check is not evidence that future write permissions or worker compatibility are ready.

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
```

Neutral jobs contain narrative and media intent, not ComfyUI node IDs. Compiled workflows record the adapter and workflow version that produced them.

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
    { "role": "locked_dialogue", "assetId": "01JAUD...", "sha256": "..." }
  ],
  "intent": {
    "durationFrames": 121,
    "frameRate": { "numerator": 24, "denominator": 1 },
    "width": 960,
    "height": 544,
    "camera": "slow push toward the speaker",
    "action": "The character listens, answers calmly, then lowers their eyes.",
    "continuity": ["CHAR-A-v3", "STYLE-v2", "LOC-KITCHEN-v4"]
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
- Local download state and verified local path are recorded by the desktop, not trusted from the worker.

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
- Contract changes update this document, JSON Schema, generated types, contract tests, traceability, and changelog together.

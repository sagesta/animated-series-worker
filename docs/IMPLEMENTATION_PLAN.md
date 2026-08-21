# Full implementation plan

## 1. Delivery strategy

Build vertical, testable slices. The first meaningful output is a representative 60–90 second pilot, not a partially implemented 30-minute workflow. Every phase has an exit gate; work may prototype ahead, but the product cannot claim the later capability until the earlier evidence passes.

## 2. Phase map

```mermaid
flowchart LR
    P0[0 Baseline and benchmarks] --> P1[1 Local foundation]
    P1 --> P2[2 Upstream normalization]
    P2 --> P3[3 Bibles and images]
    P3 --> P4[4 Voices and lines]
    P4 --> P5[5 Cloud worker automation]
    P5 --> P6[6 LTX video and review]
    P6 --> P7[7 Timeline, sound, captions, export]
    P7 --> P8[8 Multiple series, concurrency, recovery]
    P8 --> P9[9 Installer and production release]
```

## 3. Phase 0 — lock the evidence baseline

### Deliverables

- Confirm current documents with the product owner.
- Inventory local Windows hardware, free disk, backup location, internet constraints, and target language/style.
- Lock the initial compatibility candidates: Node/Electron, Python/CUDA, ComfyUI, Qwen image, Qwen3-TTS, LTX, FFmpeg, RunPod region/GPU classes.
- Build a representative test pack with characters, locations, dialogue, movement, hands/props, two-person shots, retake, and lip repair.
- Record source/license snapshots and exact revisions.
- Estimate model cache and local project storage.
- Decide the exact 60–90 second end-to-end pilot scene.

### Spikes

1. Qwen character/reference consistency.
2. Qwen3-TTS designed/reusable voice consistency and local-vs-remote feasibility.
3. LTX draft/final, I2V, A2V, keyframe, retake, and lip-dub on candidate GPUs.
4. RunPod template/network-volume startup and termination.
5. FFmpeg delivery profile and media probes.

### Exit gate

- Selected model/workflow/GPU combinations have exact pins and measured results.
- Commercial-use/license review is recorded for intended use.
- Pilot quality is plausible and cost assumptions are replaced with measurement ranges.
- No unresolved blocker makes the architecture knowingly infeasible.

## 4. Phase 1 — local application foundation

### Current checkpoint — version 0.2.0

- `FOUND-001` is implemented as a development foundation: pinned pnpm/Electron/React/TypeScript workspace, secure desktop boundary, accessible navigation/wizard baseline, quality commands, production build, unpacked Windows smoke, and unsigned NSIS test installer.
- `DATA-001` is in progress: series/film create, list, open, schema-1 manifest, identity-scoped folders, atomic manifest write/hash, per-project SQLite, rebuildable catalog, and startup reconciliation are implemented and tested.
- Phase 1 is **not complete**. Credential vault, structured redacted logging/support bundle, interruption tests, real migration preview/rollback, backup/restore, single-writer protection, signed installer, and clean-machine usability evidence remain.

### Build

- Set up pnpm workspace, TypeScript configuration, formatting/linting, unit tests, and release versioning.
- Create Electron main, secure preload, React renderer, routing, UI kit, accessibility baseline, and error boundary.
- Implement project creation/open/close and project types.
- Implement project files, SQLite index, atomic writes, file hashes, schema versions, migrations, and startup reconciliation.
- Implement Windows Credential Manager adapter.
- Implement structured redacted logging and local support bundle foundation.
- Implement documentation/link/traceability checks in standard quality command.

### Exit gate

- Packaged development build creates and reopens series and film projects.
- Project isolation, atomic-write interruption, SQLite integrity, credential non-leakage, and migration rollback tests pass.
- A clean machine/user profile can launch the packaged shell without a developer environment.

## 5. Phase 2 — upstream skills adapter and long-form normalization

### Build

- Implement read-only submodule version inspector and adapter process runner.
- Add contract fixtures for all six skills plus combined report.
- Import original JSON/reports into immutable project source folders.
- Parse/normalize outline, characters, art, script, storyboard, and shot recipe data.
- Add project-scoped ID mapping and source-alias registry.
- Add long-form episode acts/sequences and engine-neutral shot-plan conversion.
- Preserve H3 prompts as source provenance, not executable LTX data.
- Implement plain-language validation and import preview/apply.
- Add upstream compatibility suite and update/rollback report.

### Exit gate

- Pinned upstream fixtures validate and normalize deterministically.
- Long-form conversion supports a 20–35 minute episode structure without editing upstream files or weakening its own validations.
- Upstream update candidate can fail compatibility and roll back cleanly.
- English UI can display normalized facts while preserving upstream source language/evidence.

## 6. Phase 3 — bibles, continuity, and image production

### Build

- Implement versioned characters, styles, locations, props, wardrobe, approvals, locks, dependency edges, and impact preview.
- Implement Qwen image adapter and worker workflows selected in Phase 0.
- Add candidate comparison, targeted edit, image metadata, hashes, and manifests.
- Implement required identity-pack checklist and consistency test pack.
- Add visual board, continuity table, and source/reference binding.
- Add stale propagation from bible changes.

### Exit gate

- Lead identity pack is approved across required views, two environments, expressions, and multi-character test.
- A locked style/character/location change marks exactly the expected downstream fixtures stale.
- Image jobs are reproducible at the manifest level and do not cross projects.
- No bulk-video-ready shot can reference an unlocked lead identity.

## 7. Phase 4 — voice, line book, and captions source

### Build

- Implement voice origin/rights records, versioned voice profiles, calibration lines, and locks.
- Implement Qwen3-TTS adapter, reusable conditioning, line-level batches, delivery controls, and pronunciation dictionary.
- Store original WAV and derived normalized audio separately.
- Implement line review/retake, timing, waveform preview, and caption cue source.
- Add voice/line dependency and stale propagation.

### Exit gate

- Two recurring voices pass identity, language, delivery, and pronunciation test pack.
- Regenerating unrelated lines does not alter approved lines.
- A pronunciation change makes only affected audio/video/caption dependencies stale.
- Consent-required reference voice cannot reach release readiness without evidence.

## 8. Phase 5 — automatic RunPod worker

### Build

- Build and sign versioned worker Docker image and capability manifest.
- Implement gateway routes, short-lived tokens, input hashing, job queue, artifact service, purge, and watchdog.
- Bind ComfyUI/model services to loopback.
- Implement RunPod account check, offer selection, template/volume setup, lease create/reconcile/cost/terminate.
- Implement desktop setup wizard and cloud session screen.
- Implement durable worker leases, independent local/remote limits, sync and termination receipts.
- Add one-GPU smoke jobs for image, TTS, and media QC.

### Exit gate

- One click provisions a tested worker, executes a job, verifies output locally, purges temporary project data, and terminates compute.
- Forced desktop crash and network interruption still respect the hard deadline.
- Create timeout reconciliation proves no duplicate Pod.
- External scan shows no public ComfyUI.
- Actual provider cost is captured and reconciled.

## 9. Phase 6 — LTX video, scheduler, and take review

### Build

- Implement neutral video jobs and LTX compilation for draft/final I2V, A2V, keyframe, retake, lip-dub, and upscale profiles selected in Phase 0.
- Implement audio-preservation and A/V timing checks.
- Implement dependency-aware queue, estimates, budget reservations, retry classes, and changed-hypothesis retake notes.
- Implement shot/take states, A/B review, quality tags, approvals, rejection, targeted repair, and manifest inspector.
- Implement production-method fallbacks and retry stop rules.

### Exit gate

- Representative 60–90 second pilot is produced end to end without terminal/cloud console use.
- Character and voice remain acceptably consistent by human review.
- Failed/retake paths preserve earlier takes and costs.
- Every approved take has complete lineage and actual cost.
- Queue recovers from forced desktop and worker interruption.

## 10. Phase 7 — timeline, sound, captions, QC, and export

### Build

- Implement deterministic rough-cut timeline from approved shot order/duration.
- Add holds, pan/zoom, simple parallax, loops, safe trim/replace, transitions, and title cards.
- Add dialogue, ambience, effects, music layers and derived mix.
- Generate/adjust SRT/VTT from approved line timings.
- Implement FFmpeg render profiles and automated technical QC.
- Implement final human checklist, rights readiness, release lock, export package, and optional editor handoff selected in Phase 0/O-005.

### Exit gate

- Pilot export matches delivery profile and passes media/caption/manifests QC.
- Timeline rebuild from manifests is deterministic.
- Replacing an approved take invalidates/rebuilds only affected timeline/export versions.
- A full human watch signs release readiness.

## 11. Phase 8 — scale, multiple series, concurrency, and disaster recovery

### Build

- Harden many-episode asset/dependency queries and archive views.
- Enable two then three independent workers with budget and compatibility limits.
- Add worker-specific cache paths and result-order independence.
- Add cross-project attack/isolation tests and explicit asset-copy workflow.
- Add incremental backups, release archives, verified restore UI, and clean-machine restore drill.
- Add benchmark dashboard and cost-per-approved-second reporting.
- Produce a representative multi-scene pilot and then a full 20–35 minute validation episode.

### Exit gate

- Multiple series and a one-off film coexist without leakage.
- One-, two-, and three-worker runs produce compatible outputs and accurate total GPU-hour accounting.
- Clean-machine restore passes without network volume.
- Full-length episode meets creative, continuity, technical, recovery, and budget gates.

## 12. Phase 9 — installer and production release

### Build

- Signed Windows installer, upgrade/rollback, prerequisites, and disk checks.
- Guided first-run setup and diagnostics.
- Compatibility-matrix update mechanism with signature verification.
- Release notes, in-app help, recovery guide, and support bundle.
- Threat review, dependency/SBOM scan, license/NOTICE package, and privacy review.
- Release rehearsal from clean computer and clean provider account.

### Exit gate

- Non-technical usability acceptance passes with no terminal assistance.
- Upgrade and rollback preserve active projects.
- Documentation, traceability, security, backup/restore, cost, and release tests pass.
- `STATUS.md` accurately lists production capability and known limitations.

## 13. Critical path and non-negotiable gates

Critical path:

```text
model/provider benchmark
  -> local durable project model
  -> upstream normalization
  -> locked image/voice references
  -> safe automatic worker
  -> LTX pilot
  -> deterministic edit/export
  -> recovery/concurrency
  -> full episode
```

Do not:

- Build the whole editor before proving a generated pilot.
- Generate a season before locking a representative bible and voice.
- Enable multiple GPUs before one-worker recovery/cost accuracy passes.
- adopt a model/update from a moving branch.
- claim “automatic shutdown” without a remote independent test.
- treat a successful render as a successful production workflow without local verification and review.

## 14. Definition of done for every work item

- Requirement and acceptance behavior identified.
- Code/config/workflow implemented behind the correct boundary.
- Unit/contract/integration tests added.
- Failure and rollback behavior tested.
- Secrets and project isolation reviewed.
- Metrics/logging/cost behavior included where relevant.
- Affected user, architecture, contract, operations, sources, status, traceability, and changelog documents updated.
- `node scripts/check-docs.mjs` and the applicable quality suite pass.
- No planned capability is described as complete before evidence exists.

## 15. First implementation backlog

| Order | Work package | Current state | Output |
| --- | --- | --- | --- |
| 1 | `FOUND-001` workspace/toolchain | Foundation implemented; signed/clean-machine release pending | Buildable TypeScript/Electron shell |
| 2 | `DATA-001` project store | In progress | Series/film create/open, files, SQLite, migrations |
| 3 | `SEC-001` credential/logging | Not started | Vault adapter and redacted diagnostics |
| 4 | `UP-001` adapter process runner | Not started | Pinned version and validation contract |
| 5 | `UP-002` normalized domain import | Not started | Long-form project facts and source provenance |
| 6 | `CONT-001` versions/dependencies | Not started | Locks, impact, stale propagation |
| 7 | `BENCH-001` image/voice/video test harness | Not started | Repeatable quality/runtime/cost pack |
| 8 | `WORKER-001` gateway/watchdog | Not started | Secure local GPU smoke worker |
| 9 | `CLOUD-001` RunPod lifecycle | Not started | One-click create/reconcile/terminate |
| 10 | `MEDIA-001` image + voice vertical slice | Not started | Locked character and voice assets |
| 11 | `VIDEO-001` LTX vertical slice | Not started | One reviewed dialogue/motion shot |
| 12 | `PILOT-001` 60–90 second production | Not started | Full end-to-end proof |

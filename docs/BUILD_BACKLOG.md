# Master build backlog

Last updated: 2026-08-21

## 1. Purpose

This is the living ledger of everything still required to turn Animated Series Studio into a dependable, non-technical animation-production application. New accepted requirements, risks, fixes, and release work are added here without deleting earlier work.

The detailed phase order remains authoritative in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Product behavior remains authoritative in [PRD.md](PRD.md). This ledger makes that work small enough to schedule, implement, and verify without losing it between discussions.

## 2. No-loss rules

1. Every accepted new capability, discovered production risk, or required fix receives a stable work-package ID.
2. An item stays in this ledger until it is verified, explicitly superseded, or removed by an accepted product decision.
3. Reprioritizing an item changes its order, not its history.
4. Documentation or code alone does not make an item complete. The named exit proof must exist.
5. A broad package may be split into smaller child items as implementation becomes clearer; the parent remains until all required children pass.
6. ComfyUI success means dependable technical execution inside a tested envelope. Creative quality still requires automated checks plus human approval.

## 3. Status language

| Status | Meaning |
| --- | --- |
| Verified | Implemented and the named acceptance evidence has passed |
| In progress | Some working evidence exists, but required behavior or proof remains |
| Ready | Requirements and dependencies are clear enough to implement next |
| Planned | Accepted work with unresolved earlier dependencies |
| Blocked | Cannot proceed until a named external choice or failed prerequisite is resolved |
| Superseded | Replaced by a recorded decision or another work package; history is retained |

## 4. Current verified checkpoint

Version 0.3.0 provides a working local Windows shell, isolated series/film project creation, protected RunPod-key storage, and read-only RunPod account/pricing checks. It cannot yet provision a GPU, run ComfyUI, generate media, call a writing provider, execute an external creative skill, or assemble an episode.

## 5. Master work stack

| Order | Work package | Phase | Status | Required outcome | Exit proof |
| --- | --- | --- | --- | --- | --- |
| 1 | FOUND-001 desktop foundation completion | 1 | In progress | Stable packaged shell, structured safe errors, support diagnostics, and responsive non-technical UI | Clean-machine launch, accessibility, interruption, and signed-package evidence |
| 2 | DATA-001 durable project store | 1 | In progress | Atomic files, single-writer protection, migrations, archive, backup, restore, and reconciliation | Failure injection, migration rollback, and clean restore pass |
| 3 | SEC-001 complete credential and logging boundary | 1–2 | In progress | Protected RunPod/OpenAI/Anthropic credentials and redacted logs/support bundles | Secret scans and clean-machine persistence/upgrade tests pass |
| 4 | WRITE-001 provider-neutral writing | 2 | Ready | Guided GPT/Claude connection plus structured story, character, world, script, rewrite, and continuity jobs | AT-036 and AT-039 pass with usage/cost lineage |
| 5 | SKILL-001 external creative-skill runtime | 2 | Ready | Safe install, inspection, task routing, required-use enforcement, permissions, validation, and receipts | AT-037 plus extension security suite pass |
| 6 | UP-001 pinned upstream adapter runner | 2 | Planned | Invoke supported shuohao-skills without editing the submodule and preserve exact source evidence | AT-005, AT-006, and update rollback pass |
| 7 | UP-002 long-form normalization | 2 | Planned | Convert upstream reports into local acts, scenes, characters, dialogue, storyboards, and neutral shot intent | Representative 20–35 minute fixture normalizes deterministically |
| 8 | CONT-001 continuity versions and impact engine | 3 | Planned | Version and lock identity, style, wardrobe, voice, locations, props, and dependencies | Stale propagation and scoped redesign AT-003/AT-041 pass |
| 9 | BENCH-001 locked benchmark harness | 0–6 | Planned | Repeatable writing, image, voice, video, lip-sync, GPU-memory, runtime, quality, and cost test pack | Candidate matrix has exact pins and measured comparisons |
| 10 | VIEW-001 in-app media review | 3 | Planned | Secure local galleries and image/audio/video comparison, playback, approval, rejection, and retake | AT-038 and AT-040 pass after worker termination |
| 11 | WORKER-001 authenticated worker gateway and watchdog | 5 | Planned | Pinned Docker worker, short-lived authentication, safe job workspace, purge, and independent hard-stop protection | Gateway/security tests and forced-disconnection termination pass |
| 12 | CLOUD-001 RunPod lifecycle automation | 5 | In progress | Create, reconcile, monitor, sync, purge, terminate, and cost a compatible temporary worker | Full AT-013, AT-015, AT-018, and AT-019 pass |
| 13 | COMFY-001 allowlisted workflow registry and compiler | 5 | Planned | Convert neutral jobs only into approved, versioned, hash-locked ComfyUI API workflows | Invalid graph, unknown workflow, node, model, and hash fixtures are rejected before spend |
| 14 | COMFY-002 runtime compatibility and preflight | 5 | Planned | Pin ComfyUI, custom nodes, Python/CUDA, models, and workflow pack; verify GPU, VRAM, disk, imports, and model hashes at startup | Capability report and one tiny smoke job pass on every allowed GPU class |
| 15 | COMFY-003 headless execution and event bridge | 5 | Planned | Submit workflows without opening ComfyUI and translate queue, progress, preview, success, and error events into plain-language studio states | Mocked and live worker event/timeout/cancellation tests pass |
| 16 | COMFY-004 output verification, retries, and QC handoff | 5–6 | Planned | Download atomically; verify size, MIME, hash, duration, resolution, frames, and audio; classify bounded retries | Corrupt, missing, partial, OOM, timeout, and repeated-creative-failure fixtures reach safe terminal states |
| 17 | COMFY-005 update qualification and rollback | 5–6 | Planned | Test every ComfyUI/node/model/workflow update against the locked pack and retain the last working worker image | Candidate failure leaves production pin unchanged and rollback smoke passes |
| 18 | IMAGE-001 character, style, environment, prop, and storyboard generation | 3–5 | Planned | Qwen generation/editing with reference packs, candidates, targeted corrections, locks, and lineage | Lead consistency board and scoped style-change gate pass |
| 19 | VOICE-001 recurring voice and line-book production | 4–5 | Planned | Qwen3-TTS voice design/authorized reference, reusable conditioning, pronunciation, delivery, and line retakes | Two recurring voices pass identity and pronunciation benchmark |
| 20 | VIDEO-001 LTX shot production | 6 | Planned | Draft/final I2V, A2V, keyframe, retake, and upscale profiles compiled from neutral shot plans | AT-020 and representative shot review pass |
| 21 | LIPSYNC-001 dialogue timing and mouth repair | 4–6 | Planned | Preserve approved speech, select framing-aware sync method, detect timing mismatch, and offer targeted repair | Close, medium, profile, two-person, and off-screen dialogue pack passes human review |
| 22 | COST-001 estimates, limits, reservations, and actual ledger | 5–8 | Planned | Explain and enforce GPU rate, storage, text API, retries, runtime, idle, and total batch limits | Forecast calibration and actual provider reconciliation pass |
| 23 | PILOT-001 60–90 second vertical production | 6 | Planned | Produce one representative sequence from writing through approved image, voice, video, review, and local storage | End-to-end pilot passes without terminal or cloud-console use |
| 24 | EDIT-001 deterministic rough-cut timeline | 7 | Planned | Assemble approved shots with holds, pans, loops, trims, transitions, and replace-safe timing | Timeline rebuild from manifests is deterministic |
| 25 | SOUND-001 dialogue, ambience, effects, and music layers | 7 | Planned | Preserve source audio, create versioned mixes, and track rights/source information | Mix QC and rights-readiness checks pass |
| 26 | CAPTION-001 captions and pronunciation timing | 7 | Planned | Generate editable SRT/VTT from approved script/line timings | Caption overlap, reading-speed, sync, and export tests pass |
| 27 | EXPORT-001 YouTube delivery and editor handoff | 7 | Planned | Render the approved 1080p package, manifest, captions, QC report, and selected interchange format | AT-026–AT-028 pass and full human watch is signed |
| 28 | MULTI-001 multiple-series and one-off-film isolation | 8 | In progress | Keep every project's characters, styles, voices, caches, costs, and outputs separate | Cross-project path/query/token/cache attack tests pass |
| 29 | SCALE-001 two- and three-GPU scheduling | 8 | Planned | Run independent compatible jobs concurrently with deterministic result ordering and hard budget limits | One/two/three-worker benchmark has accurate combined GPU-hours and no collisions |
| 30 | RECOVERY-001 full backup, restore, and disaster drill | 8 | Planned | Restore projects and approved assets without the GPU worker or network model cache | Clean-machine restore and interrupted-job recovery pass |
| 31 | EPISODE-001 representative 20–35 minute validation episode | 8 | Planned | Prove continuity, cost, review load, storage, recovery, and export at the intended duration | Full episode meets creative, technical, recovery, and budget gates |
| 32 | RELEASE-001 non-technical production release | 9 | Planned | Signed installer, first-run guidance, updates, rollback, help, privacy, licenses, and support | Clean-account/clean-machine usability and release rehearsal pass |

## 6. ComfyUI reliability gate

ComfyUI is accepted for production only when all of the following are true:

- The worker uses exact, immutable versions of ComfyUI, custom nodes, Python/CUDA libraries, models, and workflows.
- The gateway refuses arbitrary node graphs, runtime installations, model downloads, file paths, URLs, and shell commands submitted by a job.
- Startup checks the GPU class, verified VRAM, driver/runtime, free disk, model checksums, node imports, workflow hashes, and watchdog deadline.
- A cheap smoke workflow proves that inputs, execution, progress events, output saving, download, media probing, and local indexing all work before a paid batch.
- Execution errors are classified into safe automatic retry, retry after delay/reconciliation, retry after a user change, or never retry.
- An unchanged creative prompt is not retried indefinitely. The studio stops spending and asks for a changed approach or human decision.
- A technically valid render is still only a take. It requires creative review before approval.
- A failed update cannot replace the working production pin, and the previous worker image remains available for rollback.

This gate makes workflow execution dependable; it does not claim that generative media becomes creatively perfect.

## 7. Immediate implementation queue

Unless a safety defect changes priority, implementation proceeds in this order:

1. Finish DATA-001 and SEC-001 reliability foundations.
2. Implement WRITE-001 and SKILL-001 so story/character/script development becomes useful inside the app.
3. Implement UP-001/UP-002 and CONT-001 so creative facts and dependencies are durable before media multiplication.
4. Build BENCH-001 and VIEW-001 before enabling paid generation.
5. Build WORKER-001, the COMFY-001–COMFY-005 stack, and the remaining CLOUD-001 lifecycle behind locked spending gates.
6. Prove IMAGE-001 and VOICE-001 before bulk LTX video.
7. Complete VIDEO-001/LIPSYNC-001 and produce PILOT-001.
8. Add editorial/export work, then concurrency, recovery, the full-length episode, and production release.

## 8. Intake template for future additions

Every newly accepted item is recorded with:

- Stable ID and plain-language outcome.
- Related PRD requirement IDs and phase.
- Dependencies and security/data/spend impact.
- Current status and owner/current task when active.
- Acceptance test or concrete exit proof.
- Migration and rollback needs where applicable.
- Documents and source assumptions that must change.


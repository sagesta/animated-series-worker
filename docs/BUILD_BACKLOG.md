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

The current source provides a working local Windows shell, isolated series/film projects, verified backup/non-overwriting restore, single-writer protection, protected RunPod/OpenAI/Anthropic keys, read-only RunPod checks, and provider-neutral local writing proposals. It cannot yet provision a GPU, run ComfyUI, generate media, execute an external creative skill, promote proposals into versioned canon, or assemble an episode.

## 5. Master work stack

| Order | Work package | Phase | Status | Required outcome | Exit proof |
| --- | --- | --- | --- | --- | --- |
| 1 | FOUND-001 desktop foundation completion | 1 | In progress | Stable packaged shell, structured safe errors, support diagnostics, and responsive non-technical UI | Clean-machine launch, accessibility, interruption, and signed-package evidence |
| 2 | DATA-001 durable project store | 1 | In progress — full verified backup/restore, writer lock, and guided v1→v2 rollback matrix pass locally | Atomic files, single-writer protection, migrations, archive, backup, restore, and reconciliation | Archive/future-migration breadth, incremental/release policy, and clean-machine restore pass |
| 3 | SEC-001 complete credential and logging boundary | 1–2 | In progress — RunPod vault and local redacted diagnostics/support JSON pass | Protected RunPod/OpenAI/Anthropic credentials and redacted logs/support bundles | Broader provider/worker/skill secret scans, retention, and clean-machine persistence/upgrade tests pass |
| 4 | WRITE-001 provider-neutral writing | 2 | In progress — protected setup, structured adapters, context preview, paid-call confirmation, and local proposal lineage pass mocked tests | Guided GPT/Claude connection plus structured story, character, world, script, rewrite, and continuity jobs | Live provider/account switching, actual cost benchmark, canon promotion, and full AT-036/AT-039 pass |
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
| 19 | LAYER-001 layered 2D/parallax assets | 3–7 | Planned | Create/import foreground, subject, background, masks, occlusion, and safe camera bounds without altering the source | AT-044 passes with deterministic composite and repair |
| 20 | ADAPT-001 optional project adaptation | 3–6 | Planned | Train/evaluate a project-scoped character/style LoRA only after the reference-only benchmark fails | AT-048/AT-049 plus dataset rights and rollback pass |
| 21 | VOICE-001 recurring voice and line-book production | 4–5 | Planned | Qwen3-TTS voice design/authorized reference, reusable conditioning, pronunciation, delivery, and line retakes | Two recurring voices pass identity and pronunciation benchmark |
| 22 | ANIMATIC-001 timed pacing preview | 4–7 | Planned | Versioned storyboard/dialogue/caption animatic with timing and dependency impact before bulk video | AT-042 passes without final video generation |
| 23 | CONTROL-001 engine-neutral shot controls | 3–6 | Planned | Version pose/depth/edge/segmentation/mask/motion/reference assets and validate workflow support before spend | AT-043 and rights/isolation tests pass |
| 24 | VIDEO-001 LTX shot production | 6 | Planned | Draft/final I2V, A2V, keyframe, retake, and upscale profiles compiled from neutral shot plans | AT-020 and representative shot review pass |
| 25 | LTXADV-001 advanced LTX profiles | 0–6 | Planned | Benchmark compatible IC-LoRA/reference control, motion tracks, structural control, repair, DFR, temporal upscale, and multishot | AT-045 passes with exact pins, costs, fallbacks, and incompatible paths disabled |
| 26 | LIPSYNC-001 dialogue timing and mouth repair | 4–6 | Planned | Preserve approved speech, select framing-aware sync method, detect timing mismatch, and offer targeted repair | Close, medium, profile, two-person, and off-screen dialogue pack passes human review |
| 27 | CREATIVE-QC-001 assistive review evidence | 6–7 | Planned | Produce identity/continuity/flicker/motion/defect/lip/script-audio warnings with evidence and no approval authority | AT-046 plus authorization security tests pass |
| 28 | COST-001 estimates, limits, reservations, and actual ledger | 5–8 | Planned | Explain and enforce GPU rate, storage, text API, retries, advanced passes, training, runtime, idle, and batch limits | Forecast calibration and actual provider reconciliation pass |
| 29 | PILOT-001 60–90 second vertical production | 6 | Planned | Produce one representative sequence from writing through approved image, voice, animatic, controlled video, QC, review, and local storage | End-to-end pilot passes without terminal or cloud-console use |
| 30 | EDIT-001 deterministic rough-cut timeline | 7 | Planned | Assemble approved shots with holds, pans, loops, trims, transitions, and replace-safe timing | Timeline rebuild from manifests is deterministic |
| 31 | FOLEY-001 rights-aware synchronized effects | 0–7 | Planned | Import/generate separate ambience/effects/foley cues without changing dialogue or music | AT-047 passes and exact engine compatibility is recorded |
| 32 | SOUND-001 dialogue, ambience, effects, and music layers | 7 | Planned | Preserve source audio, create versioned mixes, and track rights/source information | Mix QC and rights-readiness checks pass |
| 33 | CAPTION-001 captions and pronunciation timing | 7 | Planned | Generate editable SRT/VTT from approved script/line timings; ASR is QC only | Caption overlap, reading-speed, sync, and export tests pass |
| 34 | EXPORT-001 master delivery and editor handoff | 7 | Planned | Render the approved 1080p master, production manifest, captions, QC report, rights/credits, and selected interchange format as inputs to release packaging | AT-026–AT-028 pass and full human watch is signed |
| 35 | MULTI-001 multiple-series and one-off-film isolation | 8 | In progress | Keep every project's characters, styles, voices, controls, adaptations, caches, costs, and outputs separate | Cross-project path/query/token/cache/control/dataset attack tests pass |
| 36 | SCALE-001 two- and three-GPU scheduling | 8 | Planned | Run independent compatible jobs concurrently with deterministic result ordering and hard budget limits | One/two/three-worker benchmark has accurate combined GPU-hours and no collisions |
| 37 | RECOVERY-001 full backup, restore, and disaster drill | 8 | Planned | Restore projects and approved assets without the GPU worker or network model cache | Clean-machine restore and interrupted-job recovery pass |
| 38 | EPISODE-001 representative 20–35 minute validation episode | 8 | Planned | Prove continuity, cost, review load, storage, recovery, and export at the intended duration | Full episode meets creative, technical, recovery, and budget gates |
| 39 | RELEASE-001 non-technical production release | 9 | Planned | Signed installer, first-run guidance, updates, rollback, help, privacy, licenses, and support | Clean-account/clean-machine usability and release rehearsal pass |
| 40 | YT-PROFILE-001 channel release profiles | 2–7 | Planned | Version channel promise, audience, packaging voice/visual rules, defaults, project permissions, and explicit multi-series bindings; allow film-local briefs | AT-050 profile/version/isolation scenarios pass |
| 41 | IDEA-001 source-labelled release Idea Library | 2 | Planned | Store manual/research ideas, dated sources, rationale, duplicate/continuity warnings, and human editorial state without production authority | AT-050 proves a signal cannot create/rewrite/queue paid work |
| 42 | THUMB-001 public Thumbnail Room | 7 | Planned | Create/import truthful candidates from approved/authorized sources, apply deterministic typography/layout, preview realistic sizes, validate, and select with lineage | AT-051–AT-052 pass; candidate review cannot claim an experiment winner without platform evidence |
| 43 | YT-META-001 Release Details and discovery validation | 7 | Planned | Draft/select factual titles/descriptions, timeline chapters, captions/languages, category/playlist/tags/hashtags/credits/links/end-screen notes without a universal SEO score | AT-053 passes against versioned official-rule fixtures |
| 44 | YT-POLICY-001 human release attestations | 7 | Planned | Record explicit audience, synthetic-media, truth, originality, rights/credits, and full-watch decisions; unresolved answers block package lock | AT-054 passes and no policy answer is silently defaulted |
| 45 | READY-001 unified Prepared Studio and Release Readiness | 5–7 | Planned | Explain setup, cost, input, stale, QC, rights, policy, and human-decision blockers in one calm view without granting approval | AT-058 and denial/paid-consent tests pass |
| 46 | YT-PACKAGE-001 immutable manual-upload package | 7 | Planned | Lock and verify the exact master, selected thumbnail, details, chapters, captions, rights, attestations, QC, checklist, and hash inventory | AT-055 plus clean-machine package verification pass |
| 47 | YT-ANALYTICS-001 real performance evidence | 8 | Planned | Attach platform identity and import validated official reports; optionally collect through a separately approved least-privilege read-only connector | AT-056 plus OAuth-scope, tamper, duplicate, and cross-project tests pass |
| 48 | YT-LEARN-001 human-approved prospective learning | 8 | Planned | Turn comparable real observations into evidence/confidence-labelled proposals applied only to a chosen future scope | AT-057 proves simulated data cannot enter baselines and recommendations cannot mutate history or spend |
| 49 | YT-PUBLISH-001 optional private upload/scheduling | Post-v1 | Blocked — O-010 | If separately accepted, upload only a reviewed package privately/scheduled with idempotent reconciliation and no public-publish shortcut | Product decision, least-privilege OAuth, duplicate/quota/privacy/rollback tests, and explicit final authorization pass |

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
- Production never installs a missing node/model/package at runtime; optional advanced capabilities are disabled until their exact worker release passes.

This gate makes workflow execution dependable; it does not claim that generative media becomes creatively perfect.

## 7. Immediate implementation queue

Unless a safety defect changes priority, implementation proceeds in this order:

1. Finish DATA-001 and SEC-001 reliability foundations.
2. Implement WRITE-001 and SKILL-001 so story/character/script development becomes useful inside the app, then add the local YT-PROFILE-001/IDEA-001 records without granting them production authority.
3. Implement UP-001/UP-002 and CONT-001 so creative facts and dependencies are durable before media multiplication.
4. Build BENCH-001 and VIEW-001 before enabling paid generation.
5. Build WORKER-001, the COMFY-001–COMFY-005 stack, and the remaining CLOUD-001 lifecycle behind locked spending gates.
6. Prove IMAGE-001, LAYER-001, VOICE-001, ANIMATIC-001, and needed CONTROL-001 paths before bulk LTX video; run ADAPT-001 only if the reference-only benchmark fails.
7. Complete VIDEO-001/LTXADV-001/LIPSYNC-001/CREATIVE-QC-001 and produce PILOT-001.
8. Add EDIT-001/FOLEY-001/SOUND-001/captions/export, then THUMB-001, YT-META-001, YT-POLICY-001, READY-001, and YT-PACKAGE-001.
9. Add validated manual analytics import, then the optional read-only connector and human-approved prospective learning after the security/product decision passes.
10. Complete concurrency, recovery, the full-length episode, and production release. Keep YT-PUBLISH-001 blocked until its separate post-version-1 decision and safety gates pass.

## 8. Intake template for future additions

Every newly accepted item is recorded with:

- Stable ID and plain-language outcome.
- Related PRD requirement IDs and phase.
- Dependencies and security/data/spend impact.
- Current status and owner/current task when active.
- Acceptance test or concrete exit proof.
- Migration and rollback needs where applicable.
- Documents and source assumptions that must change.

# Changelog

All notable changes to Animated Series Studio are recorded here. Each entry must state user impact, data or migration impact, documentation impact, and rollback path.

## Unreleased

### Changed — 2026-08-26 (core worker registry publication)

- Published the exact locally smoke-tested core worker as `ghcr.io/sagesta/animated-series-worker@sha256:875eea3747e89369df5f375aa600bf6de634950c988a82494a2671c0e643603e`. Registry inspection reports config digest `sha256:7ffde53bf446b896596a3ddee68c5527370c1d2c4e8fcd6af33888df9ec7d7c5`, matching the local image ID, and a pull by immutable digest completed with the same image ID.
- Keyless-signed the exact immutable digest with Sigstore and stored the signature as OCI referrer `sha256:47fa41fbdeb19f2821d897826d761f7dd792ae15c4a97d51d18e4cdb318faaec`. Cosign `v3.1.3` verified the digest claim, trusted Google-issued signing certificate, and transparency-log inclusion at Rekor index `2598763822`.
- Added D-053 and a manual-only/main-only `sign-worker-image.yml` canonical signer. It fixes the GHCR package, requires strict manifest/config digests, uses commit-pinned Cosign/login actions, requests only read/OIDC/package-write permissions, binds the `worker-signing` environment, and verifies the exact GitHub workflow identity after signing. Four local policy tests pass; publishing/protecting/dispatching the workflow remains external evidence.
- Kept the image undeployed and release-locked. The canonical workflow still needs publication to `main`, protected-environment configuration, and a successful retained OIDC signing run; signing does not provide model/license approval, model-backed GPU qualification, media-quality proof, provider lifecycle/cost evidence, or a production-readiness receipt, and no RunPod resource was created.

User impact: the core candidate can now be addressed and pulled reproducibly by immutable GHCR digest, but paid generation and production promotion remain locked.

Data/migration impact: no project, canon, media, credential, provider, or deployment state changed. The temporary local upload archive was deleted after the registry and pull verification completed.

Documentation impact: synchronized status, build backlog, local verification, and changelog with the published digest and remaining signature/qualification gates.

Rollback: remove or deprecate the `.3` registry tag and digest reference, then publish a newly built and re-smoked candidate under a new version. Do not reuse the cancelled `.2` upload.

### Changed — 2026-08-25 (smaller core GPU worker and cancelled monolithic upload)

- Cancelled the active GHCR push of `ghcr.io/sagesta/animated-series-worker:0.10.1-candidate.2` after confirming the process was still uploading. A post-cancellation registry inspection returned `manifest unknown`, so no usable candidate tag or digest was published.
- Removed the optional LTX adaptation trainer, its `uv` environment, and CUDA 13.2 runtime from the normal Docker image. Qwen image/TTS, LTX inference, LatentSync, ComfyUI, the authenticated gateway, preflight, and watchdog remain in the core profile.
- Bumped the invalidated candidate to `0.10.1-candidate.3` and bound its declared image name to `ghcr.io/sagesta/animated-series-worker:0.10.1-candidate.3`. The prior local image and interrupted upload cannot qualify or promote this pack.
- Built `.3` locally as `sha256:7ffde53bf446b896596a3ddee68c5527370c1d2c4e8fcd6af33888df9ec7d7c5` at 29,285,117,474 bytes, 6,274,816,227 bytes (17.65%) smaller than `.2`. The model-free authenticated smoke passed with the trainer absent/unavailable, 965 node types, nine workflow hashes, and zero model hashes. The smoke container was removed, `.3` has no `RepoDigest`, and no replacement upload or deployment was started.
- Changed promotion to qualify every core/local workflow and only the models they reference. Advanced native-audio/control/foley/adaptation candidates remain non-billable and are omitted from a core production pack rather than blocking it. The core gate now targets its declared 48 GB maximum instead of inheriting the adaptation trainer's 80 GB/R595 requirement.
- Kept the pinned adaptation contract and trainer source decision as deferred evidence. A future adaptation image must be built, published, tested, and promoted independently only after the reference-only consistency benchmark proves training is needed.

User impact: the ordinary image, voice, video, and lip-repair worker no longer carries an optional training stack or waits for unrelated adaptation evidence. Creator Mode and all spend/approval locks are unchanged; this change still does not unlock or start paid generation.

Data/migration impact: none for projects, canon, media, credentials, or provider state. Candidate pack/model versions and fingerprints changed, invalidating the old local worker evidence. Partially uploaded unreferenced registry blobs may remain subject to registry garbage collection, but there is no published candidate manifest to deploy.

Documentation impact: synchronized PRD, architecture, decisions, worker/GPU operations, implementation, API, security, cost, tests, traceability, backlog, status, local verification, README, and changelog around D-052 and the core-versus-advanced qualification boundary.

Rollback: restore the earlier Dockerfile, candidate pack/manifests, evidence template, and promotion gate together, then rebuild and re-smoke a new candidate. Do not resume or reuse the interrupted `candidate.2` upload; it has no registry digest and belongs to the superseded monolithic pack.

### Added — 2026-08-25 (production completion candidate and executable local proof)

- Added reviewed, converted, hash-locked candidate graphs for native LTX audio-driven dialogue and control-guided Qwen/LTX, plus exact hash-locked runner contracts for rights-aware model-free foley and project-scoped LTX adaptation. The importer now rejects UI-format and unauthorized-node content while the converter preserves only reviewed API semantics.
- Added the official pinned LTX trainer contract and a creator-facing adaptation intake that assembles 4–100 approved project samples with ordered asset IDs, SHA-256 values, captions, resolution buckets, per-sample rights/consent, and project-only confirmations. The worker runner rehashes each uploaded sample and refuses a changed order, identity, or reviewed file; the later D-052 change removes the trainer runtime from the normal core image and defers it to a separate profile.
- Added five bounded public-domain novel excerpts with source metadata and genre/length variation. All five pass the pinned outline and character chunk boundaries; empty, one-character, exact 500,000-character, malformed, missing-field, extra-field, and broken-JSON cases exercise the validator/process boundaries without network access.
- Added bounded YouTube Analytics CSV import in the trusted desktop process. It handles quoted fields, durations, percentages, optional metrics, and explicit total rows; rejects unsafe filenames, oversize/malformed/ambiguous/duplicate rows; records the file SHA-256 and selected row; and keeps saving as a separate creator decision.
- Added real Electron acceptance paths for verified backup/delete/restore with approved lineage, direct cross-project refusal followed by explicit reviewed copy, and immutable release packaging with byte count and SHA-256 verification for every output file. Existing first-run, 1280×720 disclosure, and keyboard correction-summary paths remain in the same suite.
- Added a branded, high-contrast application icon and verified the transparent 32×32 icon embedded in the packaged Windows executable.
- Corrected the supplied Ofibox reference to its intended meaning: workflow, not visual styling. Creator Mode now presents one resumable production run—approved story package, character/location references, storyboard frames, voices/dialogue, video shots, local edit/sound/captions, verified master, and worker cleanup—while the first incomplete checkpoint remains the single primary action. Image, video, audio, composition, and local assembly are available only as a collapsed one-off asset/repair path; their handoff reuses the governed estimate, approval, qualification, and separate-start controls.
- Tightened imported-media integrity so a valid file is still refused when its MIME type does not match the selected production role. Removed ordinary Settings/package displays of local paths.
- Updated the worker compatibility pins: Transformers 5.14.1 avoids the reviewed LTX 5.15 regression, Kornia remains 0.8.2 for the pinned pyramid API, LatentSync uses the upstream-declared Python 3.10 line because `mediapipe==0.10.11` has no Python 3.12 wheel, and Qwen3-TTS now verifies its `sox` executable and common codecs.
- Bound the worker's reported release identity to the built image tag so capability evidence cannot silently retain the Dockerfile's default candidate label.
- Initially closed a promotion-gate gap by requiring all advanced evidence in one atomic pack; the later D-052 change retains strict evidence while separating core promotion from optional advanced/trainer profiles.
- Bumped the complete runtime/workflow/model candidate to `0.10.1-candidate.2`; build and qualification scripts now derive the reported worker release from the selected image tag/pack instead of a stale hard-coded label.
- Built the exact candidate under WSL2 Docker and passed a model-free ComfyUI/gateway smoke on the local 4 GB GPU. Preflight now reports ComfyUI CUDA separately from the NVIDIA driver and captured the exact local image ID, 965 node types, nine workflow hashes, zero model hashes, authentication refusal/readiness, and loopback-only host binding. The local image has no registry digest/signature and does not satisfy model, quality, cloud-lifecycle, cost, or production qualification.
- Rebuilt the branded unsigned NSIS candidate from the final source, recorded its SHA-256, and repeated the isolated-profile launch smoke with four Electron processes.

User impact: the creator sees how the entire film or episode moves from story to a recovered local master and can resume at the first unfinished checkpoint after reopening. A one-off asset can be prepared without abandoning the main run or silently starting work. The app keeps its own visual language and safety model; advanced control, sound, adaptation, analytics, recovery/copy/package, and typed-import behavior remain available. These additions do not unlock or start paid GPU work.

Data/migration impact: performance snapshots gain optional report-file provenance and existing rows parse with `null`; other database tables remain additive/on-demand. Candidate workflow/runtime hashes changed, so prior unqualified images are obsolete. No model weight, license acceptance, RunPod Pod, channel connection, upload, or production receipt was created.

Documentation impact: synchronized implementation, media, YouTube, API/domain, UX, test, traceability, backlog, status, README, and changelog records with the exact local evidence and remaining external gates.

Rollback: close the app and return to the prior 0.10.1 build. Existing projects and older performance rows remain readable. Do not promote or reuse a worker built from an older candidate pack; retain failed build logs as evidence rather than treating them as qualification.

### Fixed — 2026-08-24 (writing requests and simpler creator flow)

- Fixed the confirmed Gemini failure in local diagnostics: three healthy writing requests were being aborted by the app's shared 30-second connection timeout. Model-list checks remain bounded to 30 seconds, while confirmed OpenAI, Anthropic, and Gemini structured drafts now have a separate five-minute ceiling. Short Gemini field suggestions use low thinking and longer production stages use medium thinking.
- Rebuilt the project-aware field assistant as one compact column. It now selects the saved provider/model automatically, asks only what the creator wants, summarizes the included project context, keeps exact text/skills under one optional disclosure, uses the clearly billed Generate action as the request confirmation, and replaces the form with the returned suggestion. Provider/model/depth selectors, the duplicate billing checkbox, giant always-visible context, and empty second pane were removed from the ordinary path.
- Simplified Creator Mode to one derived next step, one primary action, a compact progress bar, and GPU state. The seven-stage map, earlier available stages, proposal detail, and readiness checklist are collapsed until requested; the technical sidebar was removed. The action itself states the selected writing service, possible billing/fallback count, and no-GPU boundary.
- Fixed the optional **Story controls** recovery-screen crash on a fresh installation with no connected writing profile. The room now shows the intended connection handoff instead of dereferencing a missing default model.

User impact: a normal writing task is no longer killed after 30 seconds, and the default creation experience exposes the decision the creator needs now instead of provider, model, canon, skill, and readiness controls. A timed-out request still saves no proposal, changes no project field or canon, and does not trigger a hidden paid retry.

Data/migration impact: none. Existing projects, approved canon/media, proposal history, provider keys/settings, skills, jobs, and release records are unchanged. No live provider request or GPU job was run while implementing this fix; mocked contract/renderer tests cover the timing and interaction boundaries.

Documentation impact: synchronized architecture, UX, implementation, backlog, traceability, provider sources, tests, status, README, and changelog with WRITE-002 and the updated AT-061/AT-062 behavior.

Rollback: close the app and return to the prior 0.10.1 build. Existing local data and protected credentials remain readable. An already submitted external text request cannot be cancelled by rolling back the UI, so wait for it or check provider activity before changing builds.

### Fixed — 2026-08-24 (installed-app continuation and core media qualification assets)

- Made RunPod GPU-catalogue parsing tolerant of current numeric strings, nullable display fields, and unrelated malformed catalogue entries. A refresh now distinguishes a successful account check from an unavailable price catalogue and never implies that prices were checked when they were not.
- Added reviewed API-format candidate graphs for Qwen Image 2512 character/storyboard frames, Qwen Image Edit 2511 targeted corrections, LTX-2.5 single-stage motion proofs, and LTX-2.5 two-stage final video. Their hashes and exact node allowlists are recorded in the candidate pack, and their node/input structures were checked against the pinned ComfyUI runtime.
- Fixed a reproducible pinned LTX custom-node startup failure by locking Kornia 0.8.2 and verifying the required pyramid imports during the worker build. Qwen3-TTS now runs in a dedicated virtual environment with a build-time import check so its dependencies cannot silently replace ComfyUI's runtime.
- Split core production qualification from advanced native audio-driven LTX, control-guided generation, foley, and adaptation. The promotion gate can now qualify the practical 48 GB-or-less creator path while advanced candidates remain locked and excluded from the production pack until their own evidence exists.

User impact: the installed app can read more current RunPod catalogue responses honestly, and the one-time worker candidate now contains the concrete image/edit/draft/final workflow assets needed for a real qualification run. TTS plus LatentSync remains the core approved-dialogue/lip-repair route; advanced native audio-driven video is not falsely treated as ready.

Data/migration impact: application version advances to 0.10.1. Existing projects, canon, media, provider credentials, approvals, and jobs are unchanged. Candidate hashes and runtime pins change, so any earlier unpromoted worker candidate is obsolete. No model, Pod, GPU charge, license acceptance, or production receipt was created.

Documentation impact: synchronized the implementation/status/operations/test records with the four concrete candidate graphs, dependency isolation, core-versus-advanced qualification boundary, and remaining live proof.

Rollback: close the app and return to the installed 0.10.0 build. Existing project data and protected credentials remain readable. Do not reuse a 0.10.1 candidate worker with the older pack because the integrity hashes deliberately differ.

### Fixed — 2026-08-23 (guided question decisions and production-setup handoff)

- Replaced the read-only “Questions and cautions” list with one plain-language answer field per question, a “Let AI recommend” choice, required guidance, and a single action that prepares the answers as a reviewable revision request. Unanswered questions produce a correction popup and no provider call.
- Corrected the Creator Mode production handoff. A creator who still needs to connect RunPod or save spending limits is sent to Settings with an actionable button label. Once both creator-owned steps are complete, the app remains in Creator Mode, shows the five-part readiness checklist, states that no manual Pod is needed, and explains the studio-managed storage, worker, and shutdown proof instead of repeatedly redirecting to Settings. Its informational popup uses status language and **Close**, not correction language that implies the creator made a mistake.

User impact: creative cautions now have an obvious resolution path, and a connected creator can distinguish their completed setup from release-engineering qualification without entering a Settings loop or creating a Pod manually.

Data/migration impact: none. Question answers remain local UI state until the creator explicitly confirms a new writing request; production readiness continues to use the existing protected status contract. The patch does not unlock a workflow, create a Pod, call a provider, or alter approved canon/media.

Documentation impact: synchronized the UX specification, test plan, status, and changelog with the guided-question and readiness-handoff behavior.

Rollback: close the app and return to the previous 0.10 build. Existing projects and protected credentials are unchanged. Any revision already sent to a writing provider remains an ordinary confirmed request and cannot be cancelled by a UI rollback.

### Added — 2026-08-23 (default Creator Mode and minimal idea/script intake)

- Added a non-technical quick start with two clear paths: a short story idea or an existing pasted/uploaded text script. It asks only for series/film, optional title, language, and source; shows required markers/live guidance/correction popup; reads supported text files locally; creates safe AI-to-review placeholders; and makes no provider or GPU call.
- Added Creator Mode as the default project workspace. It derives the next incomplete stage from durable canon and approved media and guides production blueprint, full cast, world/location book, long screenplay, shot-by-shot storyboard, animation look, original voice/performance book, visual/audio proofs, master, YouTube release strategy, and final export.
- Creator Mode automatically attaches project source, production settings, the active creative-direction revision, all active approved canon, and applicable enabled skills. It selects the saved connected controlled model first and declares fallback behavior; the confirmation warns that unavailable fallbacks can mean multiple billed text requests. No text stage starts a GPU.
- AI output remains visibly a proposal. Only explicit approval of its exact stored fingerprint creates a canon revision and advances progress. Earlier stages can be revisited without overwriting history.
- Added a visual/audio production handoff that distinguishes approved character/style, original voice, motion/lip-sync, and master proof; routes setup/review/production exceptions in plain language; and preserves separate estimate, maximum-cost, qualification, and worker-start gates.
- Simplified default navigation to Productions, Create, Review, Edit & Export, and Settings. Story, World & Cast, Storyboard, and Generation controls are behind an optional Advanced Studio toggle. The production overview now routes ordinary work back through the guided path.
- Raised protected writing output capacity from 4,000 to 12,000 tokens for full screenplay/storyboard stages and limited quick-start source text to 60,000 characters so approved canon and production settings retain bounded context room.

User impact: a creator can begin with the story rather than a technical form and make only meaningful review decisions while the app supplies models, skills, context, canon and stage order. Detailed controls remain available when wanted.

Data/migration impact: project creation and canon/media stores remain backward compatible. The project brief contract accepts larger text, writing requests may request up to 12,000 output tokens after explicit billing disclosure, and no automatic migration is required. No provider call, GPU, model download, media generation, or external publication occurred while implementing this change.

Documentation impact: added FR-070, NFR-023, AT-062, and D-051; synchronized PRD, UX, architecture, workflow, implementation, traceability, status, test plan, README, and changelog with Creator Mode and its preserved safety boundaries.

Rollback: close the app and return to the previous 0.10 build. Existing projects, approved canon, media, provider keys, skills, jobs, and release records remain unchanged. Quick-start projects are ordinary projects and still open in detailed rooms. Reverting the UI cannot cancel an already approved provider request or external worker, so verify provider activity separately before rollback.

### Added — 2026-08-23 (version 0.10 project-wide idea assistance and governed future-feature foundations)

- Added one reusable project-aware idea assistant throughout Audience & Creative Direction, World & Cast, Storyboard, Generate, Edit & Export, and Release planning. It can propose character, relationship, world, location, prop, style, voice, motion, control, foley, thumbnail, release-profile, Idea Library, metadata, and evidence-analysis text through the existing protected GPT/Claude/Gemini contract and compatible enabled declarative skills.
- Every assistant request previews the exact local project context and skill plan, selects only an available controlled provider/model, requires one potentially paid text confirmation, and saves a schema-3 proposal with provider/model/context/skill lineage. Suggestions are never inserted automatically; human-only entries provide explanation without an apply action.
- Expanded provider-neutral writing task kinds for creative direction, visual generation, voice performance, motion, advanced controls, edit/sound, foley, adaptation, thumbnails, release planning, and performance analysis.
- Added project-local versioned release profiles, a source-labelled Idea Library, immutable official/manual/rehearsal performance snapshots with metric-definition version and missing-data warnings, and evidence-citing learning proposals that require a recorded human approval or rejection.
- Added strict media roles for start/end frames, pose/depth/edge/segmentation controls, region masks, motion tracks, reference clips, foreground/subject/background layers, and adaptation datasets/artifacts. Control-guided Qwen/LTX, rights-aware foley, and project-scoped LTX adaptation definitions are candidate-only and cannot start paid work without the existing atomic qualification gate.
- Advanced control jobs now serialize ordered approved asset IDs, roles, labels, and hashes into an engine-neutral manifest. Unsupported asset roles block before estimate. Adaptation additionally requires one approved dataset manifest plus explicit failed-reference-benchmark and dataset-rights confirmations; those confirmations still cannot override the candidate qualification lock.
- Added local tests for the protected idea-assistant proposal/apply boundary, release-profile revision ordering and cross-project isolation, analytics/learning review, and non-billable advanced candidate definitions.

User impact: a creator can ask for contextual ideas beside the fields where work is happening instead of manually moving text between screens. Release planning and evidence-based learning now remain organized per series or film. Advanced media classes are visible and safely preparable, but the app continues to block unqualified GPU/model work and never auto-publishes.

Data/migration impact: application version advances to 0.10.0. Existing projects remain readable. Opening Finish creates additive SQLite tables for project release profiles, ideas, performance snapshots, and learnings; existing release/timeline/package rows are unchanged. New media/job enum values and writing task kinds are additive. The candidate worker/runtime remains version 0.9.0 until separately qualified; no model, GPU, OAuth connection, external report, or channel content was created in this change.

Documentation impact: added FR-069, AT-061, and D-050; synchronized architecture, contracts, domain, UX, creative-direction, workflow, media, YouTube, implementation, backlog, traceability, tests, sources, status, README, and changelog with the exact implemented/locked boundary.

Rollback: close the app, keep a verified project backup, and return to version 0.9.0. The additive release-planning tables and stored schema-3 proposals may remain inert but are not displayed by 0.9.0; no existing creative/release record is rewritten. Candidate workflow entries remain non-billable. Reverting local code does not cancel any external provider request already approved, though this implementation run made none.

### Added — 2026-08-22 (version 0.9 production control plane and qualification lock)

- Added project-local canon, media, approval, dependency, production-job, timeline, release, attestation, and immutable package stores; Story proposals can now be promoted into versioned canon, while images/audio/video can be viewed and reviewed inside the app.
- Added World & Cast, Storyboard, Generate, Review, Edit & Export, and Release rooms with required markers, input-order cautions, current workflow/GPU requirements, no-cost estimate, exact maximum-cost approval, and a separate paid worker-start confirmation.
- Added official RunPod Pod list/get/create/start/stop/delete operations with lease reconciliation, idempotent uncertain-create recovery, current price checks, one GPU per job, up-to-three independent-job concurrency, cancellation, termination, provider/audit IDs, and `workerClosedAt` reconciliation.
- Added a strict candidate/qualified workflow registry for Qwen-Image-2512, Qwen-Image-Edit-2511, Qwen3-TTS, LTX-2.5, isolated LatentSync 1.6 repair, technical QC, and local finishing/release operations. Candidate media workflows cannot spend GPU money.
- Added the pinned remote worker: ComfyUI loopback-only, authenticated gateway, one-way lease-token hash, hard-deadline/idle watchdog, capability fingerprint, model/workflow/node/GPU/disk checks, sequential resumable 4 MiB transfers, input/output hashes, scoped Comfy staging, purge, Python TTS/QC/LatentSync runners, and process-group cancellation.
- Added revision-pinned Hugging Face model bootstrap with safe destinations, qualification-mode license confirmation, production hash enforcement, and exact receipts. Added API-workflow import, no-cost qualification bundle, matching pack/manifest Docker build, and atomic evidence-only production promotion scripts.
- Added local FFmpeg setup/check, deterministic timeline rendering, editable SRT/VTT captions, thumbnail rendering, master verification, explicit YouTube audience/disclosure/originality/rights/full-watch attestations, and a hash-checked manual upload package. Automatic publishing remains absent.
- Restricted Electron packaging to compiled `out` files plus explicit resources. This prevents ignored prior release folders from being recursively embedded; the first 0.9 NSIS attempt exposed the issue by producing a roughly 7 GB intermediate and failing to memory-map it, while the corrected installer build succeeds at 105,030,036 bytes.
- Corrected the LTX/lip baseline: LTX-2.5 remains the sole generative video engine; LTX-2.3 Dub-It is not mixed into the worker, and targeted repair uses isolated LatentSync pending animated/angle/multi-person qualification.
- Added `docs/PRODUCTION_IMPLEMENTATION.md` and synchronized status, plan, backlog, traceability, decisions, source evidence, operations, security, cost, UX, media, release, and script documentation with the version-0.9 implementation and external proof boundary.

User impact: the app now contains the complete supervised production path from creative development through local manual-upload packaging. A normal creator does not configure ComfyUI or reinstall a GPU worker for each episode. Paid generation remains visibly locked until a maintainer completes the exact one-time runtime/model/license/quality/security/shutdown qualification.

Data/migration impact: application version advances to 0.9.0. Existing project manifests, creative-direction revisions, provider secrets, writing proposals, skill receipts, and vendored upstream state remain readable. New production data lives inside each project and new worker lease tokens live in the protected application vault. No production pack or readiness receipt was fabricated, no model was downloaded, and no GPU was rented in this implementation run.

Documentation impact: the production implementation overlay is now the current source for component and qualification behavior. Older phase narratives remain design history only where the overlay/status says version 0.9 implements the component.

Rollback: close the application and revert this change/return to the previous release. Keep a verified project backup first because version 0.8 cannot display new canon/media/job/timeline/release records. Terminate any active provider Pod and verify billing separately before rollback; reverting local code cannot stop an external worker. Candidate config and evidence files are inert and do not unlock spend.

### Added — 2026-08-22 (project-scoped declarative creative skills)

- Added a strict declarative skill package contract plus `packages/skill-runtime`. Installation first copies a JSON candidate into a size-limited quarantine area, parses it without execution, computes SHA-256, rejects changed contents under the same version, and installs with no project access.
- Added a non-technical **Creative skills** Settings area showing self-declared publisher/source, compatibility, signature state, package fingerprint, tasks, instructions, permissions, and explicit per-production enablement. Updating a version clears prior grants; removal requires confirmation and preserves package evidence plus historical proposal receipts.
- Added exact skill-plan preview to the Creative Room. Only enabled project/task matches can enter a request; incompatible or unsupported required skills block before provider contact, and a changed plan hash requires a fresh review.
- Replaced the unfinished false-receipt path. Declarative instructions are now actually compiled into the selected GPT/Claude/Gemini request. The provider result is checked against declared minimum/required proposal sections; unmet required output saves no proposal.
- Added writing-proposal schema 3 with the exact plan hash, plan items, package/input/output hashes, provider request linkage, status, and immutable skill receipts. Schema-1/schema-2 proposals remain readable.
- Added registry, routing, permission, version-conflict, update, removal, stale-plan, required-output, successful-receipt, and renderer project-enablement tests. General signature verification, arbitrary JSON Schema, executable/local/remote/MCP skills, and tool timeouts remain locked.
- The 67-test suite, documentation, formatting, type, lint, and production build gates pass. A separate unpacked Windows 0.8.0 smoke artifact reports SHA-256 `2B6A4A154E9E889C948D53D47A0DE607B3D66ADC4A1B24FA5B03C5631AD0B999`; an isolated-profile launch initialized its catalog. The artifact is unsigned and is not a production installer.

User impact: a creator can install a reviewed writing-skill JSON file without running package code, choose exactly which series or film may use it, see the plan before approving a paid text request, and verify the exact skills that affected a saved proposal. Installing alone never counts as use.

Migration impact: application version advances to 0.8.0. Existing project manifests, provider keys, settings, and schema-1/schema-2 proposals remain unchanged and readable. New active skill state is stored under application user data, outside projects. New proposals use schema 3. Installing an updated skill version intentionally revokes prior project grants until reviewed.

Documentation impact: synchronized the documentation map, README, status, architecture, API/domain/security/UX contracts, test plan, backlog, traceability, and changelog with the implemented declarative boundary and remaining higher-risk work.

Rollback: disable or remove active skills in Settings, close the application, and revert this feature change. Existing schema-3 proposals and retained package files are inert evidence; version 0.7.0 cannot display schema-3 proposals, so keep 0.8.0 or export/back up those records before rollback. No GPU, cloud worker, provider credential, canonical story record, or media is created or deleted by skill installation/removal. A writing request already approved before rollback remains a normal provider charge and its local proposal record is not rewritten.

### Added — 2026-08-22 (guided required-field and caution feedback)

- Added reusable visible required asterisks, live minimum/remaining/maximum text feedback, allowed-range messages, and non-color invalid styling.
- Replaced silent primary-action disabling with an accessible correction popup in production setup, Audience & Creative Direction revision, RunPod and GPT/Claude/Gemini key setup, spending defaults, and paid Creative Room requests. Buttons remain disabled while an operation is actually running to prevent duplicates.
- Every correction popup lists all known issues, receives keyboard focus, closes with its button or Escape, and states that nothing was submitted or charged. Short key checks reveal only a character count and never echo secret content.
- Fixed Creative Room model initialization so the first connected, approved, available model is selected when no saved default exists or provider status arrives/changes.
- Expanded renderer regression paths to prove missing identity, a short RunPod key, unchecked paid-text approval, and a missing revised niche open guidance without calling the protected operation. The local suite remains 57 tests.
- The full quality gate passes. A separate unpacked Windows test package reports product version `0.7.0.0` and SHA-256 `8091E40BB747C61D0356E88206682F1CE195913F0BABAE54260CE1CBBFBB1969`; it remains unsigned and is not a production installer.

User impact: the creator no longer has to guess why **Create writing proposal**, **Continue**, **Save direction**, or a connection action cannot proceed. Required inputs and limits are visible before clicking, and one plain-language popup explains exactly what to correct.

Migration impact: none. No project, proposal, credential, cloud, writing-settings, or creative-direction schema changed. Existing projects and protected keys remain readable.

Documentation impact: added FR-068, NFR-022, AT-060, and D-044, then synchronized UX, architecture, security, cost, creative-direction, implementation, backlog, traceability, status, README, test, and changelog records.

Rollback: close the application and revert this feature commit. No data conversion or external cleanup is required. Any provider request or local write already completed before rollback retains its existing record; invalid-form popups created no remote or durable state.

### Added — 2026-08-22 (versioned Audience & Creative Direction)

- Added a six-step series/film wizard that records intended audience, creative age band, niche, genres, tone, themes, story promise, cultural setting, content boundaries, episode/film format, YouTube positioning, visual-style notes, comparable-title direction, and differentiation.
- Added immutable project-local profile files under `bibles/creative-direction/versions`. New projects write revision 1; **Revise direction** appends the next version, keeps prior files, and refuses a save when another revision was created after the screen opened.
- Kept existing projects readable without a forced project-manifest migration. They show no profile until the creator adds revision 1 from the overview.
- Added exact creative-direction selection to the Creative Room. The preview shows the direction that may be disclosed, and new schema-2 proposals record manifest/profile IDs, revisions/timestamps, and SHA-256 hashes; schema-1 proposals remain readable.
- Separated creative direction from canon, character identity/presentation versions, channel release profiles, and human YouTube attestations. Creative age/style/positioning cannot decide made-for-kids, synthetic-media, truthfulness, originality, rights, or full-watch answers; comparable titles cannot authorize copying.
- Reconciled the current studio plan, the supplied rich workflow comparison, the six pinned upstream skills, and the reviewed YouTube-automation repository into one future consumer matrix for writing, upstream normalization, images, voice, LTX, thumbnails, and Release Details.
- Added storage, older-project, damaged-history, writing-context, and renderer coverage. The local suite now contains 57 automated tests; full downstream compiler/impact/non-technical AT-059 acceptance remains open.
- The full quality gate passes. A separate unpacked Windows package reports product version `0.6.0.0` and SHA-256 `781C89F819EDC55FA29CBF2910AF1DF606374328F23C88EFB41E2E72B56CEA22`; it remains unsigned and is not a production installer.

User impact: a non-technical creator now gives each series or one-off film a clear reusable compass before building characters or episodes, sees it on the project overview, can revise it without destroying history, and can include or exclude it from a GPT/Claude/Gemini writing request. This local setup/revision uses no GPU and makes no provider call.

Migration impact: project-manifest schema remains version 2. New projects add a revision-1 sidecar file. Older projects and backups remain readable with `creativeDirection: null` until a direction is added. New writing proposals use schema 2; the reader retains schema-1 compatibility. Existing approved work, proposals, media, credentials, and provider state are not rewritten.

Documentation impact: added the authoritative Audience & Creative Direction specification and updated the PRD, architecture, domain/API/security/UX/media/production/YouTube/upstream contracts, implementation plan, backlog, tests, traceability, decisions, sources, glossary, status, documentation map, README, and changelog.

Rollback: close the application and revert this feature commit. Existing direction-version and schema-2 writing-proposal JSON files are inert and may be retained or backed up; the version-0.5.0 reader does not expose them and cannot read schema-2 proposals. Restore the last pre-feature application backup only if those new local records must be removed as well. No GPU, remote worker, writing request, credential, or YouTube account requires rollback.

### Added — 2026-08-21 (protected Gemini and controlled writing models)

- Added a separate Windows-protected Google Gemini credential, no-cost model-list validation, independent refresh/disable/enable/remove controls, and a provider-neutral Gemini `generateContent` adapter with structured JSON, bounded timeout, safe errors, completion checks, usage, and request lineage.
- Added a visible release-controlled model catalogue. OpenAI offers GPT-5.6 Terra (balanced), Sol (deep), and Luna (economy); Anthropic offers Claude Sonnet 5 (balanced), Opus 5 (deep), and Haiku 4.5 (economy); Gemini offers Gemini 3.7 Flash (balanced) and Gemini 3.5 Flash-Lite (economy).
- Connection now intersects the provider's live model list with that catalogue. Unknown, preview, retired, and unavailable models are not offered, while no model is claimed as the benchmark winner for a particular writing task.
- Added backward-compatible migration of the local writing-settings record from schema 1 to schema 2, retaining existing OpenAI/Anthropic state and adding Gemini as unconfigured.
- Added Gemini adapter/UI coverage, controlled-catalogue refusal, backward settings-read coverage, and expanded provider-neutral setup fixtures. The full suite now contains 54 automated tests.
- The full quality gate passes and the unpacked Windows test build reports version 0.5.0.0. It remains unsigned and is not a production installer.

User impact: a creator can bring a Gemini key as well as an OpenAI or Anthropic key, see the exact studio-approved models and their plain-language purpose, and use an available model in the same Creative Room. Connection checks make no writing request; a confirmed draft can still incur the selected provider's token charges.

Migration impact: no project schema changes. Reading the existing non-secret writing settings adds an unconfigured Gemini entry in memory; the next settings write saves schema 2. A successful Gemini connection creates `secure/gemini-api-key.bin` under application user data. Existing keys and proposal files are retained.

Documentation impact: requirements, architecture, contracts, UX, security, workflow, implementation/backlog, tests, traceability, decisions, sources, status, README, and changelog now include Gemini and the controlled initial model catalogue.

Rollback: remove the Gemini key in Settings, close the application, and revert this feature commit. Before running version 0.4.0 again, remove or retain a backup of the non-secret schema-2 `creative-writing.json`; version 0.4.0 cannot read that settings schema and will safely ask for repair. Projects and proposal files require no rollback.

### Added — 2026-08-21 (protected GPT/Claude creative room)

- Added separate Windows-protected OpenAI and Anthropic credential records with validate-before-store model-list checks, independent refresh/disable/enable/remove actions, and no provider/model choice hidden as a benchmarked default.
- Added provider-neutral adapters for OpenAI Responses and Anthropic Messages using structured JSON output, bounded timeouts, safe errors, request IDs, and token usage without retaining a provider conversation as canonical project data.
- Replaced the Story placeholder with a non-technical Creative Room for character, world, outline, scene, dialogue, and continuity proposals. It previews the exact selected project context and requires a fresh checkbox approval for each potentially paid text request.
- Added immutable per-project writing proposal records with project/provider/model/profile/source hashes, context hash, token usage, provider request ID, and explicit `not-calculated` dollar cost. External skills are recorded as unused because their runtime remains locked.
- Added adapter, service, project-isolation/no-overwrite, and renderer approval tests. The full suite now contains 48 automated tests.

User impact: a creator can bring an OpenAI or Anthropic key, select an available model, and create reviewable story-development proposals entirely through the application. This spends no GPU money. A text provider may charge for a confirmed proposal request; the application does not yet claim an exact dollar quote.

Migration impact: no existing project schema changes. Successful setup creates separate encrypted OpenAI/Anthropic vault files and one non-secret writing-settings file under application user data. Each successful request adds one new JSON proposal under that project's `provenance/writing` folder; existing files are never overwritten.

Documentation impact: README, status, architecture, API/UX/security contracts, implementation/backlog, tests, traceability, sources, and changelog now describe the implemented boundary and the still-open live benchmark, actual-cost, skill-runtime, canon-approval, packaging, and GPU gates.

Rollback: close the app and revert this feature commit. Existing proposal JSON files are inert and may be retained; removing them is optional and not automatic. Protected provider keys can be removed in Settings before rollback. No RunPod resource or media is created by this slice.

### Changed — 2026-08-21 (YouTube release workflow audit and expansion)

- Audited `darkzOGx/youtube-automation-agent` at exact commit `0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4` and compared its implemented channel operations with the studio's accepted animation architecture.
- Added the governed YouTube release workflow: versioned channel release profiles, a source-labelled Idea Library, public Thumbnail Room, factual Release Details, timeline-derived chapters, explicit human audience/disclosure/truth/originality/rights/full-watch attestations, unified Release Readiness, and immutable manual-upload packages.
- Added optional post-release evidence import/read-only analytics and human-approved prospective learning, with strict separation between real/imported/rehearsal values and no authority to rewrite history or start paid work.
- Added FR-059–FR-066, NFR-020–NFR-021, AT-050–AT-058, D-038–D-041, IPC/domain/security/media/UX/production/phase/backlog mappings, and official YouTube source links.
- Explicitly rejected copying plaintext credential/token storage, a hardcoded not-made-for-kids answer, a universal SEO score, local candidate review presented as a real A/B test, and automatic public publishing in version 1. Optional private upload/scheduling remains blocked behind O-010 and separate OAuth/idempotency/privacy gates.

Implementation status: documentation, requirements, contracts, tests-to-build, and backlog only. Thumbnail generation, release-detail drafting, YouTube OAuth/API access, upload, analytics collection, and learning are not implemented and no external account, media job, provider charge, or channel content was created.

Migration impact: none. No application schema, project, credential, provider resource, model, workflow, media, or YouTube account changed.

Rollback: revert this documentation commit. Existing application behavior and all local/provider/channel state remain unchanged.

### Changed — 2026-08-21 (guided project schema migration and rollback)

- Made project-manifest schema 2 the current format for new projects, adding reversible `lifecycle.archivedAt` and `lifecycle.statusBeforeArchive` fields without changing creative content.
- Kept schema-1 projects and backups readable. Opening an older project now shows a plain-language one-file/no-data-loss preview and does not change it until the creator chooses `Back up and update project`.
- Added timestamp-bound stale-preview refusal, SQLite checkpoint/integrity validation, a mandatory verified schema-1 backup, atomic schema-2 manifest activation, matching SQLite migration/hash history, and catalog update.
- Added automatic rollback that restores the exact original manifest bytes and removes the schema-2 database record after injected failures following backup, before activation, after manifest activation, and after database commit. The verified recovery backup remains.
- Added typed migration IPC/preload contracts, redacted diagnostic events, the project-overview migration card, and six new automated cases; the full suite increases from 31 to 37 tests.

User impact: existing projects remain visible and usable. When an older project needs the new reversible lifecycle format, the creator sees exactly what changes and can approve one safe in-app update without a terminal. The operation creates no network request, GPU, generation job, or charge.

Migration impact: new projects write manifest schema 2 and record project-database schema versions 1 and 2. Existing schema-1 projects change only after explicit approval and a verified backup; identity, production settings, files, and prior backup bytes are retained. A legacy archived project conservatively records its prior state as `development` because schema 1 did not preserve that history.

Documentation impact: README, architecture, domain model, API/UX/security contracts, implementation plan/backlog, tests, traceability, status, decisions, and changelog now record the schema-2 format, backward read boundary, exact migration, failure matrix, and remaining future-migration/archive/clean-machine gates.

Rollback: revert this feature commit only after closing the app and first creating a current verified backup. The prior build reads schema 1 only, so a project already promoted to schema 2 must be restored from its retained pre-migration backup before using that older build; do not manually edit `schemaVersion`.

### Added — 2026-08-21 (redacted diagnostics and local support file)

- Added `packages/support-diagnostics` with bounded structured events, correlation IDs, flushed JSONL writes, protected-field removal, known RunPod/OpenAI/Anthropic/Bearer secret patterns, configured private-path replacement, and a second redaction/contract pass during support-file creation.
- Added safe application/project/backup/restore/cloud/credential lifecycle events without raw provider errors, payloads, project content, or credential values.
- Replaced the renderer error-boundary placeholder with one schema-validated protected IPC report; no generic renderer logger or filesystem method was exposed.
- Added a Settings action that explains exactly what is excluded and creates a local JSON support file only after the known-secret scan passes. Nothing is uploaded automatically.
- Expanded the automated suite from 28 to 31 tests, including direct log/bundle secret and private-path checks plus the non-technical Settings flow.

User impact: the creator can make an inspectable local troubleshooting file without using a terminal and without copying scripts, prompts, projects, media, provider responses, or API keys. This creates no network request, GPU, paid job, or charge.

Migration impact: project schema and project files are unchanged. New session logs are stored under application user data `logs/`; explicitly requested support JSON files are stored under `support/`. Neither location is inside a project or backup.

Documentation impact: README, architecture, API/UX/security contracts, implementation plan/backlog, test evidence, traceability, decisions, status, and changelog now describe the working diagnostics boundary and the remaining retention, broader-pattern, packaged-scan, and clean-machine gates.

Rollback: revert this feature commit after closing the app. Existing log/support JSON files are inert and may be retained for inspection or manually removed; rollback does not touch projects, backups, credentials, or provider resources.

### Added — 2026-08-21 (verified project backup, restore, and writer safety)

- Added plain-language “Create verified backup” controls on each production overview and a Backup and recovery section in Settings.
- Added schema-validated backup manifests with application/project identity, exact file/byte counts, and a per-file SHA-256/size inventory; copies are flushed, verified, and exposed only after their temporary generation completes.
- Added SQLite checkpoint/integrity checks, unsafe path/link/special/transient-file refusal, damaged/incomplete/extra/missing-file detection, and restore-time re-verification.
- Added non-destructive restore through a temporary verified project copy and atomic activation. Restore refuses an existing project folder and retains the source backup.
- Added application single-instance handling plus a token-owned workspace writer lock that blocks a live second writer and preserves stale lock records during safe recovery.
- Expanded the automated suite from 23 to 28 tests. Local automated AT-001 now covers backup and restore for both a series and film; the plain-language backup/recovery UI, tamper/no-overwrite, and live/stale/incomplete lock paths also pass.

User impact: a non-technical creator can make a checked recovery copy from the project overview and restore a missing project from Settings without using a terminal or risking replacement of an existing project. No GPU, provider mutation, generation job, or charge is involved.

Migration impact: existing schema-1 project manifests and databases are unchanged. New standard project folders include controls, animatics, adaptations, and writing/skill provenance directories. Completed backups are stored outside project folders under application user data as `backup.json` plus `snapshot/`; an active workspace adds `.studio/writer.lock`, which is removed only by its owning process.

Documentation impact: README, architecture, domain layout, contracts, UX, security/recovery, implementation plan/backlog, tests, traceability, status, and changelog now reflect the implemented boundary and the remaining incremental/archive, migration, interruption, and clean-machine gates.

Rollback: revert this feature commit only after closing the app. Existing projects remain schema-compatible; completed backup folders can be retained for manual recovery, but older builds cannot list or restore them through the UI. A stale `.studio/writer.lock` is harmless to older builds.

### Changed — 2026-08-21 (full rich animation workflow adopted)

- Added locked requirements for versioned timed animatics, engine-neutral pose/depth/edge/segmentation/mask/motion/reference control packs, layered 2D parallax assets, and explicit pre-generation timing/control approval.
- Expanded the LTX plan with benchmark-gated IC-LoRA/reference control, motion tracks, structural control, in/outpainting, relighting, native multishot, diffusion-fidelity rendering, and temporal upsampling.
- Added warning-only creative QC for identity/continuity/flicker/motion/defects/lip timing/script-audio comparison, a separate rights-aware ambience/effects/foley contract, and optional project-scoped character/style adaptation with dataset rights, benchmark promotion, and rollback.
- Locked production worker immutability: ComfyUI Manager, arbitrary downloads, Git, package installation, model changes, and missing-node repair cannot run during an authorized production session.
- Recorded current compatibility evidence that official Dub-It and Foley adapters are not assumed compatible with the selected LTX-2.5 baseline until exact benchmarks pass.
- Added acceptance tests AT-042–AT-049 and work packages ANIMATIC-001, CONTROL-001, LAYER-001, LTXADV-001, CREATIVE-QC-001, FOLEY-001, and ADAPT-001.

User impact: the planned studio now covers richer 2D/3D-look previsualization, explicit movement/structure guidance, high-fidelity final passes, synchronized sound, and assisted defect finding while keeping the experience inside the non-technical desktop application. These capabilities remain locked and unimplemented in version 0.3.0.

Migration impact: none. No project schema, application data, provider resource, model, workflow, training dataset, or media file changed.

Documentation impact: PRD, architecture, decisions, domain/contracts, UX, production/media/GPU/security/cost workflows, tests, traceability, sources, status, glossary, implementation plan, master backlog, README, and changelog now carry the accepted behavior and compatibility boundaries.

Rollback: revert this documentation change. Version 0.3.0 application behavior, credentials, projects, and pinned upstream checkout remain unchanged.

### Changed — 2026-08-21 (living build backlog and ComfyUI reliability gate)

- Added one master build ledger that retains every accepted capability, production risk, fix, dependency, status, and exit proof instead of relying only on broad phases.
- Expanded the immediate implementation stack with five explicit ComfyUI packages: allowlisted workflow compilation, exact runtime/model/node preflight, headless progress/error integration, output verification and bounded retry/QC, and update qualification with rollback.
- Added a governance rule requiring future work to update the master ledger without silently dropping unfinished items.

User impact: the complete path from the current version-0.3.0 foundation to writing, character/voice production, safe cloud generation, LTX video, editing, multiple GPUs, full episodes, and release is now visible in one maintained queue. This does not make ComfyUI or media generation available yet.

Migration impact: none. No application schema, project, credential, provider resource, model, workflow, or media file changed.

Documentation impact: added `docs/BUILD_BACKLOG.md` and linked its stacking rules from the documentation map, implementation plan, change-control policy, and repository working rules.

Rollback: revert this documentation change. Version 0.3.0 application behavior and all user projects remain unchanged.

### Changed — 2026-08-21 (writing providers, external skills, and in-app media review design)

- Locked OpenAI Responses and Anthropic Messages as the first bring-your-own-key writing adapters behind a provider-neutral creative contract; provider conversations cannot become the canonical story database.
- Added requirements for protected separate writing credentials, per-task provider/profile selection, local structured creative versions, token/cost lineage, and explicit notice that text API charges are separate from RunPod GPU charges.
- Added a permissioned external-skill architecture with manifest inspection, project-scoped enablement, task matching, required/optional plans, provider tool/instruction compilation, output validation, timeouts, and immutable exact-version execution receipts. Installing a skill is explicitly not evidence that it ran.
- Locked Animated Series Studio as the image/audio/video gallery and player. ComfyUI remains a headless, loopback-only worker engine that reports progress and outputs through the authenticated gateway.
- Added acceptance tests AT-036–AT-040 for provider neutrality/secret safety, skill execution proof, headless media review, writing benchmarks, and immutable originals during proxy failures.
- Added a scoped character-style/redesign rule: identity and presentation are separate versions, a new consistency board is required, and changes can target a shot, scene, episode, season, or future work without rewriting completed episodes.

User impact: future creative work can use a chosen Claude or GPT account, can be improved by attached skills with visible proof of use, and can be reviewed without learning or opening ComfyUI. This documentation-only change does not yet add those screens or make an API call.

Migration impact: none. No application schema, credential record, project, skill package, or media file changed.

Documentation impact: PRD, architecture, contracts, UX, security, implementation plan, tests, traceability, decisions, sources, status, README, and changelog now carry the new locked behavior and honest implementation boundary.

Rollback: revert this documentation commit. Version 0.3.0 application behavior and the pinned upstream checkout are unchanged.

### Added — 2026-08-21 (secure RunPod account connection)

- Added a guided RunPod Settings flow with a masked key field, explicit no-cost validation, refresh/replacement/removal, aggregate warning for existing active account Pods, live API v2 GPU catalogue planning prices, conservative default cost/runtime/idle/concurrency limits, and an honest prepared-studio checklist.
- Added `packages/credential-vault`, using Electron asynchronous `safeStorage` with Windows DPAPI protection and encrypted bytes stored outside every project, plus fail-closed and plaintext non-leakage tests.
- Added `packages/provider-runpod` with only RunPod REST API v2 read operations (`GET /pods` and `GET /catalog/gpus`), bounded timeouts, safe 401/403/429/provider/response errors, and no provider payload or key in error messages.
- Added `packages/cloud-setup`, typed IPC contracts, atomic non-secret settings, validate-before-store behavior, opaque renderer status, and local-only safety defaults. No create/start/stop/terminate, storage, worker, ComfyUI, Qwen, TTS, LTX, or generation method exists in this release.
- Expanded the automated suite from 9 to 23 tests and kept generation visibly locked after account connection.

User impact: the creator can enter the RunPod key inside the desktop app rather than a terminal, prove account access for $0, see whether RunPod already reports active Pods, and save cautious defaults. The app cannot rent a GPU yet, so account connection cannot accidentally begin billing.

Migration impact: existing schema-1 projects are unchanged. A successful connection creates one OS-encrypted credential blob under application user data and one non-secret cloud-settings JSON file outside all projects. No key is imported from `.env` or previous project files.

Documentation impact: architecture, contracts, security, GPU operations, UX, cost, sources, implementation status, tests, traceability, decisions, README, and changelog now distinguish account connection from worker readiness and paid generation.

Rollback: return to commit `2ddf076`. Before rollback, use Settings to remove the protected RunPod key if the version-0.3 connection was used; otherwise the encrypted blob is inert and inaccessible to the older application. No provider resource requires rollback because this version cannot create one.

### Added — 2026-08-21 (desktop foundation)

- Added the Electron 43, React 19, and TypeScript desktop workspace with secure sandboxed preload IPC, a restrictive content policy, blocked external navigation/windows, and a production custom application protocol.
- Added a plain-language production library, four-step series/film setup wizard, project overview, navigation shell, settings/status screen, and honest locked states for all generation features.
- Added runtime-validated project contracts, ULID identities, friendly project codes, schema-v1 canonical manifests, atomic writes with SHA-256, isolated project folders, per-project SQLite databases, a rebuildable catalog, and startup reconciliation.
- Added unit, storage-integration, and renderer tests plus type checking, linting, production builds, Windows unpacked packaging, and an unsigned NSIS test installer.
- Pinned compatible build versions and added an explicit Electron runtime download step for repeatable setup.

User impact: a creator can now create, find, reopen, and keep separate local series and one-off-film production homes. No GPU, cloud account, or paid operation is available or started.

Migration impact: none for existing user projects because no prior application data format existed. New projects use manifest schema 1 and catalog schema 1.

Documentation impact: README, status, architecture, contracts, domain layout, implementation progress, test evidence, traceability, decisions, sources, and changelog now reflect the working foundation and remaining gates.

Rollback: return to commit `e1e8132`; remove only test projects created by version 0.2.0 if they are no longer needed. The pinned upstream checkout remains unchanged.

### Added — 2026-08-21

- Created the standalone `animated-series-studio` project.
- Added `shuohao-skills` as a pinned Git submodule at commit `4cff5ae3a4a2d2b5d13161f5a2378c5910be7cad`.
- Verified all six upstream skill self-tests plus the combined-report self-test at the pinned commit.
- Added the product requirements, architecture, domain model, user experience, production workflow, media pipeline, cloud GPU operations, cost model, security and recovery plan, API contracts, implementation phases, test plan, traceability, decisions, sources, and change-control policy.
- Added documentation and upstream-update verification scripts.

User impact: establishes the build baseline; no studio application capability exists yet.

Migration impact: none; this is a new project.

Documentation impact: initial authoritative documentation set.

Rollback: remove the new project directory; the original upstream checkout is unchanged.

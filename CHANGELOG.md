# Changelog

All notable changes to Animated Series Studio are recorded here. Each entry must state user impact, data or migration impact, documentation impact, and rollback path.

## Unreleased

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

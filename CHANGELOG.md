# Changelog

All notable changes to Animated Series Studio are recorded here. Each entry must state user impact, data or migration impact, documentation impact, and rollback path.

## Unreleased

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

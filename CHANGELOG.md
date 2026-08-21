# Changelog

All notable changes to Animated Series Studio are recorded here. Each entry must state user impact, data or migration impact, documentation impact, and rollback path.

## Unreleased

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

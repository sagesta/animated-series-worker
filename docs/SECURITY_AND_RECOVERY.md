# Security, rights, backup, and recovery

Current implementation note (0.10.1): OS-protected provider and per-lease secrets, token hashing, renderer isolation, restricted media protocol, allowlisted worker execution, scoped paths, chunk/hash verification, job/lease reconciliation, process-group cancellation, watchdog deadlines, and audit-preserving worker closure are implemented. Live adversarial/cloud failure proof remains a release gate. See [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md).

## 1. Protection goals

- Prevent unauthorized cloud spend.
- Keep scripts, unreleased episodes, character references, voices, and credentials private.
- Prevent one project from accessing another project's assets.
- Preserve creative history and approved media through crashes or failed updates.
- Make remote execution temporary, authenticated, bounded, and auditable.
- Record rights and consent for sensitive source material.

### Current controls

The current source implements renderer sandboxing, context isolation, disabled renderer Node integration, restrictive content security policy, custom production protocol, blocked navigation/new windows, narrow schema-validated preload methods, top-frame/origin IPC validation, project-root containment, ULID-scoped folders, atomic canonical manifest/proposal/creative-direction writes, startup catalog reconciliation, separate protected RunPod/OpenAI/Anthropic/Gemini credential storage, an application single-instance guard, and a project-library writer lease that preserves and replaces only provably stale lock records. Direction revisions use a current-profile optimistic check so an older open screen cannot quietly append from stale state. Renderer forms show required/length/range guidance and refuse invalid submissions before IPC, but this convenience is not trusted: main-process services still validate every schema, identity, stale-state, approval, and provider boundary.

A correction popup never sends the entered value, starts a GPU, or makes a paid text request. API-key warnings state only the missing character count and never echo key content. Actions are disabled while an operation is running to prevent duplicates; otherwise missing information is explained rather than hidden behind a grey button.

The RunPod connection flow validates with a read-only Pod list before saving, uses Electron asynchronous `safeStorage` backed by Windows DPAPI, writes only encrypted bytes outside project roots, returns no key value to the renderer, and has tests proving vault/settings contain no plaintext key. The current source implements Pod lifecycle behind a qualified production pack, exact cost approval, separate start confirmation, active-Pod limit, and lease reconciliation. Each worker token stays in a separate protected lease vault while only its one-way SHA-256 is sent to the Pod.

OpenAI, Anthropic, and Gemini have distinct encrypted vault files. A replacement key must pass that provider's model-list check before becoming active; the result is intersected with the release-controlled catalogue and returns only opaque status/approved models before the input field is cleared. Enablement/removal is provider-specific. The main process obtains the key immediately before an adapter call; proposal records, projects, backups, diagnostics, and support bundles contain no key. OpenAI uses a Bearer header, Anthropic `x-api-key`, and Gemini `x-goog-api-key`; no key is placed in a request URL. The Creative Room shows the exact selected manifest and Audience & Creative Direction text before one explicit paid-text confirmation, and the creator can exclude the profile from that disclosure. Provider responses are schema-validated and must be complete before a new no-overwrite local proposal is exposed; errors discard unreadable/partial output. Current automated evidence uses injected vaults and mocked HTTP, so packaged DPAPI persistence, live provider retention/billing behavior, and broader process-memory/packaged scans remain open.

Verified full backup/non-overwriting restore, SQLite integrity, file inventories, and redacted diagnostics remain implemented. The current source includes an authenticated remote gateway, ComfyUI loopback enforcement, safe scoped paths, workflow/model/node allowlists, pack/image fingerprints, bounded resumable transfers, output hashes, remote idle/hard-deadline watchdogs, cancellation of child process groups, scoped purge, provider termination, and durable `workerClosedAt` audit state. Real adversarial/provider-disconnection/shutdown evidence, packaged secret scanning, and clean-machine restore remain release blockers; the absent production-readiness receipt prevents paid generation until those tests pass.

## 2. Main threats

| Threat | Primary control |
| --- | --- |
| Leaked provider API key | OS credential vault, redaction, least privilege, rotation |
| Publicly exposed ComfyUI | Loopback binding; authenticated gateway only |
| Abandoned billable GPU | Local + remote watchdogs, hard deadline, startup reconciliation |
| Duplicate worker after timeout | Idempotency tags and provider reconciliation |
| Malicious/invalid workflow | Signed allowlisted workflow hash and worker capability check |
| Runtime “install missing nodes” or model/package update | Manager/install routes disabled; immutable worker image and allowlisted cache hashes |
| Poisoned adaptation dataset or cross-project LoRA | Project-scoped rights-approved dataset manifest, isolated paths/tokens, candidate benchmark and explicit promotion |
| Assistive QC changes approval | Contract has no approval authority; authorization tests deny creative state mutation |
| Path traversal or project crossover | Project-scoped roots/tokens, normalized paths, isolation tests |
| Untrusted upstream/model update | Pins, checksums, source/license review, sandboxed tests, rollback |
| Lost/corrupt local disk | Verified backups and restore drills |
| Remote volume loss | Treat as rebuildable cache, never authoritative project store |
| Voice/likeness misuse | Rights/consent records and release gate |
| Secret in support bundle/log | Structured redaction and automated secret scanning |
| Malicious or over-broad external skill | Manifest/schema validation, least-privilege grants, project scope, no code by default, isolation, time/output limits, exact-version receipts |
| Skill silently ignored or falsely reported | Orchestrator-required execution plan, validated result, immutable receipt, and blocked completion when a required receipt is absent |
| Excess project context sent to a writing provider/tool | User-visible context selection, task-scoped data pack, provider/skill permission preview, and recorded disclosure lineage |
| Creative niche/age/style mistaken for canon or a platform decision | Separate immutable direction, canon, release-profile, and unresolved-capable attestation records; no automatic field mapping |
| Media viewer path escape or original replacement | Project-scoped `studio://media` authorization, normalized paths, immutable original hashes, rebuildable derivatives |
| YouTube OAuth token leakage or excessive channel authority | OS vault, exact read-only scope allowlist, opaque status, revocation, and adapter with no mutation methods in version 1 |
| Wrong audience/disclosure or deceptive packaging silently accepted | Explicit unresolved-capable human attestations, factual-source view, ruleset version, and blocked package lock |
| Imported/simulated analytics poisons future decisions | Strict source/window/schema validation, immutable snapshots, real/simulated separation, project/profile scope, and human promotion |

## 3. Credential handling

- Provider keys and optional service tokens are stored only through the operating-system credential vault.
- The renderer receives opaque connection status, not secret values.
- The main process injects credentials directly into adapter calls.
- Logs replace tokens, authorization headers, signed URLs, and likely secret patterns with `[REDACTED]`.
- Project export and backup exclude credential stores.
- Credential test, rotation, and removal are explicit settings actions.
- RunPod, OpenAI, Anthropic, and any future service each use a separate protected credential record and opaque connection status; disabling one provider does not expose or remove another.
- Any future YouTube/Analytics OAuth token is a separate protected credential with exact approved read-only scopes, opaque renderer status, explicit disconnect/revocation, and no inclusion in a project/export/backup/release package. Version 1 does not request it.
- External skills receive neither raw credentials nor a generic “call any provider” capability. Provider calls remain controlled by the writing adapter and permissioned tool broker.
- The field-level idea assistant uses only the named writing/context/skill IPC methods. It cannot call credential, performance-write, approval, canon, worker-start, or publishing methods; human-only fields omit proposal insertion.
- A worker receives a short-lived session token, never the main provider key unless a narrowly scoped termination design absolutely requires it and passes threat review.
- On Windows, Electron `safeStorage` uses DPAPI: it protects the encrypted value from other Windows users, but it is not a defence against malicious software already running as the same signed-in user. Endpoint security and a protected Windows account remain necessary.

## 4. Worker network and runtime

- ComfyUI and model services bind to loopback.
- Gateway exposes only documented routes over authenticated encryption.
- Tokens bind to project, lease, expiry, and permissions.
- Uploads have size, type, path, and hash checks.
- Worker runs as a non-root user where GPU/runtime permits.
- Job directories are worker/session/project scoped.
- Workflow and model files are allowlisted by exact hash.
- Worker refuses arbitrary shell commands, file paths, URLs, custom-node installation, or model downloads from a job.
- ComfyUI Manager and dependency installers are absent or disabled in the production execution path. A missing dependency quarantines the worker instead of repairing it while billing is active.
- Egress is restricted to required provider/model/cache endpoints during setup and disabled or allowlisted during production where feasible.

## 5. Supply-chain controls

For each worker release:

- Pin base image by digest.
- Pin Python/Node packages with lockfiles and hashes where supported.
- Pin ComfyUI/custom-node/model revisions.
- Verify downloaded model checksums.
- Generate a software bill of materials.
- Scan image and dependencies for known critical vulnerabilities.
- Sign the worker image and capability manifest.
- Run GPU smoke and contract tests before promotion.
- Keep the previous production image available for rollback.
- Treat control preprocessors, creative-QC models, speech verifiers, audio-effects adapters, and adaptation trainers as separately allowlisted capability classes with exact hashes and least-privilege inputs.

An upstream or model Git branch name such as `main` is not a production pin.

### External skill controls

Version 0.8.0 implements the declarative-only subset. A selected JSON file is copied into a size-limited quarantine location, parsed under a strict no-extra-fields schema, hashed, and removed from quarantine without executing content. It is installed with no project grants. Same-version/different-content packages are rejected, updates revoke grants, only explicit project IDs can be enabled, unsupported permissions block required plans, and active removal preserves package evidence plus immutable proposal receipts. Publisher/source text and an `unverified` signature state are displayed as claims, not trust proof. Executable tools, MCP, arbitrary network/file access, and general custom schemas remain unavailable.

- Installation first copies the candidate into a quarantine area, parses its manifest without execution, computes hashes, and displays source, publisher, signature/checksum status, task kinds, permissions, and compatibility.
- Declarative instruction/schema skills are the default trust class and cannot execute code, read arbitrary files, access credentials, use the network, or cross projects.
- Local tools, remote tools/MCP, executable extensions, and ComfyUI custom nodes are separate higher-risk classes. Each requires explicit permission, allowlisting, isolation, time/output limits, dependency review, and security/compatibility tests before enablement.
- Permissions are granted per skill version and project or deliberately approved wider scope. An update invalidates the old grant until its changed permissions and compatibility are reviewed.
- The router sends only the selected task context. Required skills must return schema-valid output or tool results and an execution receipt; a model statement that it “used” a skill is not evidence.
- Skill logs and receipts contain hashes and sanitized calls/results, never provider keys, authorization headers, unrelated creative content, or arbitrary local paths.
- Removing a skill does not delete historic receipts or outputs. Existing drafts retain provenance and can still be opened; rerunning requires a compatible installed version.

## 6. Creative rights and consent

Every external or sensitive asset can carry:

- Creator/source.
- License/permission type and evidence path.
- Permitted projects, territories, platforms, and duration where relevant.
- Attribution/credit text.
- Restrictions on modification, cloning, or redistribution.
- Review/expiry date.

Voice reference and recognizable likeness use requires explicit authorization. The release gate flags missing evidence; it cannot guarantee legal sufficiency. Commercial model licenses and provider terms are rechecked before public/monetized release.

Pose/reference clips, adaptation datasets, generated/imported foley, and sound libraries also require project-scoped source/rights records. An adaptation dataset is never shared across projects or uploaded to a training job without an explicit preview and authorization.

Before a YouTube package is locked, a human records made-for-kids status, applicable altered/synthetic-media disclosure, packaging truth, originality, complete rights/credits, and full-watch confirmation. The studio may show the project profile as creative context, explain current rules, and flag missing evidence, but it never maps `ageBand`, `youtubePositioning`, animation style, or model output into a policy/legal answer or lets analytics waive an unresolved concern.

## 7. Backup policy

Recommended baseline:

- **Working copy:** local project workspace.
- **Local backup:** separate physical drive or managed backup location.
- **Off-device backup:** encrypted cloud or another physically separate copy chosen by the user.

Backup types:

| Type | Contents | Frequency |
| --- | --- | --- |
| Metadata checkpoint | JSON, manifests, creative-direction versions, SQLite snapshot, small docs | Before/after significant approval, direction revision, or migration |
| Incremental media backup | New/changed approved assets and takes | Daily during active production or user policy |
| Release archive | Master, selected public thumbnail, release details/chapters/captions, attestations, QC/checklist, manifests, bibles, timeline, rights, compatibility matrix, and attached platform identity/evidence | Every published episode/film |

Temporary caches, models, rejected previews, and reproducible reports may use different retention policies. The backup preview shows what is excluded.

## 8. Backup operation

Current implementation boundary: the desktop UI can create a complete local backup in the application backup root and shows success only after verification. Each completed generation contains `backup.json` plus `snapshot/`; the manifest records project identity, application version, file count, byte count, and a SHA-256/size inventory. Symbolic links, special files, SQLite WAL/SHM files after checkpoint, transient `.tmp` files, unsafe paths, incomplete generations, extra files, missing files, and checksum mismatches fail closed. Incremental copying, user-selected/off-device destinations, retention policy, and release archives remain planned.

1. Acquire project read-consistency barrier; active generation may continue but new completed artifacts wait for the next snapshot.
2. Create SQLite online snapshot.
3. Inventory canonical files and hashes.
4. Copy new/changed files to temporary backup generation.
5. Verify sizes and hashes.
6. Atomically mark backup complete with inventory and application/schema versions.
7. Retain previous known-good backup according to policy.

The UI must never say “Backed up” before verification.

## 9. Restore drill

Current implementation boundary: Settings lists only backup generations that pass current verification. Restore always targets the canonical project folder only when it is absent, copies through an isolated temporary folder, re-verifies every file and the SQLite database, atomically activates the completed copy, rebuilds the catalog entry, and leaves the backup intact. It never overwrites a project already in the library. A restored schema-1 project remains usable and receives the same explicit v1→v2 preview/backup/migration path. Representative-media playback, explicit post-restore activation confirmation, future schema-migration breadth, and clean-machine AT-030 evidence remain planned.

Restore is tested, not assumed:

1. Choose backup and view date/version/content summary.
2. Restore to a new folder by default; never overwrite the active project first.
3. Verify manifest/file hashes.
4. Open database or rebuild index from canonical files.
5. Run schema and dependency checks.
6. Verify representative images/audio/video.
7. Compare counts and last approvals.
8. Activate restored project only after user confirmation.

At least one restore drill is required before the first full episode enters bulk generation.

## 10. Crash and restart recovery

On startup the orchestrator:

- Checks for interrupted atomic file writes.
- Runs SQLite integrity and migration-state checks.
- Reconciles jobs in non-terminal external states.
- Searches provider resources tagged to this studio account/session.
- Reconnects or terminates according to lease deadline and user policy.
- Verifies downloaded artifacts that had not reached success state.
- Presents one recovery summary rather than silently acting on ambiguous cases.

No new paid worker is created until reconciliation proves an old one does not already exist.

## 11. Recovery scenarios

### Desktop crashed while GPU runs

1. Remote watchdog keeps the hard deadline.
2. On restart, find lease by stored ID/tags.
3. Reconnect and resume event cursor if safe.
4. If state is unknown, drain/terminate rather than create another worker.
5. Recover/download verified outputs and reconcile cost.

### Internet outage

- Worker processes only the already authorized queue and stops at lease/budget deadline.
- Desktop shows last known active-spend deadline.
- Reconcile provider state when connection returns.

### Model/workflow update breaks output

- Stop promotion.
- Keep affected test outputs and report.
- Restore previous compatibility defaults.
- Existing project manifests remain unchanged.
- Update decisions/sources/changelog before trying a revised candidate.

### Upstream update breaks adapter

- Update script restores previous submodule commit on failed verification.
- Existing imported source remains available.
- No project migration runs.
- Record compatibility failure; fix adapter against candidate in a branch.

### Local disk loss

- Install compatible studio version.
- Restore newest verified backup to a new path.
- Rebuild model cache separately if needed.
- Verify release archives and project state before new generation.

## 12. Retention and deletion

- Archive is default and reversible within the local project.
- Physical deletion preview lists exact files, versions, dependencies, backup presence, and recoverability.
- Approved masters/manifests used in a release cannot be deleted without first creating and verifying a release archive.
- Remote purge targets an exact session project root and returns an inventory/result; it never targets the volume root.
- Provider termination deletes compute, not the persistent model cache.

## 13. Support bundle

Current implementation boundary: Settings explains the included/excluded categories and creates a local JSON file only after queued events are flushed, parsed against the event contract, redacted again, and scanned for known secret formats. It contains application/runtime state and up to 2,000 recent sanitized events from at most eight local session logs. It excludes credential values, provider payloads, project titles/paths/content, scripts, prompts, and all image/audio/video media; it is never transmitted automatically. The renderer has no generic logger—it can submit only a bounded schema-validated error-boundary message/component trace through trusted IPC. Retention UI, optional user-selected metadata/content, broader external-skill/worker patterns, and a packaged-profile scan remain planned.

A support bundle may contain:

- Application/OS versions.
- Redacted settings and compatibility matrix.
- Sanitized state transitions and errors.
- Selected manifest metadata without creative prompt/content unless the user opts in.
- Documentation/check results.

Before creation, show included categories. Run automated secret scans. The bundle is saved locally and never uploaded automatically.

## 14. Security/recovery release gates

- Credential leakage tests pass.
- Public-port scan confirms ComfyUI is unreachable externally.
- External-skill permission, path, network, timeout, output-validation, required-receipt, and cross-project tests pass.
- Writing-provider secret scans and task-context disclosure tests pass for the mocked OpenAI, Anthropic, and Gemini adapter boundary; packaged and live-provider scans remain required.
- Creative-direction version files and writing source lineage reject wrong-project or stale-profile use; no direction field can satisfy a release attestation.
- Local media protocol rejects unauthorized paths, and proxy failure/rebuild tests prove original hashes are unchanged.
- Wrong-project and path-traversal tests pass.
- Forced desktop/network/worker failures demonstrate bounded termination.
- Duplicate-create reconciliation test passes.
- Backup and clean-machine restore drill passes.
- Worker image/model/workflow verification rejects tampering.
- Rights-required assets block release when evidence is absent.
- Release-package lock fails when an audience/disclosure/truth/originality/full-watch decision is unresolved or any selected input changed after preview.
- YouTube report imports reject malformed, oversized, duplicate, simulated-as-real, wrong-window, and wrong-project/profile evidence.
- If the optional analytics connector is implemented, its requested/granted scopes and adapter surface prove it cannot insert, update, delete, schedule, or publish channel content.

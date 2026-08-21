# Security, rights, backup, and recovery

## 1. Protection goals

- Prevent unauthorized cloud spend.
- Keep scripts, unreleased episodes, character references, voices, and credentials private.
- Prevent one project from accessing another project's assets.
- Preserve creative history and approved media through crashes or failed updates.
- Make remote execution temporary, authenticated, bounded, and auditable.
- Record rights and consent for sensitive source material.

### Current foundation controls

Version 0.2.0 implements renderer sandboxing, context isolation, disabled renderer Node integration, restrictive content security policy, custom production protocol, blocked navigation/new windows, narrow schema-validated preload methods, top-frame/origin IPC validation, project-root containment, ULID-scoped folders, atomic canonical manifest writes, and startup catalog reconciliation.

Credential vault storage, structured redaction/support bundles, backups, restore, migration rollback, single-writer locks, worker authentication, remote cleanup, watchdogs, and security-suite evidence are not implemented. Generation and cloud setup remain unreachable, so the current application cannot start billable compute.

## 2. Main threats

| Threat | Primary control |
| --- | --- |
| Leaked provider API key | OS credential vault, redaction, least privilege, rotation |
| Publicly exposed ComfyUI | Loopback binding; authenticated gateway only |
| Abandoned billable GPU | Local + remote watchdogs, hard deadline, startup reconciliation |
| Duplicate worker after timeout | Idempotency tags and provider reconciliation |
| Malicious/invalid workflow | Signed allowlisted workflow hash and worker capability check |
| Path traversal or project crossover | Project-scoped roots/tokens, normalized paths, isolation tests |
| Untrusted upstream/model update | Pins, checksums, source/license review, sandboxed tests, rollback |
| Lost/corrupt local disk | Verified backups and restore drills |
| Remote volume loss | Treat as rebuildable cache, never authoritative project store |
| Voice/likeness misuse | Rights/consent records and release gate |
| Secret in support bundle/log | Structured redaction and automated secret scanning |

## 3. Credential handling

- Provider keys and optional service tokens are stored only through the operating-system credential vault.
- The renderer receives opaque connection status, not secret values.
- The main process injects credentials directly into adapter calls.
- Logs replace tokens, authorization headers, signed URLs, and likely secret patterns with `[REDACTED]`.
- Project export and backup exclude credential stores.
- Credential test, rotation, and removal are explicit settings actions.
- A worker receives a short-lived session token, never the main provider key unless a narrowly scoped termination design absolutely requires it and passes threat review.

## 4. Worker network and runtime

- ComfyUI and model services bind to loopback.
- Gateway exposes only documented routes over authenticated encryption.
- Tokens bind to project, lease, expiry, and permissions.
- Uploads have size, type, path, and hash checks.
- Worker runs as a non-root user where GPU/runtime permits.
- Job directories are worker/session/project scoped.
- Workflow and model files are allowlisted by exact hash.
- Worker refuses arbitrary shell commands, file paths, URLs, custom-node installation, or model downloads from a job.
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

An upstream or model Git branch name such as `main` is not a production pin.

## 6. Creative rights and consent

Every external or sensitive asset can carry:

- Creator/source.
- License/permission type and evidence path.
- Permitted projects, territories, platforms, and duration where relevant.
- Attribution/credit text.
- Restrictions on modification, cloning, or redistribution.
- Review/expiry date.

Voice reference and recognizable likeness use requires explicit authorization. The release gate flags missing evidence; it cannot guarantee legal sufficiency. Commercial model licenses and provider terms are rechecked before public/monetized release.

## 7. Backup policy

Recommended baseline:

- **Working copy:** local project workspace.
- **Local backup:** separate physical drive or managed backup location.
- **Off-device backup:** encrypted cloud or another physically separate copy chosen by the user.

Backup types:

| Type | Contents | Frequency |
| --- | --- | --- |
| Metadata checkpoint | JSON, manifests, SQLite snapshot, small docs | Before/after significant approval or migration |
| Incremental media backup | New/changed approved assets and takes | Daily during active production or user policy |
| Release archive | Final package, manifests, bibles, timeline, rights, compatibility matrix | Every published episode/film |

Temporary caches, models, rejected previews, and reproducible reports may use different retention policies. The backup preview shows what is excluded.

## 8. Backup operation

1. Acquire project read-consistency barrier; active generation may continue but new completed artifacts wait for the next snapshot.
2. Create SQLite online snapshot.
3. Inventory canonical files and hashes.
4. Copy new/changed files to temporary backup generation.
5. Verify sizes and hashes.
6. Atomically mark backup complete with inventory and application/schema versions.
7. Retain previous known-good backup according to policy.

The UI must never say “Backed up” before verification.

## 9. Restore drill

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
- Wrong-project and path-traversal tests pass.
- Forced desktop/network/worker failures demonstrate bounded termination.
- Duplicate-create reconciliation test passes.
- Backup and clean-machine restore drill passes.
- Worker image/model/workflow verification rejects tampering.
- Rights-required assets block release when evidence is absent.

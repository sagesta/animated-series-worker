# Change control and documentation governance

Version-0.9 rule: `docs/PRODUCTION_IMPLEMENTATION.md` is the implementation overlay and `docs/STATUS.md` is the evidence boundary. Every runtime/model/workflow/provider/security/release fix must update those documents plus the affected detailed specification, backlog, traceability, sources, tests, and changelog in the same change. A candidate change invalidates its old fingerprint and cannot edit a production pack in place.

## 1. Outcome

Future features and fixes must not make this documentation stale. Documentation, contracts, migrations, tests, and operational behavior are one change—not separate cleanup work.

## 2. Change classes

| Class | Examples | Required records |
| --- | --- | --- |
| Documentation-only | Clarification with no behavior change | Affected docs, changelog if user-visible |
| UI behavior | New screen/action/error wording | PRD/UX, tests, traceability, changelog |
| Domain/schema | New field/state/dependency/migration | PRD, domain, contracts, migration/rollback, tests, traceability, changelog |
| Media workflow | Prompt, model, node graph, audio/export setting | Media pipeline, sources/license, benchmark, compatibility, tests, changelog |
| GPU/provider | Lifecycle, price assumption, template, watchdog | Architecture/GPU/cost/security, tests, source refresh, changelog |
| Upstream update | New submodule commit | Lock, compatibility report, upstream docs, sources/license, tests, changelog |
| Security/privacy | Credential, network, retention, rights | Security, threat/rollback tests, PRD where behavior changes, changelog |
| Emergency fix | Spend/data/security incident | Same affected documents/tests before incident closure; rollback evidence |

## 3. Required change sequence

1. State the user problem and requirement IDs.
2. Inspect current behavior, manifests, schema, versions, and dependencies.
3. Classify data, spend, security, compatibility, and documentation impact.
4. Update or add an accepted decision when architecture/product direction changes.
5. Design migration and rollback before editing durable data.
6. Implement behind existing contracts or version the contracts explicitly.
7. Add failure-path and acceptance tests.
8. Update every affected document and traceability row.
9. Update changelog with user impact, migration, documentation, and rollback.
10. Run automated checks and capture required release evidence.

No behavioral code change is complete at step 6.

## 3.1 Backlog intake and stacking

- Every accepted new capability, discovered production risk, or required fix is added to [BUILD_BACKLOG.md](BUILD_BACKLOG.md) with a stable ID, phase, status, dependency, and exit proof.
- New work does not silently replace unfinished work. Priority may change, but removed or superseded work requires a recorded reason and retains history.
- A broad item is split into child work packages when implementation evidence makes the split useful.
- “Documented” and “implemented” remain different states. Only the named test or release evidence can move an item to `Verified`.
- The backlog, implementation plan, status, traceability, and changelog are reconciled whenever an item's scope or completion claim changes.

## 4. Documentation impact map

| Changed area | Documents to inspect/update |
| --- | --- |
| Scope/requirement | `PRD.md`, `STATUS.md`, `TRACEABILITY.md`, `DECISIONS.md` |
| User workflow | `UX_SPEC.md`, `PRODUCTION_WORKFLOW.md`, `GLOSSARY.md` |
| Component/boundary | `ARCHITECTURE.md`, `API_CONTRACTS.md`, `DECISIONS.md` |
| Data/version/migration | `DOMAIN_MODEL.md`, `API_CONTRACTS.md`, `SECURITY_AND_RECOVERY.md` |
| Audience/niche/creative direction | `CREATIVE_DIRECTION_PROFILE.md`, `PRD.md`, `UX_SPEC.md`, `PRODUCTION_WORKFLOW.md`, every consuming compiler contract, and the YouTube attestation boundary |
| Image/voice/video/audio/export | `MEDIA_PIPELINE.md`, `COST_MODEL.md`, `SOURCES.md` |
| Cloud/worker/provider | `GPU_OPERATIONS.md`, `ARCHITECTURE.md`, `COST_MODEL.md`, `SECURITY_AND_RECOVERY.md`, `SOURCES.md` |
| Tests/release evidence | `TEST_PLAN.md`, `TRACEABILITY.md`, `STATUS.md` |
| Upstream dependency | `UPSTREAM_INTEGRATION.md`, lock file, `SOURCES.md` |
| Build phase/order | `IMPLEMENTATION_PLAN.md`, `STATUS.md` |

“Inspect” means confirm it remains correct, not automatically add meaningless edits.

## 5. Versioning

- Studio application: Semantic Versioning.
- Project and contract schemas: positive integer major plus compatible minor where needed.
- Workflows: Semantic Versioning and content hash.
- Worker image: release version plus immutable image digest.
- Models: repository/name, exact revision and file checksum.
- Upstream: exact Git commit.
- Production assets: immutable per-entity version numbers and hashes.
- Audience & Creative Direction: immutable project-sidecar revision, profile ID, and content hash; later jobs pin one exact revision.
- Documentation: changes with product version; external facts carry verification dates.

Changing a default does not rewrite historical manifests.

## 6. Decision changes

To reverse an accepted decision:

- Add a new decision row; do not erase the old rationale.
- State new evidence and reversal trigger.
- Map affected requirements, components, data, active projects, model/cache storage, costs, security, and UI.
- Define compatibility/migration and rollback.
- Run the locked benchmark and acceptance subset.
- Apply prospectively unless an explicit safe migration is approved.

## 7. Fix policy

### Normal fix

A bug fix includes:

- Reproduction and root cause.
- A regression test that fails before and passes after.
- Corrected behavior and error/recovery path.
- Documentation updated to match actual behavior.
- Changelog and traceability where affected.

### Emergency spend/data/security incident

Immediate reversible containment or rollback may happen first. Before the incident is closed or a forward fix is released:

- Document actual impact and affected versions.
- Add regression/failure test.
- Update operations/recovery/user guidance.
- Record data repair/migration and rollback.
- Reconcile provider cost/data state.

There is no permanent “hotfix now, documentation someday” state.

## 8. Stale production behavior

A software/model/workflow fix does not silently modify approved creative history.

- Correcting an engine creates a new workflow version.
- Existing take manifest remains truthful.
- The impact engine can recommend new takes for affected shots.
- The user decides whether released, approved, or in-progress work should be regenerated.
- Critical security/rights issues can block reuse/export while still preserving evidence.

## 9. Review checklist

- [ ] User outcome and requirement IDs identified.
- [ ] Current status and evidence described honestly.
- [ ] No upstream files edited.
- [ ] Schema/workflow/model/provider versions pinned.
- [ ] Data migration has preview, backup, verify, rollback.
- [ ] Paid external actions remain idempotent and bounded.
- [ ] Project isolation and secret handling reviewed.
- [ ] Failure/recovery tests added.
- [ ] Human benchmark run when media behavior changed.
- [ ] All affected documentation updated.
- [ ] Traceability and changelog updated.
- [ ] Sources/prices/licenses reverified where relevant.
- [ ] `node scripts/check-docs.mjs` passes.
- [ ] Status does not claim unproven completion.

## 10. Automated documentation checks

`scripts/check-docs.mjs` verifies at minimum:

- Required authoritative documents exist.
- Relative Markdown links resolve.
- Every PRD requirement ID appears in traceability.
- No duplicate PRD requirement definitions.
- Upstream submodule commit agrees with `config/upstream.lock.json` when Git is available.
- Decision IDs are not duplicated.

Later quality tooling should also compare changed behavior paths with documentation/changelog changes and validate machine-readable contracts against examples.

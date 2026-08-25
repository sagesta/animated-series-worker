# Implementation and release plan

Version: 0.10.1

Last updated: 2026-08-25

## 1. Outcome

The local application and locked production architecture are implemented. Delivery now proceeds by evidence gates: qualify the exact remote runtime, prove a short pilot, prove long-form production, then sign and release. No remaining external gate may be bypassed by changing a UI flag or filling a receipt manually without its linked evidence.

## 2. Completed implementation stages

| Stage | Implemented outcome | Main packages/files |
| --- | --- | --- |
| 1. Local foundation | Secure Windows shell, guided forms, projects, database, backup, restore, migration, diagnostics | `apps/desktop`, `contracts`, `project-store`, `diagnostics` |
| 2. Creative development | Direction profile, protected writing providers, declarative skills, proposals, upstream import | `creative-writing`, provider packages, `skill-runtime`, `upstream-adapter` |
| 3. Canon and media | Versioned canon, media lineage/dependencies, approvals, local review protocol and players | `production-store`, desktop media protocol, World/Storyboard/Review rooms |
| 4. Governed workflows | Candidate/qualified registry, exact parameters/templates/nodes/models/fingerprints, estimates | `workflow-registry`, `config/workflow-pack.candidate.json` |
| 5. Cloud control | Official RunPod lifecycle, leases, idempotency, cost approval, separate start confirmation, concurrency | `provider-runpod`, `production-orchestrator`, `cloud-setup` |
| 6. Remote worker | Docker pins, model bootstrap, loopback ComfyUI, authenticated gateway, preflight/watchdog, transfers, runners | `worker`, `worker-client`, model manifest |
| 7. Review and finishing | Output import/review, deterministic local timeline, captions, thumbnail, technical verification | `local-media`, `local-production`, `release-store`, Finish room |
| 8. Manual release | Release details, human attestations, immutable YouTube upload package | `release-store`, Finish room |
| 9. Qualification enforcement | Candidate-only controlled mode, evidence bundle, guarded atomic promotion, readiness verification | `production-readiness`, qualification/promotion scripts |
| 10. Guided ideas and release learning | Field-level governed proposal assistant, release-profile versions, Idea Library, checked official-report CSV import, performance snapshots, reviewed prospective learnings | renderer, `creative-writing`, `release-store`, contracts |
| 11. Advanced candidate foundations | Neutral control/layer/dataset roles, hash-locked control-guided Qwen/LTX graphs, exact model-free foley runner, rights-reviewed adaptation dataset builder, and official isolated LTX trainer candidate | contracts, production store/orchestrator, worker, candidate workflow pack |
| 12. Resumable creator workflow | One recommended next step plus an eight-checkpoint story-to-master/cleanup projection and secondary prerequisite-gated Image/Video/Audio/Composition/Assemble handoff | Creator Mode, Generate room, Finish room, canon/media/job/timeline/worker summaries |

## 3. Gate A — controlled remote qualification

Prerequisites:

1. Reverify the imported API-format Qwen/LTX workflow hashes and reviewed node inventories against the built image.
2. Complete model/transitive-license review.
3. Build and push the exact candidate worker image.
4. Run model bootstrap and retain its hash receipt.
5. Run preflight and retain the exact capability report.
6. Execute every mandatory benchmark, security, recovery, shutdown, and cost fixture.
7. Confirm the provider terminated compute and record any retained storage cost.
8. Run the promotion tool.

Exit: `workflow-pack.production.json`, `model-install-manifest.production.json`, and `production-readiness.json` agree by hash/digest and the app reports generation ready. A production worker pulled by digest passes preflight again.

Rollback: retain candidate/evidence, delete only the newly failed candidate runtime, and continue using the last qualified production trio. The promotion tool never overwrites that trio.

## 4. Gate B — 60–90 second pilot

The pilot must exercise recurring character identity, an environment, multiple shots, voice design and line book, LTX draft/final, at least one animated lip-repair fixture, local edit, captions, thumbnail, release details, full-watch/rights/disclosure decisions, package verification, cancellation/recovery, and provider cost reconciliation.

Exit: human approvals and technical checks pass; exact cost/runtime/VRAM/retry evidence is attached; worker shutdown is confirmed; no local/cloud asset loss occurs.

If the pilot fails, change only the failing candidate workflow/model/parameter profile, increase its version, and rerun Gate A for affected runtime content. Existing approved assets remain linked to the earlier manifest.

## 5. Gate C — long-form episode and one-off film

Produce one 20–35 minute episode using hybrid editorial construction, not continuous generation. Reuse approved holds, loops, pans, reactions, ambience, and cutaways where creatively appropriate. Then produce a separate one-off film project to prove the same components do not require season continuity.

Exit:

- character/style/voice/location isolation across at least two projects;
- interruption and restart during a representative long queue;
- two or three independent concurrent GPU jobs stay inside combined limits;
- local master, captions, thumbnail, release metadata, attestations, inventory and hashes pass;
- cost report distinguishes estimate, elapsed estimate, and provider-reconciled actual spend;
- a creator can complete the flow without terminal or ComfyUI interaction.

## 6. Gate D — Windows release

1. Run configuration, syntax, type, lint, unit, integration, renderer, docs, secret, and packaging checks.
2. Build the Windows unpacked directory and NSIS installer.
3. Sign installer and executable with the production certificate.
4. Test install, first run, upgrade, interrupted recovery, backup/restore, uninstall, and retained user projects on a clean supported Windows machine.
5. Run keyboard/screen-reader/contrast and representative non-technical acceptance.
6. Publish hashes, signature identity, release notes, migration, rollback, exact production workflow pack/image digest, and support steps.

## 7. Future changes

Every model, worker, ComfyUI, custom-node, workflow, base-image, GPU, YouTube rule, provider API, or security change starts as a new candidate. Update requirements/decision/source records, run affected automated tests, repeat the controlled evidence subset, and promote prospectively. Never mutate an installed production pack in place and never rewrite old manifests.

## 8. Definition of done

A work item is done only when behavior, validation, failure handling, recovery, secrets, project isolation, cost, tests, docs, migration, and rollback are addressed. “Implemented” may describe local code. “Qualified” requires the named external evidence. “Production release” additionally requires the signed clean-machine and representative-user gates.

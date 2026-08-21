# Requirements traceability

This matrix prevents requirements from becoming disconnected from architecture, implementation, tests, and user documentation. The documentation checker requires every `FR` and `NFR` defined in `PRD.md` to appear here.

## Functional requirements

| Requirements | Primary design | Planned components | Acceptance evidence |
| --- | --- | --- | --- |
| FR-001, FR-002, FR-003, FR-004 | `DOMAIN_MODEL.md`, `UX_SPEC.md` | `apps/desktop`, `project-store`, `domain` | AT-001, AT-002, AT-031 |
| FR-005, FR-006 | `ARCHITECTURE.md` §9, `UPSTREAM_INTEGRATION.md` | `upstream-adapter` | AT-005, AT-006 |
| FR-007, FR-008, FR-009, FR-010 | `DOMAIN_MODEL.md` §3–5, `UX_SPEC.md` §5 | `domain`, `project-store`, `orchestrator` | AT-003, AT-011, AT-028 |
| FR-011, FR-012, FR-013, FR-014 | `MEDIA_PIPELINE.md` §2, `PRODUCTION_WORKFLOW.md` §5 | `engine-qwen-image`, image workflows, review UI | AT-009, AT-020 |
| FR-015, FR-016, FR-017, FR-018, FR-019 | `MEDIA_PIPELINE.md` §3, `DOMAIN_MODEL.md` voice profile | `engine-qwen-tts`, audio store, caption service | AT-010, AT-011, AT-012, AT-021 |
| FR-020, FR-021, FR-022, FR-023 | `ARCHITECTURE.md` §9, `PRODUCTION_WORKFLOW.md` §7 | normalized shot plan, orchestrator | AT-007, AT-023, AT-024 |
| FR-024, FR-025, FR-026, FR-027 | `GPU_OPERATIONS.md` §3–7 | setup wizard, `provider-runpod`, worker watchdog | AT-013, AT-015, AT-018, AT-019 |
| FR-028, FR-029, FR-030 | `ARCHITECTURE.md` §8/11/12, `API_CONTRACTS.md` | orchestrator, provider, worker gateway | AT-014, AT-016, AT-017, AT-029 |
| FR-031, FR-032 | `UX_SPEC.md` §8, `MEDIA_PIPELINE.md` §4 | review UI, take service | AT-022, AT-023 |
| FR-033, FR-034, FR-035, FR-036 | `MEDIA_PIPELINE.md` §7–9, `PRODUCTION_WORKFLOW.md` §10–11 | media/timeline/export packages | AT-025, AT-026, AT-027, AT-028 |
| FR-037, FR-038 | `COST_MODEL.md` | estimator, cost ledger, benchmark store | AT-018, AT-024, AT-029, AT-032 |
| FR-039 | `ARCHITECTURE.md` §10, `DOMAIN_MODEL.md` manifest | contracts, project store, every engine | AT-020, AT-022, AT-025 |
| FR-040 | `SECURITY_AND_RECOVERY.md` §7–10 | backup/restore, project store | AT-001, AT-030 |
| FR-041 | `UPSTREAM_INTEGRATION.md` | update script, upstream adapter | AT-005, AT-008 |
| FR-042 | `MEDIA_PIPELINE.md` §10, `CHANGE_CONTROL.md` | compatibility/benchmark promotion | AT-009, AT-010, AT-020 |
| FR-043 | `SECURITY_AND_RECOVERY.md` §6 | rights registry, release gate | AT-012, AT-026 |
| FR-044, FR-045 | `ARCHITECTURE.md` writing-provider boundary, `API_CONTRACTS.md` writing contract, `UX_SPEC.md` provider settings | `provider-openai`, `provider-anthropic`, writing orchestrator, credential vault | AT-036, AT-039 |
| FR-046, FR-047, FR-048 | `ARCHITECTURE.md` skill runtime, `API_CONTRACTS.md` skill contracts, `SECURITY_AND_RECOVERY.md` extension controls | skill registry, router, permission broker, execution-receipt store | AT-037, security suite |
| FR-049, FR-050 | `ARCHITECTURE.md` media-review flow, `UX_SPEC.md` review screen, `MEDIA_PIPELINE.md` | artifact service, local media protocol, gallery/player, proxy service | AT-038, AT-040 |
| FR-051 | `DOMAIN_MODEL.md` character/style bindings, `UX_SPEC.md` scoped style-change flow, `MEDIA_PIPELINE.md` character workflow | continuity/impact engine, image engine, review UI | AT-003, AT-009, AT-041 |
| FR-052 | `PRODUCTION_WORKFLOW.md` timed animatic gate, `DOMAIN_MODEL.md` animatic version, `UX_SPEC.md` animatic flow | previsualization, timeline, project store | AT-042 |
| FR-053 | `ARCHITECTURE.md` control assets, `API_CONTRACTS.md` control-pack contract, `MEDIA_PIPELINE.md` control compilation | previsualization, control registry, image/video adapters | AT-043, AT-045 |
| FR-054 | `MEDIA_PIPELINE.md` layered workflow, `DOMAIN_MODEL.md` layered composite | image engine, previsualization, media/timeline | AT-044 |
| FR-055 | `MEDIA_PIPELINE.md` advanced LTX profiles, `ARCHITECTURE.md` compatibility model | engine-ltx, workflow registry, benchmark store | AT-020, AT-045, AT-049 |
| FR-056 | `ARCHITECTURE.md` creative QC, `MEDIA_PIPELINE.md` assistive checks, `API_CONTRACTS.md` artifact contract | creative-qc, media probes, speech verifier, review UI | AT-046 |
| FR-057 | `MEDIA_PIPELINE.md` ambience/effects/foley, `DOMAIN_MODEL.md` audio-effects cue | engine-audio-fx, rights registry, timeline/mix | AT-047 |
| FR-058 | `MEDIA_PIPELINE.md` optional adaptation, `DOMAIN_MODEL.md` adaptation profile, `SECURITY_AND_RECOVERY.md` dataset controls | adaptation, benchmark store, project store | AT-048, AT-049 |

## Non-functional requirements

| Requirements | Primary design | Planned components | Acceptance evidence |
| --- | --- | --- | --- |
| NFR-001 | `UX_SPEC.md` | packaged desktop and setup wizard | AT-013, AT-024, AT-035 |
| NFR-002 | `CHANGE_CONTROL.md`, `UX_SPEC.md` impact/spend previews | domain, orchestrator, UI | AT-003, AT-008, AT-018, AT-028 |
| NFR-003 | `ARCHITECTURE.md` §12, `SECURITY_AND_RECOVERY.md` | durable queues, reconciliation, backup | AT-004, AT-014–AT-016, AT-030 |
| NFR-004 | `DOMAIN_MODEL.md`, `API_CONTRACTS.md` artifact/manifest | project store, engines, worker | AT-020, AT-022, AT-025 |
| NFR-005 | `SECURITY_AND_RECOVERY.md` §3–5 | credential vault, gateway, signed image | security suite, AT-013, AT-015 |
| NFR-006 | `ARCHITECTURE.md` trust boundaries, `SECURITY_AND_RECOVERY.md` | project isolation, purge, scoped tokens | AT-002, AT-031, security suite |
| NFR-007 | `DOMAIN_MODEL.md` §6–9, backup design | project store, export/rebuild | AT-001, AT-030 |
| NFR-008 | `ARCHITECTURE.md` component boundaries, `API_CONTRACTS.md` | adapters and contracts | AT-005, AT-008, AT-020 |
| NFR-009 | `GPU_OPERATIONS.md` §11, `COST_MODEL.md` §11 | logs, events, cost ledger | AT-013–AT-019, AT-029 |
| NFR-010 | `ARCHITECTURE.md` async orchestration, `UX_SPEC.md` | desktop IPC, worker events/transfers | AT-016, AT-024, performance suite |
| NFR-011 | `UX_SPEC.md` §10–12 | UI kit and accessibility tests | AT-035 |
| NFR-012 | `CHANGE_CONTROL.md`, `AGENTS.md` | docs checker, PR template | AT-033 |
| NFR-013 | `ARCHITECTURE.md` §10, `UPSTREAM_INTEGRATION.md` | compatibility matrix and release tooling | AT-005, AT-008, AT-034 |
| NFR-014 | `GPU_OPERATIONS.md` §6–7 | remote watchdog and provider guard | AT-015, AT-018, AT-019 |
| NFR-015 | `ARCHITECTURE.md` writing-provider boundary, `DOMAIN_MODEL.md` canonical versions | provider adapters, project store | AT-036, AT-039 |
| NFR-016 | `ARCHITECTURE.md` skill runtime, `SECURITY_AND_RECOVERY.md` extension controls | skill registry/router, permission broker, receipts | AT-037, security suite |
| NFR-017 | `ARCHITECTURE.md` media-review flow, `MEDIA_PIPELINE.md` artifact handling | local media protocol, proxy service, review UI | AT-038, AT-040 |
| NFR-018 | `ARCHITECTURE.md` remote worker, `SECURITY_AND_RECOVERY.md` worker controls, `GPU_OPERATIONS.md` execution | worker image, gateway, workflow registry | AT-045, AT-049, security suite |
| NFR-019 | `ARCHITECTURE.md` creative QC, `API_CONTRACTS.md` authorization boundary, `UX_SPEC.md` review warnings | creative-qc, review UI, authorization service | AT-046, security suite |

## Current implementation evidence — version 0.3.0

| Requirement slice | State | Implemented components/evidence | Remaining acceptance boundary |
| --- | --- | --- | --- |
| FR-001–FR-004 project foundation | Partial | `apps/desktop`, `contracts`, `domain`, `project-store`; project-store and renderer AT-001 foundation tests | Close, archive, backup/restore, production-unit hierarchy, and full cross-project access controls |
| FR-024 cloud setup | Partial | `credential-vault`, `cloud-setup`, `provider-runpod`, typed IPC, and guided Settings UI validate/store/refresh/remove the key, read aggregate Pods and current catalogue prices, and save local defaults without a provider mutation | Network volume, pinned worker, minimum-cost smoke, purge, watchdog, termination, cost receipt, and full AT-013 |
| NFR-001 non-technical operation | Partial | Guided series/film wizard and unpacked Windows application; no terminal inside the app | Installer/first-run/cloud/pilot usability acceptance AT-013/AT-024/AT-035 |
| NFR-005 secret protection | Partial | Electron asynchronous `safeStorage`/Windows DPAPI adapter, encrypted bytes outside project roots, opaque renderer status, safe provider errors, explicit removal, and plaintext non-leakage tests | Redacted logging/support scan, clean-machine credential persistence/upgrade, worker tokens, gateway, and security suite |
| NFR-006 project privacy/isolation | Partial | ULID-scoped folders, root-containment check, same-title isolation and invalid-identity tests | Asset/query/cache/token crossover and remote purge/security suite |
| NFR-007 portability | Partial | Canonical schema-1 `project.json`, documented folder layout, rebuildable local catalog | Export, backup, restore, media inventory, and clean-machine AT-030 |
| NFR-011 accessibility | Partial | Semantic controls, labels, focus-visible states, keyboard wizard navigation, non-color status text, reduced-motion CSS | Automated accessibility audit and representative-user AT-035 |
| NFR-012 documentation | Implemented for this slice | `pnpm docs:check` passes with synchronized status/decision/source/test/changelog updates | Continuous enforcement on every later change |
| FR-044–FR-051 and NFR-015–NFR-017 provider/skill/media-viewing/style-change design | Documented; not implemented | Provider-neutral writing, enforced external-skill provenance, in-app media review, and scoped character redesign are now locked requirements and architecture decisions | Provider adapters, skill runtime, media protocol/player, scoped presentation bindings, tests AT-036–AT-041, and non-technical acceptance |
| FR-052–FR-058 and NFR-018–NFR-019 rich previsualization/control/QC/sound/adaptation design | Documented; not implemented | Timed animatic, neutral controls, layered parallax, advanced LTX, warning-only creative QC, separate foley, optional adaptation, and immutable runtime are locked | Packages/workflows, compatibility benchmarks, tests AT-042–AT-049, and non-technical acceptance |

## Change rule

When a requirement changes:

1. Update `PRD.md` wording and ID or add a new ID.
2. Update this matrix.
3. Update every named design document and component contract.
4. Add/update acceptance tests.
5. Update decisions, status, sources, and changelog where affected.
6. Run documentation and test suites.

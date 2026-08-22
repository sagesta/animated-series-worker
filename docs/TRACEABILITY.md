# Requirements traceability

This matrix prevents requirements from becoming disconnected from architecture, implementation, tests, and user documentation. The documentation checker requires every `FR` and `NFR` defined in `PRD.md` to appear here.

## Version 0.9 implementation overlay

| Requirement slice | Current implementation | Remaining acceptance boundary |
| --- | --- | --- |
| FR-001–FR-010, FR-043–FR-048, FR-067–FR-068 | Projects, backup/migration, direction, protected writing providers, declarative skills, upstream import, proposals and canon are implemented | Live provider/long-form/representative-user evidence; higher-risk skill classes remain locked |
| FR-011–FR-023, FR-049–FR-051 | Media store, identity/edit/voice/video job contracts, approved-input lineage, local media protocol, viewing and approval are implemented | Exact remote workflow/model qualification and season-scale continuity |
| FR-024–FR-034 | RunPod lifecycle, lease/idempotency/cost gates, worker gateway, preflight/watchdog, transfers, review and local finishing are implemented | Real Pod, model, Comfy, shutdown, recovery, concurrency, and long-form proof |
| FR-035–FR-042 | Multi-project local control, deterministic timeline, captions, technical checks and release packaging are implemented | Clean-machine full-production acceptance and signed installer |
| FR-052–FR-058 | Timed local storyboard/timeline and technical QC slice are implemented; advanced control packs, parallax, generated foley and adaptation remain planned | AT-042–AT-049 applicable live fixtures and future feature implementations |
| FR-059–FR-066 | Release details, thumbnail render, human attestations and immutable manual package are implemented; analytics/learning remains planned | Real master-package proof and future separately authorized analytics |
| NFR-001–NFR-022 | Local boundaries, schemas, vaults, isolation, async jobs, documentation, qualification locks and human authority are implemented where applicable | Named external security, provider, quality, accessibility, signing, and clean-machine evidence |

Detailed component and gate mappings are in [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md), [STATUS.md](STATUS.md), and [BUILD_BACKLOG.md](BUILD_BACKLOG.md). The original design matrix below remains the requirement-to-acceptance map; “planned components” names the intended boundary even where version 0.9 now implements it.

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
| FR-044, FR-045 | `ARCHITECTURE.md` writing-provider boundary, `API_CONTRACTS.md` writing contract, `UX_SPEC.md` provider settings | `provider-openai`, `provider-anthropic`, `provider-gemini`, writing orchestrator, credential vault | AT-036, AT-039 |
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
| FR-059 | `YOUTUBE_RELEASE_WORKFLOW.md` release profile/Idea Library, `DOMAIN_MODEL.md`, `UX_SPEC.md` | release-profile store, idea library, research adapters | AT-050 |
| FR-060 | `YOUTUBE_RELEASE_WORKFLOW.md` Thumbnail Room, `UX_SPEC.md`, `MEDIA_PIPELINE.md` | thumbnail compositor, image adapter, responsive preview, release validator | AT-051, AT-052 |
| FR-061 | `YOUTUBE_RELEASE_WORKFLOW.md` Release Details, `API_CONTRACTS.md`, `PRODUCTION_WORKFLOW.md` | release-details editor, chapter/metadata validator | AT-053 |
| FR-062 | `YOUTUBE_RELEASE_WORKFLOW.md` attestation gate, `SECURITY_AND_RECOVERY.md`, `SOURCES.md` | release-readiness and policy/rights attestation service | AT-054, security suite |
| FR-063 | `YOUTUBE_RELEASE_WORKFLOW.md` release package, `DOMAIN_MODEL.md`, `PRODUCTION_WORKFLOW.md` | release packager, inventory verifier, upload checklist | AT-055, AT-027, AT-030 |
| FR-064, FR-065 | `YOUTUBE_RELEASE_WORKFLOW.md` measurement/learning, `ARCHITECTURE.md`, `API_CONTRACTS.md` | performance importer, optional read-only connector, learning registry | AT-056, AT-057, security suite |
| FR-066 | `YOUTUBE_RELEASE_WORKFLOW.md` readiness, `UX_SPEC.md`, `ARCHITECTURE.md` | readiness aggregator, prerequisite/probe registry | AT-058, AT-013, AT-026 |
| FR-067 | `CREATIVE_DIRECTION_PROFILE.md`, `DOMAIN_MODEL.md`, `UX_SPEC.md`, `ARCHITECTURE.md` | `contracts`, `project-store`, renderer, creative-direction compiler, dependency engine, every consuming adapter | AT-059, AT-031, AT-054 |
| FR-068 | `UX_SPEC.md`, `ARCHITECTURE.md`, `SECURITY_AND_RECOVERY.md` | renderer form-guidance components, trusted IPC/domain validators | AT-060, AT-035, security suite |

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
| NFR-020 | `YOUTUBE_RELEASE_WORKFLOW.md`, `SOURCES.md`, `CHANGE_CONTROL.md` | versioned release rules, validation, attestation UI | AT-051–AT-055, security suite |
| NFR-021 | `YOUTUBE_RELEASE_WORKFLOW.md`, `DOMAIN_MODEL.md`, `API_CONTRACTS.md` | performance snapshot and learning registry | AT-056, AT-057, isolation suite |
| NFR-022 | `UX_SPEC.md`, `ARCHITECTURE.md` | renderer form guidance, accessibility tests | AT-060, AT-035 |

## Historical implementation evidence — version 0.8.0

| Requirement slice | State | Implemented components/evidence | Remaining acceptance boundary |
| --- | --- | --- | --- |
| FR-001–FR-004 project foundation | Partial | `apps/desktop`, `contracts`, `domain`, `project-store`; create/reopen plus verified series/film backup/restore, no-overwrite, tamper-refusal, and single-writer tests; automated AT-001 passes locally | Close/archive lifecycle, failure injection/migration rollback, production-unit hierarchy, clean-machine restore, and full cross-project access controls |
| FR-067 Audience & Creative Direction | Partial | Runtime schemas, six-step wizard, immutable project-sidecar creation/revision, stale-profile refusal, old-project `null` compatibility, overview display/edit, exact Creative Room preview and schema-2 source hashes, plus storage/renderer/writing tests pass | Upstream/canon/image/voice/video/thumbnail/release compiler pins, dependency impact/stale propagation, packaged/non-technical flow, and full AT-059 |
| FR-068 and NFR-022 guided validation | Partial | Reusable required markers, live length/range messages, invalid-state styling, accessible correction summaries, and no-silent-disable behavior cover project creation, creative-direction revision, writing requests, provider keys, RunPod keys, and spending defaults; renderer regression paths prove blocked calls are not made | Automated accessibility audit, clean-machine packaged review, destructive-action expansion, and representative-user AT-035/AT-060 |
| FR-024 cloud setup | Partial | `credential-vault`, `cloud-setup`, `provider-runpod`, typed IPC, and guided Settings UI validate/store/refresh/remove the key, read aggregate Pods and current catalogue prices, and save local defaults without a provider mutation | Network volume, pinned worker, minimum-cost smoke, purge, watchdog, termination, cost receipt, and full AT-013 |
| NFR-001 non-technical operation | Partial | Guided series/film wizard and unpacked Windows application; no terminal inside the app | Installer/first-run/cloud/pilot usability acceptance AT-013/AT-024/AT-035 |
| NFR-005 secret protection | Partial | Electron asynchronous `safeStorage`/Windows DPAPI adapter, encrypted bytes outside project roots, opaque renderer status, safe provider errors, explicit removal, plaintext non-leakage tests, structured redacted/flushed logs, renderer-boundary capture, and local support JSON with known-secret/path scan | Broader worker/skill/provider patterns, retention and packaged support scan, clean-machine credential persistence/upgrade, worker tokens, gateway, and security suite |
| NFR-006 project privacy/isolation | Partial | ULID-scoped folders, root-containment check, same-title isolation and invalid-identity tests | Asset/query/cache/token crossover and remote purge/security suite |
| NFR-007 portability | Partial | Current schema-2/backward-compatible schema-1 `project.json`, guided backed-up v1→v2 migration with four-point rollback evidence, documented folder layout, rebuildable local catalog, full SHA-256 inventory backups, and non-overwriting verified restore | Future-migration registry breadth, incremental/release archives, export, representative media recovery, and clean-machine AT-030 |
| NFR-011 accessibility | Partial | Semantic controls, labels, focus-visible states, keyboard wizard navigation, non-color status text, reduced-motion CSS | Automated accessibility audit and representative-user AT-035 |
| NFR-012 documentation | Implemented for this slice | `pnpm docs:check` passes with synchronized status/decision/source/test/changelog updates | Continuous enforcement on every later change |
| FR-044–FR-045 and NFR-015 provider-neutral writing | Partial | `provider-openai`, `provider-anthropic`, `provider-gemini`, `creative-writing`, credential vaults, schema-1→2 settings read, controlled catalogue, typed IPC, Settings cards, Creative Room, exact manifest/direction context preview, paid-call checkbox, structured local proposal records, and mocked tests | Live fixture accounts/provider switch, actual cost profiles, canon promotion/version comparison, task-specific benchmark defaults, broader secret evidence, and full AT-036/AT-039 |
| FR-046–FR-048 and NFR-016 declarative skill slice | Partial | `packages/skill-runtime`, writing schema 3, Settings/Creative Room, and registry/writing/renderer tests prove strict quarantine/parse/hash, project grants, matching/compatibility/permission plans, stale-plan refusal, provider instruction compilation, required-section validation, receipts, update grant revocation, and removal preservation | Signed packages, general schemas, tool/MCP isolation/timeouts, packaged scans, representative-user evidence, and complete AT-037 |
| FR-049–FR-051 and NFR-017 media-viewing/style-change design | Documented; not implemented | In-app media review and scoped character redesign remain locked requirements and architecture decisions | Media protocol/player, scoped presentation bindings, tests AT-038–AT-041, and non-technical acceptance |
| FR-052–FR-058 and NFR-018–NFR-019 rich previsualization/control/QC/sound/adaptation design | Documented; not implemented | Timed animatic, neutral controls, layered parallax, advanced LTX, warning-only creative QC, separate foley, optional adaptation, and immutable runtime are locked | Packages/workflows, compatibility benchmarks, tests AT-042–AT-049, and non-technical acceptance |
| FR-059–FR-066 and NFR-020–NFR-021 YouTube release/learning design | Documented; not implemented | Reference-repo audit plus official-source review now define profiles/ideas, truthful thumbnails, release details, human policy attestations, immutable upload packages, optional evidence import, approved learning, and unified readiness | Release components, optional read-only OAuth review, tests AT-050–AT-058, clean-machine package verification, and non-technical acceptance |

## Change rule

When a requirement changes:

1. Update `PRD.md` wording and ID or add a new ID.
2. Update this matrix.
3. Update every named design document and component contract.
4. Add/update acceptance tests.
5. Update decisions, status, sources, and changelog where affected.
6. Run documentation and test suites.

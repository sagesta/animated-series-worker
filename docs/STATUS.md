# Delivery status

Last updated: 2026-08-21

## Honest capability statement

Animated Series Studio now has a working local Windows desktop foundation, verified project backup/restore, single-writer protection, structured redacted diagnostics, and a safe RunPod account-connection slice. It creates, lists, reopens, backs up, verifies, and non-destructively restores isolated series and one-off film workspaces; validates and encrypts a RunPod API key; reads aggregate existing-Pod status and current GPU planning prices; saves local safety defaults; and creates a local-only support file after secret/path redaction. It does **not** yet create a cloud machine, persistent model storage, a worker image, or any story/image/speech/video/lip-sync/export job.

| Capability | Status | Evidence needed to advance |
| --- | --- | --- |
| Standalone repository | Complete | Git repository and isolated folder exist |
| Pinned upstream skills | Complete | Submodule lock and seven upstream test runs pass |
| Product requirements | Complete baseline | User review and future controlled revisions |
| Architecture | Complete baseline | Architecture review and implementation spikes |
| Documentation governance | Complete baseline | Documentation checker passes |
| Desktop shell | In progress — secure shell, guided project wizard, RunPod account setup, navigation, unpacked app smoke, and unsigned NSIS installer build pass on the development machine | Authenticode signing and clean-machine/non-technical install/launch evidence |
| Redacted diagnostics | In progress — structured flushed JSONL events, provider-key/Bearer/protected-field/private-path redaction, renderer-boundary capture, local-only support JSON, and UI/tests pass | Broader mutation/failure instrumentation, external-skill/worker patterns, retention, packaged secret scan, and support usability evidence |
| Project and continuity store | In progress — create/list/open, atomic schema-v2 manifest, backward-compatible schema-v1 reads, guided v1→v2 preview/verified backup/migration/rollback, per-project SQLite, catalog reconciliation, verified full backup/restore, tamper refusal, and single-writer tests pass | Archive UI, future-migration registry breadth, incremental/release policy, clean-machine restore, and full continuity tests |
| Upstream adapter | Not started | Contract tests pass against pinned upstream commit |
| OpenAI/Anthropic writing | Not started — provider-neutral contract, protected-key UX, local canonical-data rule, and separate text-cost requirement are documented | Story/character/script benchmark, adapter tests, secret non-leakage, token/cost evidence, and AT-036/AT-039 pass |
| External skill runtime | Not started — manifest, permissions, routing, required execution receipts, and user-visible provenance are documented | Safe install/update/remove, routing, ignored-required-skill failure, compatibility/security tests, and AT-037 pass |
| Qwen image workflow | Not started — character identity/presentation separation and scoped style/redesign behavior are documented | Approved character-consistency benchmark plus scoped redesign AT-041 pass |
| Qwen3-TTS workflow | Not started | Approved recurring-voice benchmark passes |
| RunPod automation | In progress — API v2 read-only account validation, aggregate active-Pod/rate warning, GPU catalogue prices, protected key storage, refresh/removal, and local default limits pass mocked tests; there is no billable method | Provision, execute, download, remote watchdog, purge, termination, and provider-cost test passes |
| LTX video workflow | Not started | Draft, final, A2V, retake, and failure tests pass |
| In-app image/audio/video review | Not started — the studio is locked as the creator interface and ComfyUI as a headless loopback engine | Secure local media protocol, immutable originals/proxies, gallery/player/A-B review, and AT-038/AT-040 pass |
| Timed animatic and advanced shot controls | Not started — versioned animatic, control-pack, layered-parallax, and plain-language UX contracts are documented | AT-042–AT-045 pass with exact compatible workflow pins |
| Creative-assist QC and speech verification | Not started — warning-only authority and evidence contracts are documented | AT-046 plus security denial of automated approval pass |
| Ambience/effects/foley generation | Not started — separate rights-aware audio-effects contract is documented; current LTX Foley compatibility is not assumed | AT-047 and exact engine/license compatibility pass |
| Optional character/style adaptation | Not started — project-scoped benchmark-gated LoRA lifecycle is documented | AT-048/AT-049 plus dataset-rights and rollback evidence pass |
| Rough-cut editor and export | Not started | YouTube-ready technical QC passes |
| Multiple series isolation | In progress — identity-scoped project folders and same-title isolation tests pass locally | Asset/query/token/cache leakage and concurrent-worker tests |
| Production-ready 20–35 minute episode | Not started | Full pilot episode meets quality, recovery, and budget gates |

No row may be changed to “Complete” solely because code was written. The named evidence must be captured in tests or a release record.

## Development evidence captured

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm docs:check` pass on 2026-08-21.
- Thirty-seven automated tests cover guided project migration, four injected rollback points, series/film backup/restore with byte-for-byte fixtures, plain-language backup/recovery UI, no-overwrite recovery, backup-tamper refusal, live/stale/incomplete writer locks, structured diagnostic redaction/support-file behavior, the prior project foundation, encrypted credential non-leakage, fail-closed storage, RunPod API v2 success/401/403/429/503/timeout behavior, current GPU planning-price parsing, local guardrail persistence, disconnect behavior, and the guided no-cost connection flow.
- `electron-builder --dir` produced `release/win-unpacked/Animated Series Studio.exe`.
- The packaged executable remained healthy under a fresh temporary user-data profile and initialized `projects/.studio/catalog.sqlite`.
- `electron-builder --win nsis` produced the 100.0 MiB unsigned version-0.3.0 test installer `release/Animated-Series-Studio-0.3.0-x64.exe` (SHA-256 `FA1081EA0BC0D21B3C2807976442E545FEDF0492259FC7C60219D1FC7AAF64F2`). Authenticode verification reports `NotSigned`, so this is not a production-distribution artifact.
- A user-scoped silent upgrade over the development machine's version-0.2.0 installation exited successfully; the installed executable reports product version `0.3.0.0`, launches, and exposes the version-0.3.0 local/no-spend shell. This is an upgrade smoke on one machine, not clean-machine release evidence.
- A final packaged-window accessibility smoke confirmed version 0.3.0, the explicit local/no-spend home state, and locked project-dependent generation navigation. Renderer tests cover the complete RunPod Settings flow; a fresh pixel-level Settings review could not be captured while the Windows desktop was locked. An earlier packaged pass covered the 1429×915 home layout and four-step series/film wizard; no production was created during either pass.

The OpenAI/Anthropic, external-skill, ComfyUI, media-viewing, animatic/control, layered-parallax, advanced-LTX, creative-QC, foley, and adaptation additions in the current documents are design decisions only; no new provider credential, text request, skill execution, media/training job, or charge was created by documenting them.

This is development-machine and mocked-provider evidence only. The automated local AT-001 backup/restore and v1→v2 migration rollback matrix pass, but this does not satisfy the clean-machine AT-030 restore drill, future-migration/upgrade breadth, incremental/release archives, credential-persistence, production-signing, or cloud worker/termination gates.
The test installer also uses Electron's default icon; branded icon assets remain release work.

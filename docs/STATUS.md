# Delivery status

Last updated: 2026-08-21

## Honest capability statement

Animated Series Studio now has a working local Windows desktop foundation. It creates, lists, and reopens isolated series and one-off film workspaces using canonical JSON plus SQLite. It does **not** yet plan full stories, generate images, speech, video, lip sync, finished episodes, or cloud machines.

| Capability | Status | Evidence needed to advance |
| --- | --- | --- |
| Standalone repository | Complete | Git repository and isolated folder exist |
| Pinned upstream skills | Complete | Submodule lock and seven upstream test runs pass |
| Product requirements | Complete baseline | User review and future controlled revisions |
| Architecture | Complete baseline | Architecture review and implementation spikes |
| Documentation governance | Complete baseline | Documentation checker passes |
| Desktop shell | In progress — secure shell, guided project wizard, navigation, unpacked app smoke, and unsigned NSIS installer build pass on the development machine | Authenticode signing and clean-machine/non-technical install/launch evidence |
| Project and continuity store | In progress — create/list/open, atomic manifest, schema v1, per-project SQLite, catalog, and startup reconciliation tests pass | Interruption, migration rollback, backup, restore, and full continuity tests |
| Upstream adapter | Not started | Contract tests pass against pinned upstream commit |
| Qwen image workflow | Not started | Approved character-consistency benchmark passes |
| Qwen3-TTS workflow | Not started | Approved recurring-voice benchmark passes |
| RunPod automation | Not started | Provision, execute, download, watchdog, and terminate test passes |
| LTX video workflow | Not started | Draft, final, A2V, retake, and failure tests pass |
| Rough-cut editor and export | Not started | YouTube-ready technical QC passes |
| Multiple series isolation | In progress — identity-scoped project folders and same-title isolation tests pass locally | Asset/query/token/cache leakage and concurrent-worker tests |
| Production-ready 20–35 minute episode | Not started | Full pilot episode meets quality, recovery, and budget gates |

No row may be changed to “Complete” solely because code was written. The named evidence must be captured in tests or a release record.

## Foundation evidence captured

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm docs:check` pass on 2026-08-21.
- Nine automated tests cover project identity/validation, series and film persistence/reopen, same-title folder isolation, path-like identity rejection, empty-library language, and the guided one-off-film creation flow.
- `electron-builder --dir` produced `release/win-unpacked/Animated Series Studio.exe`.
- The packaged executable remained healthy under a fresh temporary user-data profile and initialized `projects/.studio/catalog.sqlite`.
- `electron-builder --win nsis` produced the 99.9 MiB unsigned test installer `release/Animated-Series-Studio-0.2.0-x64.exe`. Authenticode verification reports `NotSigned`, so this is not a production-distribution artifact.
- A packaged-window visual/accessibility pass confirmed the 1429×915 home layout, explicit local/no-spend status, disabled project-dependent navigation, and the four-step series/film wizard; no production was created during that pass.

This is development-machine evidence only. It does not satisfy the Phase 1 clean-machine, credential, backup/restore, migration-rollback, or production-signing gates.
The test installer also uses Electron's default icon; branded icon assets remain release work.

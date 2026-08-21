# Animated Series Studio

Animated Series Studio is a local-first production application for creating repeatable 2D and 3D-look animated YouTube series and one-off films with rented GPU compute.

This repository now contains a working local desktop foundation, verified project backup/restore, single-writer protection, structured redacted diagnostics, and the first safe RunPod account-connection slice, plus the authoritative product and architecture specification. The Windows application can create, list, reopen, back up, verify, and non-destructively restore isolated series and one-off film projects; create a local-only redacted support file; encrypt a RunPod API key with Windows protection; perform an explicit no-cost account check; read current GPU planning prices; and save conservative local spending defaults. It cannot create a cloud machine yet and does **not** yet generate storyboards, images, voices, video, lip sync, finished episodes, public thumbnails, upload packages, or analytics.

## Locked baseline

- The creator uses a simple Windows desktop application; normal work requires no terminal.
- Creative projects, approvals, continuity data, and final media remain on the creator's computer.
- Temporary cloud GPUs perform heavy image, voice, video, lip-sync, and upscale jobs.
- LTX-2.5 is the only video engine in version 1. Wan is not installed or operated. The design keeps an engine interface so another model can be added later without rewriting the studio.
- Qwen-Image/Qwen-Image-Edit is the initial image family; Qwen3-TTS is the initial voice family.
- RunPod is the first GPU provider. A provider interface prevents permanent lock-in.
- OpenAI Responses and Anthropic Messages are the first bring-your-own-key writing providers behind a neutral creative-writing interface; text API usage is billed separately from RunPod GPU usage.
- External creative skills are versioned and permissioned. The studio routes applicable enabled skills and records exact execution receipts, so an attached required skill cannot be silently ignored.
- Images, audio, and videos are reviewed inside Animated Series Studio. ComfyUI runs headlessly as an internal worker engine rather than the required viewing interface.
- Timed animatics, pose/depth/edge/mask/motion controls, layered parallax, advanced benchmark-approved LTX profiles, warning-only creative QC, separate foley, and optional project-scoped adaptation are part of the planned rich production workflow.
- YouTube delivery includes versioned release profiles, an Idea Library, truthful public-thumbnail candidates, factual release details and timeline chapters, explicit audience/disclosure/originality/rights review, and an immutable manual-upload package. Version 1 does not auto-publish; optional analytics are read-only/evidence-based and cannot change creative work automatically.
- Production workers never repair themselves with “Install Missing Nodes”; exact dependencies are built, tested, pinned, and rollback-capable before billing begins.
- The upstream `shuohao-skills` project is a pinned Git submodule under `vendor/` and is never edited in place.
- A 20–35 minute episode is assembled from approved generated motion, lip-synced dialogue, reusable loops, held frames, pans, reaction shots, sound, and editorial timing. The system does not assume that every second must be newly generated video.

## Start here

1. [Documentation map](docs/README.md)
2. [Product requirements](docs/PRD.md)
3. [System architecture](docs/ARCHITECTURE.md)
4. [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
5. [Production workflow](docs/PRODUCTION_WORKFLOW.md)
6. [Master build backlog](docs/BUILD_BACKLOG.md)
7. [YouTube release, packaging, and learning workflow](docs/YOUTUBE_RELEASE_WORKFLOW.md)

## Repository boundary

```text
animated-series-studio/
├── apps/desktop/                 current Electron main/preload + React application
├── packages/                     contracts, domain/store, secure vault, diagnostics, cloud setup, RunPod adapter
├── worker/                       planned remote GPU worker image and gateway
├── workflows/                    planned versioned ComfyUI/LTX workflows
├── config/                       current locks and future runtime defaults
├── docs/                         authoritative product/build documentation
├── scripts/                      maintenance and verification tools
└── vendor/shuohao-skills/        pinned upstream dependency (Git submodule)
```

The upstream repository can be pulled independently, but this project changes only when its pinned submodule commit is deliberately updated and verified. See [Upstream integration](docs/UPSTREAM_INTEGRATION.md).

## Run the current application

Developer prerequisites are Node.js 22 or newer and pnpm 10. Then:

```powershell
pnpm install
pnpm dev
```

Run the governed quality suite with `pnpm quality`. Create an unpacked Windows test build with `pnpm package:dir`, or the current unsigned test installer with `pnpm package:win`. Generated artifacts are placed under `release/`.

These commands are for development only. The finished product will provide a normal guided Windows installer and will not require the creator to use a terminal.

## Documentation is part of the product

Every feature, fix, schema change, workflow change, model update, or provider change must update the affected documentation and `CHANGELOG.md` in the same change. The rules are in [AGENTS.md](AGENTS.md) and [Change control](docs/CHANGE_CONTROL.md).

Run the documentation checks with:

```powershell
node scripts/check-docs.mjs
```

## Current status

| Area | Status |
| --- | --- |
| Product scope and requirements | Baseline documented |
| Architecture and contracts | Baseline documented |
| Upstream dependency | Pinned and verified |
| Desktop application | Local projects plus guided secure RunPod account connection; unsigned test installer; production setup incomplete |
| Series/film project storage | Create/list/open, schema-2/backward-compatible schema-1 data, guided backed-up v1→v2 migration with rollback tests, verified full backup/non-overwriting restore, and single-writer protection implemented; archive/future migrations, incremental archives, and clean-machine recovery remain |
| Diagnostics and support | Structured pre-write redaction and local-only support JSON implemented/tested; broader worker/skill coverage, retention, and packaged scan remain |
| RunPod provider | API v2 account validation and price reads implemented; Pod/storage/template creation and termination not implemented |
| Writing providers and external skills | OpenAI/Anthropic and enforced skill-runtime architecture documented; not implemented |
| Remote GPU worker | Not implemented; no ComfyUI/model worker image exists yet |
| In-app media review | Gallery/player/proxy architecture documented; not implemented |
| Animatic, advanced controls, creative QC, foley, and optional adaptation | Fully specified and test-mapped; not implemented |
| YouTube thumbnails, release details, policy review, and upload package | Fully specified and test-mapped; not implemented; version 1 remains manual upload |
| YouTube performance evidence and learning | Manual/read-only design documented; not implemented; no automatic creative or paid action |
| LTX/Qwen workflows | Not benchmarked or implemented |
| Production readiness | Not achieved |

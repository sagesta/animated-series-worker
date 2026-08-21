# Animated Series Studio

Animated Series Studio is a local-first production application for creating repeatable 2D and 3D-look animated YouTube series and one-off films with rented GPU compute.

This repository now contains the **first working desktop foundation** plus the authoritative product and architecture specification. The current Windows application can create, list, and reopen isolated local series and one-off film projects. It does **not** yet generate storyboards, images, voices, video, lip sync, finished episodes, or cloud machines.

## Locked baseline

- The creator uses a simple Windows desktop application; normal work requires no terminal.
- Creative projects, approvals, continuity data, and final media remain on the creator's computer.
- Temporary cloud GPUs perform heavy image, voice, video, lip-sync, and upscale jobs.
- LTX-2.5 is the only video engine in version 1. Wan is not installed or operated. The design keeps an engine interface so another model can be added later without rewriting the studio.
- Qwen-Image/Qwen-Image-Edit is the initial image family; Qwen3-TTS is the initial voice family.
- RunPod is the first GPU provider. A provider interface prevents permanent lock-in.
- The upstream `shuohao-skills` project is a pinned Git submodule under `vendor/` and is never edited in place.
- A 20–35 minute episode is assembled from approved generated motion, lip-synced dialogue, reusable loops, held frames, pans, reaction shots, sound, and editorial timing. The system does not assume that every second must be newly generated video.

## Start here

1. [Documentation map](docs/README.md)
2. [Product requirements](docs/PRD.md)
3. [System architecture](docs/ARCHITECTURE.md)
4. [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
5. [Production workflow](docs/PRODUCTION_WORKFLOW.md)

## Repository boundary

```text
animated-series-studio/
├── apps/desktop/                 current Electron main/preload + React application
├── packages/                     current contracts, domain, and project-store foundation
├── worker/                       planned remote GPU worker image and gateway
├── workflows/                    planned versioned ComfyUI/LTX workflows
├── config/                       current locks and future runtime defaults
├── docs/                         authoritative product/build documentation
├── scripts/                      maintenance and verification tools
└── vendor/shuohao-skills/        pinned upstream dependency (Git submodule)
```

The upstream repository can be pulled independently, but this project changes only when its pinned submodule commit is deliberately updated and verified. See [Upstream integration](docs/UPSTREAM_INTEGRATION.md).

## Run the current foundation

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
| Desktop application | Working local foundation and unsigned test installer; production setup incomplete |
| Series/film project storage | Create/list/open implemented and tested; backup/restore incomplete |
| Remote GPU worker | Not implemented |
| LTX/Qwen workflows | Not benchmarked or implemented |
| Production readiness | Not achieved |

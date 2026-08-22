# Animated Series Studio

Animated Series Studio is a local-first production application for creating repeatable 2D and 3D-look animated YouTube series and one-off films with rented GPU compute.

This repository now contains a working local desktop foundation, verified project backup/restore, single-writer protection, structured redacted diagnostics, safe RunPod account connection, a versioned Audience & Creative Direction profile, and a protected creative-writing slice. The Windows application can create isolated series/film projects; guide a non-technical creator through audience, niche, tone, themes, style, boundaries, and positioning; protect separate OpenAI, Anthropic, Gemini, and RunPod keys; preview the exact local context for a text request; require approval for one paid call; and save a validated GPT/Claude/Gemini response locally as a proposal with source/model/token lineage. It cannot create a cloud machine yet and does **not** yet generate storyboards, images, voices, video, lip sync, finished episodes, public thumbnails, upload packages, or analytics.

## Locked baseline

- The creator uses a simple Windows desktop application; normal work requires no terminal.
- Creative projects, approvals, continuity data, and final media remain on the creator's computer.
- Temporary cloud GPUs perform heavy image, voice, video, lip-sync, and upscale jobs.
- LTX-2.5 is the only video engine in version 1. Wan is not installed or operated. The design keeps an engine interface so another model can be added later without rewriting the studio.
- Qwen-Image/Qwen-Image-Edit is the initial image family; Qwen3-TTS is the initial voice family.
- RunPod is the first GPU provider. A provider interface prevents permanent lock-in.
- OpenAI Responses, Anthropic Messages, and Gemini GenerateContent are the bring-your-own-key writing providers behind a neutral creative-writing interface; text API usage is billed separately from RunPod GPU usage.
- Version 0.8.0 offers only its checked stable catalogue: GPT-5.6 Terra/Sol/Luna, Claude Sonnet 5/Opus 5/Haiku 4.5, and Gemini 3.7 Flash/3.5 Flash-Lite. Balanced is a starting tier, not a task benchmark winner.
- Required inputs display an asterisk and live minimum/range guidance. Missing or invalid information opens a clear correction popup; it never silently leaves the primary action grey or starts a provider/GPU operation.
- Every project has an immutable versioned Audience & Creative Direction profile. It guides later stages but never becomes canon, copies a comparable work, or answers YouTube's separate made-for-kids and disclosure attestations.
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
6. [Audience and creative direction](docs/CREATIVE_DIRECTION_PROFILE.md)
7. [Master build backlog](docs/BUILD_BACKLOG.md)
8. [YouTube release, packaging, and learning workflow](docs/YOUTUBE_RELEASE_WORKFLOW.md)

## Repository boundary

```text
animated-series-studio/
├── apps/desktop/                 current Electron main/preload + React application
├── packages/                     contracts, domain/store, secure vault, writing/provider adapters, diagnostics, cloud setup
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
| Desktop application | Local projects, guided required-field/length/range warnings, Audience & Creative Direction, GPT/Claude/Gemini writing, and secure RunPod account connection; unsigned test build; production setup incomplete |
| Series/film project storage | Create/list/open, immutable project-local creative-direction revisions, schema-2/backward-compatible schema-1 data, guided backed-up v1→v2 migration with rollback tests, verified full backup/non-overwriting restore, and single-writer protection implemented; archive/future migrations, incremental archives, and clean-machine recovery remain |
| Diagnostics and support | Structured pre-write redaction and local-only support JSON implemented/tested; broader worker/skill coverage, retention, and packaged scan remain |
| RunPod provider | API v2 account validation and price reads implemented; Pod/storage/template creation and termination not implemented |
| Writing providers and external skills | Protected OpenAI/Anthropic/Gemini connections, controlled model catalogue, proposal drafting, and project-scoped declarative skill installation/planning/receipts are implemented with local mocked tests; live benchmark/cost profiles and higher-risk executable/MCP skill classes remain locked |
| Remote GPU worker | Not implemented; no ComfyUI/model worker image exists yet |
| In-app media review | Gallery/player/proxy architecture documented; not implemented |
| Animatic, advanced controls, creative QC, foley, and optional adaptation | Fully specified and test-mapped; not implemented |
| YouTube thumbnails, release details, policy review, and upload package | Fully specified and test-mapped; not implemented; version 1 remains manual upload |
| YouTube performance evidence and learning | Manual/read-only design documented; not implemented; no automatic creative or paid action |
| LTX/Qwen workflows | Not benchmarked or implemented |
| Production readiness | Not achieved |

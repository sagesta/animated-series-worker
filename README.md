# Animated Series Studio

Animated Series Studio is a local-first production application for creating repeatable 2D and 3D-look animated YouTube series and one-off films with rented GPU compute.

Version 0.10.1 implements the local production control plane: isolated series/film projects; a one-next-step Creator Mode organized as a resumable story-package → references → storyboard-frames → voices/dialogue → video-shots → local-edit/captions → verified-master → worker-cleanup run; a collapsed one-off image/video/audio/composition/assembly tool; protected OpenAI, Anthropic, Gemini, and RunPod connections; compact project-aware idea assistance beside applicable creative/planning fields; skill-aware writing proposals; versioned canon and media approvals; storyboards; in-app image/audio/video review; governed Qwen image, Qwen3-TTS, LTX-2.5, LatentSync, control, foley, and optional-adaptation job definitions; official RunPod lifecycle orchestration; an authenticated headless ComfyUI worker; resumable verified transfers; local FFmpeg timelines/captions/thumbnails; project-scoped release profiles/ideas/performance/learning with checked YouTube Analytics CSV import; and an immutable manual YouTube upload package. Paid generation remains deliberately locked because this checkout has a candidate workflow pack and a complete model-license evidence dossier, but no authorized license decisions, model hashes, compatible-GPU results, media-quality proof, or shutdown evidence. See [production implementation and qualification](docs/PRODUCTION_IMPLEMENTATION.md) and the [candidate model-license review](docs/MODEL_LICENSE_REVIEW_2026-08-26.md).

## Locked baseline

- The creator uses a simple Windows desktop application; normal work requires no terminal.
- Creative projects, approvals, continuity data, and final media remain on the creator's computer.
- Temporary cloud GPUs perform heavy image, voice, video, lip-sync, and upscale jobs.
- LTX-2.5 is the only video engine in version 1. Wan is not installed or operated. The design keeps an engine interface so another model can be added later without rewriting the studio.
- Qwen-Image/Qwen-Image-Edit is the initial image family; Qwen3-TTS is the initial voice family.
- RunPod is the first GPU provider. A provider interface prevents permanent lock-in.
- OpenAI Responses, Anthropic Messages, and Gemini GenerateContent are the bring-your-own-key writing providers behind a neutral creative-writing interface; text API usage is billed separately from RunPod GPU usage.
- Version 0.10.1 offers only its checked stable writing catalogue: GPT-5.6 Terra/Sol/Luna, Claude Sonnet 5/Opus 5/Haiku 4.5, and Gemini 3.7 Flash/3.5 Flash-Lite. Balanced is a starting tier, not a task benchmark winner.
- Required inputs display an asterisk and live minimum/range guidance. Missing or invalid information opens a clear correction popup; it never silently leaves the primary action grey or starts a provider/GPU operation.
- Every project has an immutable versioned Audience & Creative Direction profile. It guides later stages but never becomes canon, copies a comparable work, or answers YouTube's separate made-for-kids and disclosure attestations.
- External creative skills are versioned and permissioned. The studio routes applicable enabled skills and records exact execution receipts, so an attached required skill cannot be silently ignored.
- The project-aware idea assistant uses the saved writing profile automatically, keeps exact context/skill detail under one optional disclosure, and turns one clearly labelled Generate action into the paid-text confirmation. It creates reviewable proposals and has no authority over keys, measurements, transcripts, approvals, rights/policy declarations, canon, spending, GPU starts, or publishing.
- Images, audio, and videos are reviewed inside Animated Series Studio. ComfyUI runs headlessly as an internal worker engine rather than the required viewing interface.
- Timed local storyboard editing, deterministic finishing, warning-only technical QC, advanced control/layer media roles, engine-neutral control manifests, and locked candidate definitions for control-guided generation, foley, and project adaptation are implemented. Their real model/workflow/training execution remains post-qualification work.
- YouTube delivery includes project-local versioned release profiles, an Idea Library, truthful public-thumbnail candidates, factual release details and timeline chapters, explicit audience/disclosure/originality/rights review, structured official/manual/rehearsal performance snapshots, human-reviewed future lessons, and an immutable manual-upload package. Version 1 does not auto-publish; analytics evidence cannot change creative work automatically.
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
8. [Production implementation and qualification](docs/PRODUCTION_IMPLEMENTATION.md)
9. [YouTube release, packaging, and learning workflow](docs/YOUTUBE_RELEASE_WORKFLOW.md)

## Repository boundary

```text
animated-series-studio/
├── apps/desktop/                 current Electron main/preload + React application
├── packages/                     contracts, domain/store, secure vault, writing/provider adapters, diagnostics, cloud setup
├── worker/                       candidate remote GPU worker image and gateway
├── workflows/                    versioned candidate ComfyUI/LTX workflow resources
├── config/                       current locks, candidates, and runtime defaults
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
| Desktop application | Complete local control plane and production rooms implemented; current Windows artifact remains unsigned and needs clean-machine acceptance |
| Series/film project storage | Create/list/open, immutable project-local creative-direction revisions, schema-2/backward-compatible schema-1 data, guided backed-up v1→v2 migration with rollback tests, verified full backup/non-overwriting restore, and single-writer protection implemented; archive/future migrations, incremental archives, and clean-machine recovery remain |
| Diagnostics and support | Structured pre-write redaction and local-only support JSON implemented/tested; broader worker/skill coverage, retention, and packaged scan remain |
| RunPod provider | Official Pod list/get/create/start/stop/delete, catalogue, lease reconciliation, cost/start gates and limits implemented; live provider qualification pending |
| Writing providers and external skills | Protected OpenAI/Anthropic/Gemini connections, controlled model catalogue, project-wide creative-field idea assistance, proposal drafting, and project-scoped declarative skill installation/planning/receipts are implemented with local mocked tests; live benchmark/cost profiles and higher-risk executable/MCP skill classes remain locked |
| Remote GPU worker | Smaller core Docker/model-bootstrap/gateway/loopback-ComfyUI/preflight/watchdog/transfers/runners implemented independently from optional training; the 29.29 GB core candidate passed a model-free smoke, was published/pulled and personally/canonically keyless-signed by immutable digest; protected GitHub OIDC run `32967547472` and independent exact-identity verification passed; model/cloud-GPU qualification remains |
| In-app media review | Restricted local image/audio/video review and approval implemented |
| Animatic, advanced controls, creative QC, foley, and optional adaptation | Local storyboard/timeline/QC, control/layer/dataset media roles, ordered manifests, a model-free foley runner, and the pinned trainer contract are implemented; the trainer is excluded from the core image and all advanced profiles remain separately release-blocked |
| YouTube thumbnails, release details, policy review, and upload package | Local thumbnail/details/attestations/hash-checked manual package implemented; automatic upload absent |
| YouTube performance evidence and learning | Structured project-local manual/rehearsal evidence, checked official-report CSV import with file fingerprint/row provenance, and human-approved/rejected learning proposals implemented; optional read-only OAuth and live comparative sufficiency remain open; no automatic creative or paid action |
| LTX/Qwen workflows | Governed candidate packs/runners and seven exact hash-locked Comfy API graphs are implemented; exact model/transitive-license evidence is inventoried, but authorized decisions, model hashes, and live benchmarks remain pending |
| Production readiness | Correctly locked until controlled promotion evidence exists |

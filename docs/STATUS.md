# Delivery status

Version: 0.10.0

Last updated: 2026-08-23

## Honest capability statement

Animated Series Studio now implements the full local production control plane and every paid-generation stage behind a qualification gate. It can manage multiple isolated series and one-off films; develop scripts, characters, worlds, storyboards, controls, sound, thumbnails, release profiles, ideas, and learning proposals with protected GPT/Claude/Gemini providers and project-scoped declarative skills; offer that assistance beside applicable fields without granting approval/spend/publishing authority; promote reviewed facts into versioned canon; import, view, approve, reject, and lineage-track media; prepare governed Qwen image/Qwen3-TTS/LTX-2.5/LatentSync plus locked control/foley/adaptation candidates; estimate and separately approve RunPod spend; create/reconcile/terminate one worker per job; transfer and verify media; render local timelines, captions, thumbnails, and manual YouTube packages; and store structured project-local performance evidence plus human-reviewed future lessons.

The candidate checkout still cannot start paid generation. Exact ComfyUI API workflows, model hashes and license decisions, a built image digest, live GPU benchmarks, and shutdown proof have not been produced on this machine. The lock is enforced by the workflow registry, production-readiness receipt, worker, and UI. No real GPU was rented for this implementation run.

## Capability ledger

| Capability | Implementation state | Remaining release evidence |
| --- | --- | --- |
| Windows desktop and non-technical guidance | Implemented and locally tested | Signed installer, automated accessibility, clean-machine and representative-user proof |
| Isolated series and one-off projects | Implemented with local manifests, SQLite indexes, locks, backup/restore, and migration | Clean-machine restore and broader future-migration drills |
| Audience, niche, creative direction | Implemented as immutable revisions and writing context | Full downstream benchmark proof after live media workflows qualify |
| GPT/Claude/Gemini writing | Implemented behind protected credentials, controlled models, preview, confirmation, schema validation, and proposal lineage | Live account/quality/cost benchmark; prices remain provider-side |
| Project-aware field ideas | Implemented for applicable direction/cast/world/storyboard/generation/edit/release planning fields using the protected writing/skill path; proposal first, creator insertion only, human-only exclusions | Live quality/cost, accessibility, representative-user AT-061 |
| External creative skills | Declarative writing-skill routing, validation, project grants, and receipts implemented | Executable/MCP skill classes, general signatures, and remote tools remain locked |
| Pinned upstream adapter | Implemented validation/import boundary without editing `vendor/shuohao-skills` | Representative long-form external package acceptance |
| Canon and continuity | Versioned proposal promotion, active/superseded records, asset dependencies, and stale counts implemented | Full-season continuity and scoped redesign acceptance |
| In-app media review | Restricted local media protocol plus image/audio/video players, candidate approval/rejection, parent lineage implemented | Packaged large-media/accessibility/long-session tests |
| Workflow registry | Strict candidate/qualified packs, parameters, template hashes, node allowlists, model hashes, fingerprint, estimates, and idempotency implemented | Import exact API workflows and pass controlled GPU qualification |
| RunPod lifecycle | Official list/get/create/start/stop/delete, lease reconciliation, current catalogue, concurrent limits, cost/start gates implemented | Real provider create/uncertain-response/terminate/cost run |
| GPU worker | Pinned Docker recipe, model bootstrap, loopback ComfyUI, authenticated gateway, preflight, watchdog, chunk transfer, output verification, purge, Python runners implemented | Docker build, registry digest, live security/recovery/shutdown test |
| Qwen image and edit | Candidate model pins and governed job/UI contracts implemented | Exact API templates, hashes, license approval, identity/edit benchmark |
| Qwen3-TTS | Voice design and line-book Python runners, exact reference transcript/input rules implemented | Live voices, pronunciation/identity benchmark and license review |
| LTX-2.5 video | Draft/final/audio-driven candidate definitions and input/order rules implemented | API templates, runtime/VRAM/quality/cost benchmark |
| Lip sync | Isolated LatentSync 1.6 runner with exact video/audio order and process-group cancellation implemented | Close/medium/profile/multi-person/animated/off-screen benchmark and license review |
| Assistive QC | Technical FFprobe report implemented; cannot approve creative output | Live fixture usefulness and false-positive review |
| Advanced controls and layers | Control/layer media roles, approved selection, ordered ID/role/hash manifests, unsupported-role refusal, and control-guided Qwen/LTX candidates implemented | Coordinate/time/strength authoring, layer compositor, exact templates/adapters/nodes, rights/quality AT-043–AT-045 |
| Foley | Separate planning/job/effect-output/preserve-dialogue contract and candidate definition implemented | Select/license/build exact model/runner and live synchronized AT-047 fixtures |
| Optional adaptation | Dataset/artifact roles, one-dataset gate, failed-reference/rights confirmations, and project LTX candidate definition implemented | Exact trainer/image, evaluation/promotion/rollback, regression/cost/license AT-048/AT-049 |
| Local edit/export | One-command FFmpeg check/install, deterministic timeline, captions, thumbnail, master verification implemented | Representative full episode, interruption, and clean-machine run |
| YouTube package | Versioned release details/attestations and immutable hash-checked manual package implemented | Full package inspection against a real master; no automatic publishing |
| Release profile and Idea Library | Project-local immutable profile revisions and source-labelled editorial ideas implemented | Cross-project channel-profile copy/bind, signal import, duplicate analysis, live editorial acceptance |
| Performance evidence and learning | Structured immutable official/manual/rehearsal windows, metric-version/warnings/baseline eligibility, evidence-citing proposals, human approval/rejection implemented | Report-file parser, optional read-only OAuth decision, comparative sufficiency/live channel AT-056/AT-057 |
| Multiple GPUs | Up to three independent one-GPU jobs governed by provider-active count and saved limits | Live concurrency, isolation, total-cost, and recovery test |
| 20–35 minute production | Architecture and complete tool path implemented | A human-approved pilot episode and one-off film within measured budget |
| Report-file/read-only analytics connector | Outside version 0.10; structured manual evidence is implemented | Separately authorized parser/OAuth/security work only |
| Automatic publishing | Intentionally outside version 1 | Separate post-version-1 product/security authorization only |

## Validation captured in this change

- All candidate configuration JSON parses.
- Worker and release JavaScript passes syntax checks; Python worker files compile.
- TypeScript type checking passes.
- The complete quality checks pass: documentation (91 requirement references and 60 unique decisions), TypeScript, formatting, lint, 101 tests across 23 files, and the production Electron build. Focused provider, idea-assistant, release-store, workflow-registry, worker-client, readiness, production-store, and orchestrator suites are included.
- The final unpacked Windows package is at `release-smoke-0.10.0-final/win-unpacked`. Its executable reports product version `0.10.0.0`, is 235,534,336 bytes, and has SHA-256 `9F3E6F6717353D81E26A5FF634ED0570FC917E38EA65A5324466DAFA931626C5`.
- The final NSIS installer is `release-smoke-0.10.0-final/Animated-Series-Studio-0.10.0-x64.exe`, is 105,048,769 bytes, and has SHA-256 `751B4BC77DA0C3672F10D5925D435296163089DABA698765C811BC73FF060949`.
- A hidden isolated-profile smoke of the unpacked package stayed running for eight seconds with four Electron processes and initialized its fresh local project catalogue. The process tree was then stopped. Executable and installer are `NotSigned`, use the default Electron icon, and are development-machine evidence rather than a production release.

## External qualification boundary

The release-engineering path is implemented in:

- `scripts/New-GpuQualificationBundle.ps1` — creates a no-cost evidence workspace;
- `scripts/Import-ComfyWorkflow.mjs` — imports and hashes reviewed API-format candidate workflows;
- `scripts/Build-GpuWorker.ps1` — builds matching candidate or promoted images;
- `worker/bootstrap_models.py` — downloads only manifest-pinned model sources and computes hashes;
- `worker/preflight.mjs` — records exact image/pack/runtime/GPU/node/model/workflow capability;
- `scripts/Promote-GpuWorker.mjs` — creates production pack, model manifest, and readiness receipt only when all evidence passes.

The promotion tool will not overwrite an earlier production release. Changing a pack, template, source pin, model hash, or image digest relocks generation until the new candidate passes again.

## Not safe to claim yet

- No candidate worker image was built in this run because Docker is not installed on this workstation.
- No production model manifest, production workflow pack, or readiness receipt exists.
- No model weights were downloaded and no model license was accepted on the creator’s behalf.
- No real RunPod Pod was created, stopped, or terminated.
- No live image, voice, video, or lip-sync output was generated.
- No live control, foley, or adaptation output/training was generated; those definitions remain non-billable candidates.
- No YouTube account was connected and no performance report file was parsed; current evidence entry is structured and manual.
- No signed production installer or clean-machine release acceptance exists.
- No automatic YouTube publishing exists.

See [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md) for the complete operational flow and [BUILD_BACKLOG.md](BUILD_BACKLOG.md) for the remaining proof ledger.

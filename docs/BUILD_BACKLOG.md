# Master build and proof backlog

Last updated: 2026-08-23

Current source version: 0.10.0

## 1. Status language

| Status | Meaning |
| --- | --- |
| Implemented | Code/config/UI exists and appropriate local tests pass; external production proof may still be required |
| Qualified | The exact external runtime passed its named controlled evidence gate |
| Release-blocked | Implementation exists but a real external, legal, hardware, signing, or clean-machine gate is missing |
| Planned | Accepted future capability outside the current implementation |
| Superseded | Replaced by a recorded decision; history remains in Git/changelog |

Writing code never manufactures model quality, license permission, provider shutdown, or human acceptance evidence. Those items remain release-blocked until observed.

## 2. Implemented version-0.9 work packages

| Work package | State | Implemented outcome | Remaining proof |
| --- | --- | --- | --- |
| FOUND-001 | Implemented | Secure Electron shell, non-technical navigation, required markers, live rules, correction popups | Signing, accessibility automation, clean-machine acceptance |
| DATA-001 | Implemented | Project catalog, manifests, per-project database, migration, writer lock, backup/restore | Clean-machine/full-media restore drill |
| SEC-001 | Implemented | OS-protected provider/lease secrets, redacted logs/support, restricted media protocol | Packaged secret scan and clean-machine vault persistence |
| DIRECTION-001 | Implemented | Immutable audience/niche/creative revisions consumed by writing | Live downstream quality evaluation |
| WRITE-001 | Implemented | OpenAI/Anthropic/Gemini protected setup, stable catalogue, structured proposals, approvals, lineage | Live provider quality and actual price profiles |
| IDEA-AI-001 | Implemented | Reusable project-aware idea assistant across applicable creative/planning fields with exact context/skill preview, paid-text confirmation, proposal lineage, review-only insertion, and human-only exclusions | Live provider quality, representative-user, accessibility, and actual-cost evidence |
| SKILL-001 | Implemented declarative class | Project-scoped writing skills, plans, required-output validation, receipts, update revocation | Signed/general/executable/MCP classes remain future locked work |
| UP-001/UP-002 | Implemented | Pinned upstream validation, import preview, normalized candidate acceptance | Representative long-form external fixture acceptance |
| CONT-001 | Implemented | Versioned canon, active/superseded records, media parentage/dependencies/stale counts | Season-scale continuity drill |
| VIEW-001 | Implemented | Local image/audio/video viewing, approval/rejection and history | Packaged long-media/accessibility test |
| WORKER-001 | Implemented | Docker recipe, loopback ComfyUI, authenticated gateway, watchdog, preflight, purge | Build and live qualification |
| CLOUD-001 | Implemented | RunPod REST lifecycle, lease reconciliation, price/limit checks, one worker per job | Real Pod lifecycle and provider-cost receipt |
| COMFY-001 | Implemented | Candidate/qualified registry, API template hashes, node/model/parameter allowlists | Exact API workflow import and live benchmark |
| COMFY-002 | Implemented | Image/pack/GPU/VRAM/disk/node/model/workflow fingerprint preflight | Live worker capability receipt |
| COMFY-003 | Implemented | Headless queue/poll/cancel/results bridge with plain-language job states | Live Comfy execution/interruption |
| COMFY-004 | Implemented | Input/output hashes, bounded chunks, namespaced staging, no automatic creative retry | Live partial/corrupt/OOM/timeout cases |
| COMFY-005 | Implemented | Candidate-only qualification mode and evidence-only atomic production promotion | Execute the controlled gate |
| BENCH-001 | Implemented harness/contracts | Required model, quality, security, recovery, shutdown, and cost evidence schema | Run every fixture on the exact GPU image |
| MEDIA-001 | Implemented candidate | Qwen-Image-2512/edit and Qwen3-TTS workflows/UI/runners | Model licenses, hashes, exact workflows, live quality |
| VIDEO-001 | Implemented candidate | LTX-2.5 draft/final/audio-driven and LatentSync repair workflows/UI/runners | Live runtime/quality/lip fixture acceptance |
| ANIMATIC-001 | Implemented local slice | Storyboard/canon records and local timed timeline rendering | Representative pacing/user test |
| CREATIVE-QC-001 | Implemented technical slice | FFprobe evidence report with human-only approval authority | Live usefulness/false-warning review |
| EDIT-001 | Implemented | Deterministic local timeline, captions, thumbnail and master verification | Full-length interruption/performance run |
| YT-META-001/YT-POLICY-001/YT-PACKAGE-001 | Implemented | Release details, human attestations, immutable hash-checked manual package | Real complete-package review |
| YT-PROFILE-001 | Implemented local slice | Project-local immutable release-profile revisions and source-labelled Idea Library | Explicit cross-project profile copy/bind flow, signal import, duplicate/continuity analysis, representative-user proof |
| YT-ANALYTICS-001/YT-LEARN-001 | Implemented local slice | Immutable structured official/manual/rehearsal metric snapshots, missing-data warnings, baseline exclusion, evidence-citing learning proposals, and human review | Report-file parser, optional read-only OAuth decision/implementation, comparative sufficiency rules, live evidence fixture |
| MULTI-001 | Implemented control plane | Project isolation and up to three concurrent independent one-GPU jobs | Live isolation/combined-budget/recovery test |

## 3. Immediate release blockers, in order

| Order | Work package | State | Required action | Exit proof |
| --- | --- | --- | --- | --- |
| 1 | COMFY-WF-QUAL | Release-blocked | Export official Qwen/LTX workflows as API prompts, bind reviewed placeholders, import and inspect node lists | Candidate pack has exact templates/hashes and no unsafe nodes |
| 2 | MODEL-LIC-QUAL | Release-blocked | Review every model and transitive license for intended commercial YouTube use | Named, dated accepted decisions; no inferred permission |
| 3 | WORKER-BUILD-QUAL | Release-blocked | Build candidate Docker image and push to private registry by digest | Reproducible image digest and build log |
| 4 | MODEL-HASH-QUAL | Release-blocked | Run pinned bootstrap on controlled persistent storage | Complete `studio-model-qualification.json` |
| 5 | GPU-CAP-QUAL | Release-blocked | Run preflight on an allowed GPU class | Matching `studio-capability.json`, smoke pass, sufficient VRAM/disk |
| 6 | MEDIA-BENCH-QUAL | Release-blocked | Run image, edit, TTS, LTX and all LatentSync fixtures | Human-reviewed quality/runtime/VRAM evidence for each mandatory test |
| 7 | SECURITY-RECOVERY-QUAL | Release-blocked | Prove gateway auth, loopback-only Comfy, resume, reconciliation, cancellation and purge | Linked pass evidence with no cross-job/project access |
| 8 | SHUTDOWN-COST-QUAL | Release-blocked | Prove idle exit, hard deadline, provider termination, and cost ledger | Provider-side termination and billing evidence |
| 9 | PROMOTE-001 | Release-blocked | Run the guarded promotion tool on exact evidence | Production pack/manifest/readiness receipt created atomically |
| 10 | PILOT-001 | Release-blocked | Produce and review a 60–90 second pilot, then a 20–35 minute episode and one-off film | Continuity, voice, motion, lip, audio, recovery and budget acceptance |
| 11 | RELEASE-001 | Release-blocked | Package, sign and install on a clean Windows machine | Authenticode, install/upgrade/uninstall, accessibility and non-technical acceptance |

## 4. Version-0.10 feature foundations and retained locks

| Work package | State | Implemented outcome | Remaining boundary |
| --- | --- | --- | --- |
| CONTROL-001 | Implemented control-plane slice | Approved pose/depth/edge/segmentation/mask/start/end/motion/reference asset roles, ordered hash manifest, unsupported-role refusal, Qwen/LTX candidate definitions | Typed role-specific coordinate/time metadata, exact adapters/templates/nodes, rights fixtures, AT-043/AT-045 live proof |
| LAYER-001 | Implemented foundation | Foreground/subject/background and region-mask media roles can be imported, reviewed, lineage-tracked, and planned with AI assistance | Dedicated non-destructive separation authoring, occlusion/safe-margin recipe and deterministic parallax acceptance AT-044 |
| LTXADV-001 | Implemented candidate slice | Control-guided LTX-2.5 job definition and neutral manifest boundary | IC-LoRA/reference/multishot/DFR/upsample implementations only after exact compatibility benchmarks |
| FOLEY-001 | Implemented candidate slice | Separate foley job/output kind, cue-plan assistance, dialogue-preservation parameter, and candidate workflow | Select/license/build a rights-safe model/runner, synchronized fixtures, AT-047 |
| ADAPT-001 | Implemented candidate slice | Adaptation dataset/artifact roles, dataset manifest, explicit failed-reference and rights gates, project-scoped LTX candidate definition | Trainer/image qualification, evaluation/promotion/rollback lifecycle, live cost/regression proof AT-048/AT-049 |
| THUMB-ADV-001 | Implemented local foundation | Deterministic thumbnail plus LLM concept/headline planning | Generated illustration candidate qualification and responsive comparison depth |
| PUBLISH-001 | Planned and intentionally locked | No YouTube mutation surface exists | Separate post-version-1 authorization, OAuth/quota/private-first/duplicate/reconciliation/policy/audit review |
| SKILL-TOOL-001 | Planned and intentionally locked | Declarative skills remain the only executable request influence | Signatures, sandbox, timeout, local/remote/MCP permission and secret-safety proof |

Wan is not a backlog item for version 1. LatentSync is a targeted lip-repair postprocessor, not a replacement video engine.

## 5. No-loss intake rule

Every new feature, risk, model/update, provider behavior, or fix must receive a stable ID here; state the affected requirements, code, evidence, docs, rollback, cost, and security boundary; and update [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md), [TRACEABILITY.md](TRACEABILITY.md), [STATUS.md](STATUS.md), [SOURCES.md](SOURCES.md), and [CHANGELOG.md](../CHANGELOG.md) in the same change.

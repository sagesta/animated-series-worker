# Master build and proof backlog

Last updated: 2026-08-26

Current source version: 0.10.1

## 1. Status language

| Status | Meaning |
| --- | --- |
| Implemented | Code/config/UI exists and appropriate local tests pass; external production proof may still be required |
| Qualified | The exact external runtime passed its named controlled evidence gate |
| Release-blocked | Implementation exists but a real external, legal, hardware, signing, or clean-machine gate is missing |
| Planned | Accepted future capability outside the current implementation |
| Superseded | Replaced by a recorded decision; history remains in Git/changelog |

Writing code never manufactures model quality, license permission, provider shutdown, or human acceptance evidence. Those items remain release-blocked until observed.

## 2. Implemented work packages through version 0.10.1

| Work package | State | Implemented outcome | Remaining proof |
| --- | --- | --- | --- |
| FOUND-001 | Implemented | Secure Electron shell, non-technical navigation, required markers, live rules, correction popups | Signing, accessibility automation, clean-machine acceptance |
| DATA-001 | Implemented | Project catalog, manifests, per-project database, migration, writer lock, backup/restore | Clean-machine/full-media restore drill |
| SEC-001 | Implemented | OS-protected provider/lease secrets, redacted logs/support, restricted media protocol | Packaged secret scan and clean-machine vault persistence |
| DIRECTION-001 | Implemented | Immutable audience/niche/creative revisions consumed by writing | Live downstream quality evaluation |
| WRITE-001 | Implemented | OpenAI/Anthropic/Gemini protected setup, stable catalogue, structured proposals, approvals, lineage | Live provider quality and actual price profiles |
| WRITE-002 | Implemented | Separate fast connection-check and five-minute writing ceilings, latency-aware Gemini thinking, compact one-action field assistance, one-next-step Creator Mode, eight-checkpoint resumable production projection, secondary governed one-off asset handoff, and a safe no-profile Story-controls handoff | Structured automatic batch-run contract, live retry/latency evidence, actual cost, accessibility, and representative-user acceptance |
| IDEA-AI-001 | Implemented | Reusable project-aware idea assistant across applicable creative/planning fields with exact context/skill preview, paid-text confirmation, proposal lineage, review-only insertion, and human-only exclusions | Live provider quality, representative-user, accessibility, and actual-cost evidence |
| SKILL-001 | Implemented declarative class | Project-scoped writing skills, plans, required-output validation, receipts, update revocation | Signed/general/executable/MCP classes remain future locked work |
| UP-001/UP-002 | Implemented | Pinned upstream validation, import preview, normalized candidate acceptance | Representative long-form external fixture acceptance |
| CONT-001 | Implemented | Versioned canon, active/superseded records, media parentage/dependencies/stale counts | Season-scale continuity drill |
| VIEW-001 | Implemented | Local image/audio/video viewing, approval/rejection and history | Packaged long-media/accessibility test |
| WORKER-001 | Implemented, locally smoke-tested, published, and canonically keyless-signed | Core Docker recipe, loopback ComfyUI, authenticated gateway, watchdog, preflight, purge, fail-closed optional-trainer routing, pull/signature-verified immutable digest, and successful protected GitHub OIDC signer run | Complete compatible model-backed cloud-GPU qualification |
| WORKER-002 | Implemented with local build, registry, personal-signature, and canonical-workflow evidence | Core promotion filters advanced workflows/models and no longer requires the adaptation trainer or its 80 GB/R595 gate; local candidate `.3` is 29,285,117,474 bytes, passed model-free smoke, was published/pulled/keyless-signed, and was independently verified against the exact canonical workflow identity | 48 GB model-backed qualification |
| CLOUD-001 | Implemented | RunPod REST lifecycle, lease reconciliation, price/limit checks, one worker per job | Real Pod lifecycle and provider-cost receipt |
| COMFY-001 | Implemented | Candidate/qualified registry, seven imported hash-locked API graphs, two runner contracts, and node/model/parameter allowlists | Compatible model-backed live benchmark |
| COMFY-002 | Implemented | Image/pack/GPU/VRAM/disk/runtime/node/model/workflow fingerprint preflight with a passing local model-free receipt | Compatible model-backed capability receipt with complete hashes |
| COMFY-003 | Implemented | Headless queue/poll/cancel/results bridge with plain-language job states | Live Comfy execution/interruption |
| COMFY-004 | Implemented | Input/output hashes, bounded chunks, namespaced staging, no automatic creative retry | Live partial/corrupt/OOM/timeout cases |
| COMFY-005 | Implemented | Candidate-only qualification mode and evidence-only atomic promotion of every core, advanced, and local-finishing workflow | Execute the complete controlled gate |
| BENCH-001 | Implemented harness/contracts | Required model, quality, security, recovery, shutdown, and cost evidence schema | Run every fixture on the exact GPU image |
| MEDIA-001 | Implemented candidate | Qwen-Image-2512/edit and Qwen3-TTS workflows/UI/runners | Model licenses, hashes, exact workflows, live quality |
| VIDEO-001 | Implemented candidate | LTX-2.5 draft/final/audio-driven and LatentSync repair workflows/UI/runners | Live runtime/quality/lip fixture acceptance |
| ANIMATIC-001 | Implemented local slice | Storyboard/canon records and local timed timeline rendering | Representative pacing/user test |
| CREATIVE-QC-001 | Implemented technical slice | FFprobe evidence report with human-only approval authority | Live usefulness/false-warning review |
| EDIT-001 | Implemented | Deterministic local timeline, captions, thumbnail and master verification | Full-length interruption/performance run |
| YT-META-001/YT-POLICY-001/YT-PACKAGE-001 | Implemented | Release details, human attestations, immutable hash-checked manual package | Real complete-package review |
| YT-PROFILE-001 | Implemented local slice | Project-local immutable release-profile revisions and source-labelled Idea Library | Explicit cross-project profile copy/bind flow, signal import, duplicate/continuity analysis, representative-user proof |
| YT-ANALYTICS-001/YT-LEARN-001 | Implemented local slice | Immutable structured official/manual/rehearsal metric snapshots, bounded official CSV parsing with file hash/row provenance, missing-data warnings, baseline exclusion, evidence-citing learning proposals, and human review | Optional read-only OAuth decision/implementation, comparative sufficiency rules, live evidence fixture |
| MULTI-001 | Implemented control plane | Project isolation and up to three concurrent independent one-GPU jobs | Live isolation/combined-budget/recovery test |

## 3. Immediate release blockers, in order

| Order | Work package | State | Required action | Exit proof |
| --- | --- | --- | --- | --- |
| 1 | COMFY-WF-QUAL | Release-blocked | Execute the seven imported/hash-locked Qwen/LTX API graphs and two exact advanced runner contracts against their pinned runtime | Controlled receipts prove templates, hashes, node allowlists, outputs, and no unsafe nodes |
| 2 | MODEL-LIC-QUAL | Evidence complete; approval blocked | Have an authorized reviewer decide every model/transitive license for intended commercial YouTube use; resolve LTX entity/revenue/gated terms, LatentSync weight-license text, Gemma attribution/provenance, and voice-rights boundaries from the 2026-08-26 dossier | Named, dated accepted decisions for every core model; no inferred permission |
| 3 | WORKER-BUILD-QUAL | Passed for candidate `.3` | Retain run `32967547472`, canonical referrer `sha256:c979edccb17c97a217b015429d9e39b831259389b5fdf3a69b9dc7c81e81b094`, independent exact-identity verification, and the local build/registry digest evidence | Canonical GitHub OIDC signature matching the exact workflow identity plus build evidence tied to image `sha256:875eea3747e89369df5f375aa600bf6de634950c988a82494a2671c0e643603e`; later image candidates must repeat this gate |
| 4 | MODEL-HASH-QUAL | Release-blocked | Run pinned bootstrap on controlled persistent storage | Complete `studio-model-qualification.json` |
| 5 | GPU-CAP-QUAL | Release-blocked | Repeat core preflight with all core-approved models on an allowed 48 GB-class GPU | Matching core `studio-capability.json`, complete hashes, smoke pass, sufficient VRAM/disk/runtime |
| 6 | MEDIA-BENCH-QUAL | Release-blocked | Run image, edit, TTS, LTX and all LatentSync fixtures | Human-reviewed quality/runtime/VRAM evidence for each mandatory test |
| 7 | SECURITY-RECOVERY-QUAL | Release-blocked | Prove gateway auth, loopback-only Comfy, resume, reconciliation, cancellation and purge | Linked pass evidence with no cross-job/project access |
| 8 | SHUTDOWN-COST-QUAL | Release-blocked | Prove idle exit, hard deadline, provider termination, and cost ledger | Provider-side termination and billing evidence |
| 9 | PROMOTE-001 | Release-blocked | Run the guarded promotion tool on exact evidence | Production pack/manifest/readiness receipt created atomically |
| 10 | PILOT-001 | Release-blocked | Produce and review a 60–90 second pilot, then a 20–35 minute episode and one-off film | Continuity, voice, motion, lip, audio, recovery and budget acceptance |
| 11 | RELEASE-001 | Release-blocked | Sign the current branded NSIS candidate and install it on a clean Windows machine | Authenticode, install/upgrade/uninstall, accessibility and non-technical acceptance |

## 4. Version-0.10 feature foundations and retained locks

| Work package | State | Implemented outcome | Remaining boundary |
| --- | --- | --- | --- |
| CONTROL-001 | Implemented control-plane slice | Approved pose/depth/edge/segmentation/mask/start/end/motion/reference asset roles, ordered hash manifest, unsupported-role refusal, Qwen/LTX candidate definitions | Typed role-specific coordinate/time metadata, exact adapters/templates/nodes, rights fixtures, AT-043/AT-045 live proof |
| LAYER-001 | Implemented foundation | Foreground/subject/background and region-mask media roles can be imported, reviewed, lineage-tracked, and planned with AI assistance | Dedicated non-destructive separation authoring, occlusion/safe-margin recipe and deterministic parallax acceptance AT-044 |
| LTXADV-001 | Implemented candidate slice | Control-guided LTX-2.5 job definition and neutral manifest boundary | IC-LoRA/reference/multishot/DFR/upsample implementations only after exact compatibility benchmarks |
| FOLEY-001 | Implemented candidate slice | Separate foley job/output kind, cue-plan assistance, dialogue-preservation parameter, hash-locked contract, and exact model-free procedural runner | Synchronized rights/usefulness/dialogue-preservation fixtures and AT-047 |
| ADAPT-001 | Implemented candidate contract; separately packaged profile pending | Rights/consent-reviewed 4–100-sample dataset builder, ordered asset IDs/hashes, official pinned LTX trainer contract, explicit failed-reference gate, and project scope; trainer removed from the core image | Build a separate immutable adaptation image only after the reference-only benchmark fails, then complete trainer qualification, evaluation/promotion/rollback, cost/regression proof AT-048/AT-049 |
| THUMB-ADV-001 | Implemented local foundation | Deterministic thumbnail plus LLM concept/headline planning | Generated illustration candidate qualification and responsive comparison depth |
| PUBLISH-001 | Planned and intentionally locked | No YouTube mutation surface exists | Separate post-version-1 authorization, OAuth/quota/private-first/duplicate/reconciliation/policy/audit review |
| SKILL-TOOL-001 | Planned and intentionally locked | Declarative skills remain the only executable request influence | Signatures, sandbox, timeout, local/remote/MCP permission and secret-safety proof |

Wan is not a backlog item for version 1. LatentSync is a targeted lip-repair postprocessor, not a replacement video engine.

## 5. No-loss intake rule

Every new feature, risk, model/update, provider behavior, or fix must receive a stable ID here; state the affected requirements, code, evidence, docs, rollback, cost, and security boundary; and update [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md), [TRACEABILITY.md](TRACEABILITY.md), [STATUS.md](STATUS.md), [SOURCES.md](SOURCES.md), and [CHANGELOG.md](../CHANGELOG.md) in the same change.

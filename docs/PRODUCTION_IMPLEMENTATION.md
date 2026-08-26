# Production implementation and qualification guide

Version: 0.10.1

Last updated: 2026-08-26

Status: implemented local control plane; paid generation locked pending controlled GPU qualification

This document is the current implementation overlay for Animated Series Studio. Product requirements remain in [PRD.md](PRD.md). Where an older phase description says a version-0.9 component is “not started,” this document and [STATUS.md](STATUS.md) are authoritative.

## 1. What exists now

The application is a local-first Windows production control room for multiple animated series and one-off films. It now implements:

- isolated local projects, versioned creative direction, proposals, canon, media, approvals, dependencies, job events, cost records, timelines, releases, backups, and recovery records;
- protected RunPod, OpenAI, Anthropic, and Gemini keys that are never returned to the renderer or written into projects;
- project-scoped declarative writing skills with visible routing plans and exact execution receipts;
- one governed project-aware idea assistant across applicable creative/planning fields, using the same protected provider, exact context preview, declarative-skill plan, paid-text confirmation, and schema-3 proposal lineage;
- a pinned upstream `shuohao-skills` adapter that validates and imports supported story packages without modifying the submodule;
- in-app image, audio, and video viewing through a restricted local-media protocol;
- character/world/storyboard media import and approval, versioned canon promotion, scoped child-asset correction, and stale-dependency counts;
- a governed GPU workflow catalogue for Qwen image generation/editing, Qwen3-TTS, LTX-2.5 motion/dialogue, LatentSync lip repair, warning-only technical QC, plus deliberately locked candidates for control-guided Qwen/LTX, separate foley, and optional project adaptation;
- official RunPod Pod lifecycle calls, lease reconciliation, one-GPU-per-job concurrency, cost approval, separate start confirmation, hard deadlines, idle shutdown, cancellation, provider termination, and audit-preserving worker-close records;
- an authenticated worker gateway with ComfyUI bound to `127.0.0.1:8188`, allowlisted workflow IDs, parameter schemas, node allowlists, exact templates, verified model paths, resumable 4 MiB file transfers, output hashes, purge, and recovery;
- deterministic local FFmpeg installation, rough-cut rendering, editable SRT/VTT captions, thumbnails, local technical verification, project-local versioned release profiles/ideas/performance/learning records, bounded official-report CSV import with file/row provenance, immutable release records, and a verified manual YouTube upload package.

The source implementation is broad, but the shipped candidate deliberately has no production workflow pack. It cannot start paid generation until the external qualification gate in section 8 produces exact evidence. This is a safety property, not unfinished button wiring.

## 2. Plain-language creator flow

1. Start with a story idea or existing text script. Choose series/film, optional title, and language. The app creates a separate local project without an AI or GPU charge. The optional detailed wizard remains available.
2. Creator Mode derives the next missing stage from durable state. Its default surface shows that one step, one primary action, a compact creative-approval bar, and GPU state. A collapsed eight-checkpoint production run projects story package, character/location references, storyboard frames, voices/dialogue, video shots, locked local edit/captions, verified master, and worker cleanup from active canon, approved media, saved jobs/timelines, and reported active workers.
3. Connect one protected writing provider and optionally enable reviewed writing skills. For each text stage, the app attaches the source, settings, active direction and all active canon automatically, then selects the saved controlled model and declared fallbacks.
4. The Create action states the selected service, potential text billing, no-GPU boundary, and any fallback count; clicking that action is the explicit request approval. A provider result remains a proposal and changes nothing until the creator reviews and promotes its exact fingerprint.
5. Earlier stages can be revisited as new revisions. Existing approved facts and outputs are never overwritten. Detailed rooms and field-level **Generate ideas** remain available through Advanced Studio for precise intervention.
6. Import or generate character boards, style boards, environment boards, storyboard frames, voice references, and other source media. Approve only usable assets. The secondary one-off asset tool can prefill Image, Video, Audio, Composition, or local Assemble work after its prerequisites exist; opening that handoff neither estimates nor starts a job.
7. Build a timed storyboard/animatic locally before expensive motion work. The storyboard defines intent; the locked job also carries the exact approved files, canon versions, workflow version, parameters, seed, and cost limit needed to reproduce execution.
8. In Generate, choose one operation. The app validates required input count and order, displays compatible GPUs, and calculates expected and maximum cost without renting anything. Advanced controls are serialized as ordered approved roles/hashes; unsupported roles block. Adaptation additionally requires an approved dataset plus explicit benchmark-failure and rights confirmations.
9. Approve that exact maximum. This saves a local record but still does not start a GPU.
10. Give a separate start confirmation. Only a qualified workflow can now create one worker lease. Independent jobs may run concurrently up to the saved limit of one to three GPUs.
11. The app uploads verified inputs, monitors the job, downloads outputs, verifies hashes, closes the worker, and preserves its IDs and events for audit. A failed or uncertain call is reconciled by lease before any retry.
12. Review outputs in the app. Approve, reject, or create a child retake; generated output never becomes canon merely because a model completed it.
13. Assemble approved media locally, render the rough cut/master candidate, create captions and a truthful thumbnail, complete audience/disclosure/originality/rights/full-watch attestations, and build a hash-checked manual upload folder.

## 3. Model and engine baseline

| Need | Candidate engine | Production rule |
| --- | --- | --- |
| Character, style, environment, and storyboard boards | Qwen-Image-2512 FP8 in ComfyUI | Exact checkpoint, encoder, VAE, workflow, node, image digest, license decision, VRAM, runtime, and quality evidence required |
| Targeted visual correction | Qwen-Image-Edit-2511 BF16 in ComfyUI | Creates a child asset; the approved parent remains immutable |
| Original voice design and reusable line book | Qwen3-TTS 1.7B VoiceDesign/Base | A reusable voice reference must be original or rights-cleared; reference transcript must be exact |
| Draft and final motion | LTX-2.5 split components in ComfyUI | LTX remains the only version-1 generative video engine; Wan is absent |
| Audio-conditioned dialogue motion | LTX-2.5 candidate workflow | Approved dialogue remains the source audio; no silent replacement |
| Targeted mouth/timing repair | LatentSync 1.6 isolated Python runner | A post-process repair tool, not a second video-generation engine; video first and approved audio second |
| Control-guided board/shot | Qwen/LTX candidate definitions | Neutral start/end/pose/depth/edge/segmentation/mask/motion/reference roles compile to ordered manifests; paid execution stays locked until exact adapters qualify |
| Ambience/effects/foley | Rights-aware candidate contract | Stays separate from dialogue/music; exact model, license, runner, timing and quality fixtures remain unresolved |
| Optional project adaptation | Official pinned LTX trainer and LTX-2.5 LoRA candidate contract | The local builder binds 4–100 approved samples by ID/hash/caption/rights/consent and requires a recorded failed reference-only benchmark; live trainer/evaluation/promotion remains locked |
| Editorial, captions, thumbnail, package | Local FFmpeg and deterministic file operations | No rented GPU and only approved inputs |

LTX Dub-It is not used in this baseline because the official feature guide validated it for LTX-2.3 while LTX-2.5 support was still in development. The isolated LatentSync path avoids silently mixing an incompatible LTX checkpoint into the main worker.

## 4. Local application boundaries

The Electron main process owns files, SQLite, vault access, provider traffic, external processes, worker clients, and release writes. The sandboxed renderer receives only named, schema-validated preload methods. Saved secret values are never sent to it. Writing-provider model-list checks retain a 30-second ceiling, while confirmed structured drafts have a separate five-minute ceiling. Gemini short field suggestions use low thinking and longer production stages use medium thinking; a timeout saves no proposal and never triggers a hidden paid retry.

Projects are authoritative local records. Cloud storage is a cache. Every imported or downloaded asset has a local SHA-256, immutable source lineage, project ID, state, and parent links. The `studio://media` protocol resolves only known project assets and supports media range requests without exposing arbitrary paths.

Writing output is a proposal. Canon promotion is a separate human decision. Media output is a candidate. Approval is a separate human decision. Release packaging is local and manual; version 1 has no YouTube publishing authority.

## 5. Paid job and worker lifecycle

```text
candidate workflow
  -> external qualification receipt
  -> production workflow pack
  -> no-cost estimate
  -> exact maximum-cost approval
  -> separate worker-start confirmation
  -> unique lease + one-time gateway token
  -> reconcile existing lease
  -> create one RunPod GPU Pod
  -> model bootstrap + ComfyUI loopback preflight
  -> authenticated upload and execution
  -> verified download and local review
  -> purge job workspace
  -> terminate Pod and record workerClosedAt
```

The bearer token is generated locally. Only its SHA-256 hash is sent in Pod environment variables; the token stays in the protected lease vault. The image is pulled by immutable digest. The Pod exposes only gateway port 8000. ComfyUI has no public route.

One job uses one GPU because the selected workflows do not split one five-second shot efficiently across unrelated GPUs. Setting two or three concurrent GPUs means two or three independent jobs can run in parallel. The guardrail checks current active Pods and combined limits before creation.

RunPod can still charge for retained persistent storage after compute stops. A Pod backed by a network volume is terminated, not “stopped,” after results are safe. Provider costs remain external facts and are reconciled rather than guessed from the estimate.

## 6. Worker image and automatic setup

`worker/Dockerfile` is the normal core-generation image. It pins ComfyUI, the LTX custom nodes, Qwen3-TTS, and LatentSync, but deliberately excludes the optional LTX adaptation trainer. It pins Kornia 0.8.2 because the exact LTX node revision imports an API removed by 0.8.3, Transformers 5.14.1 because LTX excludes the regressed 5.15 line, and a Python 3.10 LatentSync environment because the pinned upstream setup declares 3.10.13 and its MediaPipe pin has no Python 3.12 wheel. Qwen3-TTS and LatentSync use separate environments so their dependencies cannot silently rewrite ComfyUI's runtime; the image also verifies Qwen's required `sox` executable and common codecs. Runtime dependencies are built into the image; the worker never installs custom nodes or accepts arbitrary commands during a job.

Optional adaptation is a separate worker profile, not a repair performed on the core worker. The candidate contract and exact trainer pin remain recorded, but adaptation cannot enter a production pack until a separately built trainer image has its own digest and passes the full training/license/driver/quality/cost/rollback evidence set. The core promotion filters every `advanced` candidate out of the production pack, so native-audio/control/foley/adaptation work stays visibly locked without blocking the first image/voice/video/lip-repair release.

The model installer reads only `config/model-install-manifest.*.json`. Each entry contains an allowlisted Hugging Face repository, immutable revision, source path, destination, license URL, and production hash. It rejects absolute/traversal destinations and undeclared repositories. The separate `config/model-license-review.candidate.json` records evidence for all eight pinned repositories plus the transitive Gemma 4 encoder source without changing any manifest entry to accepted. Its deterministic check requires complete source/scope coverage and pending, unnamed, undated decisions until an authorized reviewer acts.

- `STUDIO_MODEL_BOOTSTRAP_MODE=qualification` downloads pinned candidate entries only after the release engineer explicitly lists reviewed model IDs in `STUDIO_ACCEPTED_MODEL_LICENSES`; it computes a qualification receipt.
- `STUDIO_MODEL_BOOTSTRAP_MODE=production` accepts only an already promoted manifest whose hashes and license decisions are locked. The app supplies only the model IDs needed for that job, so a reusable volume is filled on demand.
- Offline flags are set for actual inference. A running production job cannot fetch another model or node.

The ordinary creator does not set up the GPU every episode. A maintainer builds and qualifies one worker release; after that the app creates and configures temporary workers automatically from the locked image and cached models.

## 7. ComfyUI workflow reliability

ComfyUI is the execution engine, not the review interface. A production Comfy workflow must be an API-format prompt stored under `config/workflows`, have a SHA-256 in the production pack, and use only reviewed node types. The importer refuses UI-format/unsafe workflow content and records its exact node inventory.

The candidate pack contains reviewed, hash-locked API graphs for Qwen character/storyboard frames, Qwen targeted edits, an LTX single-stage draft, an LTX two-stage final, native LTX audio-driven dialogue, control-guided Qwen, and control-guided LTX. Rights-aware foley and project adaptation have exact hash-locked runner contracts. All are structurally checked and non-billable. Core promotion is atomic across every core and local-finishing entry and includes only the models those workflows reference. Advanced entries remain candidate-only until a separately packaged profile passes its own declared model, GPU runtime, output quality, cost, rights, security, recovery, and shutdown evidence.

At worker startup, preflight verifies GPU/VRAM, disk, ComfyUI commit, installed nodes, model hashes, workflow hashes, the normalized workflow-pack fingerprint, image digest, and a tiny loopback smoke workflow. The desktop repeats qualification against the selected workflow before uploading inputs.

Local verification on 2026-08-25 built the smaller core candidate `0.10.1-candidate.3` under WSL2 Docker and passed this model-free smoke on an RTX 3050 Ti. The report captured the local image ID, exact runtime versions, node inventory, and nine workflow hashes; gateway authentication and loopback-only host binding also passed. On 2026-08-26 that exact image was published, pulled by immutable digest, keyless-signed with Sigstore, and signature-verified. Protected GitHub OIDC run `32967547472` and a separate local Cosign check verified the exact canonical workflow identity. This evidence still does not provide any model hash, a compatible 18–48 GB core benchmark, media quality, provider lifecycle, cost, or production promotion.

The gateway accepts only a registered workflow/version and its declared parameters. `$PARAM:<key>` and `$INPUT:<index>` are the only template placeholders. Uploaded assets are size/hash checked, copied into a lease/job namespace under the Comfy input directory, and removed during purge. Outputs are copied into the job workspace and hashed before download.

## 8. Locked one-time GPU qualification

The repository ships candidate pins, not fabricated production evidence. The no-cost [candidate model-license review](MODEL_LICENSE_REVIEW_2026-08-26.md) inventories all pinned and known transitive sources, records the LTX/LatentSync blockers, and leaves every legal decision pending. These no-cost preparation tools are implemented:

```powershell
.\scripts\New-GpuQualificationBundle.ps1
.\scripts\Build-GpuWorker.ps1 -ImageName registry.example/studio-worker:0.10.1-candidate.2 -AllowCandidate
node scripts\Import-ComfyWorkflow.mjs --workflow-id <id> --input <api-workflow.json>
```

The controlled core run sets both `STUDIO_QUALIFICATION_MODE=controlled` and `STUDIO_MODEL_BOOTSTRAP_MODE=qualification`. Normal application-created workers never set the qualification flag. Core qualification runs every required image, edit, voice, line-book, draft/final, animated lip-sync, creative-QC, local-finishing, security, resumable-transfer, reconciliation, shutdown, and cost test. Its current maximum declared workflow requirement is 48 GB. Native-audio/control/foley/adaptation tests and the trainer's 80 GB/R595 compatibility proof belong to later profile-specific qualification and cannot be represented by the core receipt.

Promotion requires three external artifacts:

1. `studio-model-qualification.json` with every pinned model hash;
2. `studio-capability.json` from the exact image/pack/GPU after preflight;
3. a completed `qualification-evidence.json` with named/dated license decisions and evidence for every mandatory test.

Then:

```powershell
node scripts\Promote-GpuWorker.mjs `
  --model-receipt <studio-model-qualification.json> `
  --capability-report <studio-capability.json> `
  --evidence <qualification-evidence.json>
```

The promotion tool refuses stale pack fingerprints, core model/source mismatches, null hashes, missing templates, unreviewed nodes, insufficient core VRAM, missing licenses, failed core tests, missing shutdown proof, or mismatched image digests. It atomically creates the core production workflow pack, core-only model manifest, and readiness receipt. Advanced candidates are omitted rather than marked qualified, and the tool will not overwrite an earlier release.

## 9. Recovery and cost controls

- Every paid operation uses an idempotency key and unique lease ID.
- An uncertain create response triggers `findPodByLease`; it never blindly creates a second Pod.
- Uploads and downloads use bounded sequential chunks and final SHA-256 verification.
- Job state and events are durable locally; restart reconciliation resumes from known provider and worker IDs.
- Cancellation stops child process groups, purges scoped inputs, terminates the worker, and records closure.
- The remote watchdog uses the hard UTC deadline even if the desktop disappears. The gateway also exits after the configured authenticated-idle period.
- Estimates show one GPU’s current hourly price, expected minutes, hard maximum minutes, and maximum total. They are not presented as actual provider invoices.

## 10. Release, performance evidence, and YouTube boundaries

The Finish room renders from an approved timeline, creates editable captions, renders a deterministic thumbnail from authorized imagery and text, verifies the master, records explicit human attestations, and creates an immutable manual-upload package with file hashes.

It also stores immutable project-local release-profile revisions, source-labelled ideas, and time-windowed structured performance snapshots. Snapshots pin the metric-definition version, identify official/manual/rehearsal source, warn about missing metrics, and exclude rehearsal values from baselines. The official-report path parses a bounded YouTube Analytics CSV, rejects unsafe/ambiguous rows, records the file SHA-256 and selected row, and leaves values reviewable before saving. A learning proposal cites snapshot IDs and separates observation, inference, recommendation, confidence, and scope; only a creator can approve or reject it with a reason. Optional read-only OAuth remains separate future work.

Title and description validation uses current YouTube field limits. The package retains disclosure and rights decisions, but the app does not decide made-for-kids status or whether a synthetic-content disclosure legally applies. It does not auto-publish, promise ranking, keyword-stuff, or call local variants a real audience experiment.

## 11. What still requires external proof

The following are deliberately not claimed complete on this development machine:

- the candidate Docker image passed local model-free preflight and was published, pulled, personally and canonically keyless-signed, and signature-verified by immutable registry digest; protected GitHub OIDC run `32967547472` passed exact workflow-identity verification, but the image has not run with the declared production models;
- the exact candidate API graphs and runner contracts still require controlled model-backed benchmarks on their declared compatible GPU classes;
- model-license evidence has been recorded, but no commercial-use decision has been accepted and no model hash exists;
- no real RunPod GPU, model download, live workflow, transfer, watchdog, or provider-termination qualification has run;
- no 20–35 minute pilot episode or one-off film has passed human continuity, motion, lip, audio, recovery, and budget acceptance;
- the Windows artifact is not yet a signed production installer and has not passed a clean-machine non-technical acceptance run;
- optional read-only YouTube OAuth and automatic YouTube publishing remain outside this release; checked CSV import, structured local performance evidence, and human-reviewed learning are implemented without any account mutation.

These are release evidence tasks, not permission to bypass the locks. [BUILD_BACKLOG.md](BUILD_BACKLOG.md) remains the ledger until they pass.

## 12. Change rule

Any model, workflow, source pin, worker image, license decision, GPU class, timeout, output contract, YouTube rule, or security fix changes the candidate version and invalidates the old qualification fingerprint. Update this document, affected specifications, traceability, backlog, tests, sources, status, and changelog in the same change. Existing approved media keeps its original manifest.

# Production implementation and qualification guide

Version: 0.9.0

Last updated: 2026-08-22

Status: implemented local control plane; paid generation locked pending controlled GPU qualification

This document is the current implementation overlay for Animated Series Studio. Product requirements remain in [PRD.md](PRD.md). Where an older phase description says a version-0.9 component is “not started,” this document and [STATUS.md](STATUS.md) are authoritative.

## 1. What exists now

The application is a local-first Windows production control room for multiple animated series and one-off films. It now implements:

- isolated local projects, versioned creative direction, proposals, canon, media, approvals, dependencies, job events, cost records, timelines, releases, backups, and recovery records;
- protected RunPod, OpenAI, Anthropic, and Gemini keys that are never returned to the renderer or written into projects;
- project-scoped declarative writing skills with visible routing plans and exact execution receipts;
- a pinned upstream `shuohao-skills` adapter that validates and imports supported story packages without modifying the submodule;
- in-app image, audio, and video viewing through a restricted local-media protocol;
- character/world/storyboard media import and approval, versioned canon promotion, scoped child-asset correction, and stale-dependency counts;
- a governed GPU workflow catalogue for Qwen image generation/editing, Qwen3-TTS, LTX-2.5 motion/dialogue, LatentSync lip repair, and warning-only technical QC;
- official RunPod Pod lifecycle calls, lease reconciliation, one-GPU-per-job concurrency, cost approval, separate start confirmation, hard deadlines, idle shutdown, cancellation, provider termination, and audit-preserving worker-close records;
- an authenticated worker gateway with ComfyUI bound to `127.0.0.1:8188`, allowlisted workflow IDs, parameter schemas, node allowlists, exact templates, verified model paths, resumable 4 MiB file transfers, output hashes, purge, and recovery;
- deterministic local FFmpeg installation, rough-cut rendering, editable SRT/VTT captions, thumbnails, local technical verification, immutable release records, and a verified manual YouTube upload package.

The source implementation is broad, but the shipped candidate deliberately has no production workflow pack. It cannot start paid generation until the external qualification gate in section 8 produces exact evidence. This is a safety property, not unfinished button wiring.

## 2. Plain-language creator flow

1. Create a series or one-off film. Its files and history stay separate from every other project.
2. Complete the Audience & Creative Direction profile. Required fields have asterisks, live length/range help, and a correction popup.
3. Connect a writing provider and optionally enable reviewed writing skills for this project.
4. Create proposals for the bible, characters, world, outline, scenes, dialogue, continuity, storyboard plan, and YouTube release strategy.
5. Review and promote only accepted proposal sections into versioned canon. Revisions do not erase prior facts.
6. Import or generate character boards, style boards, environment boards, storyboard frames, voice references, and other source media. Approve only usable assets.
7. Build a timed storyboard/animatic locally before expensive motion work. The storyboard defines intent; the locked job also carries the exact approved files, canon versions, workflow version, parameters, seed, and cost limit needed to reproduce execution.
8. In Generate, choose one operation. The app validates required input count and order, displays compatible GPUs, and calculates expected and maximum cost without renting anything.
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
| Editorial, captions, thumbnail, package | Local FFmpeg and deterministic file operations | No rented GPU and only approved inputs |

LTX Dub-It is not used in this baseline because the official feature guide validated it for LTX-2.3 while LTX-2.5 support was still in development. The isolated LatentSync path avoids silently mixing an incompatible LTX checkpoint into the main worker.

## 4. Local application boundaries

The Electron main process owns files, SQLite, vault access, provider traffic, external processes, worker clients, and release writes. The sandboxed renderer receives only named, schema-validated preload methods. Saved secret values are never sent to it.

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

`worker/Dockerfile` pins ComfyUI, the LTX custom nodes, Qwen3-TTS, and LatentSync source commits. Runtime dependencies are built into the image; the worker never installs custom nodes or accepts arbitrary commands during a job.

The model installer reads only `config/model-install-manifest.*.json`. Each entry contains an allowlisted Hugging Face repository, immutable revision, source path, destination, license URL, and production hash. It rejects absolute/traversal destinations and undeclared repositories.

- `STUDIO_MODEL_BOOTSTRAP_MODE=qualification` downloads pinned candidate entries only after the release engineer explicitly lists reviewed model IDs in `STUDIO_ACCEPTED_MODEL_LICENSES`; it computes a qualification receipt.
- `STUDIO_MODEL_BOOTSTRAP_MODE=production` accepts only an already promoted manifest whose hashes and license decisions are locked. The app supplies only the model IDs needed for that job, so a reusable volume is filled on demand.
- Offline flags are set for actual inference. A running production job cannot fetch another model or node.

The ordinary creator does not set up the GPU every episode. A maintainer builds and qualifies one worker release; after that the app creates and configures temporary workers automatically from the locked image and cached models.

## 7. ComfyUI workflow reliability

ComfyUI is the execution engine, not the review interface. A production Comfy workflow must be an API-format prompt stored under `config/workflows`, have a SHA-256 in the production pack, and use only reviewed node types. The importer refuses UI-format/unsafe workflow content and records its exact node inventory.

At worker startup, preflight verifies GPU/VRAM, disk, ComfyUI commit, installed nodes, model hashes, workflow hashes, the normalized workflow-pack fingerprint, image digest, and a tiny loopback smoke workflow. The desktop repeats qualification against the selected workflow before uploading inputs.

The gateway accepts only a registered workflow/version and its declared parameters. `$PARAM:<key>` and `$INPUT:<index>` are the only template placeholders. Uploaded assets are size/hash checked, copied into a lease/job namespace under the Comfy input directory, and removed during purge. Outputs are copied into the job workspace and hashed before download.

## 8. Locked one-time GPU qualification

The repository ships candidate pins, not fabricated production evidence. These no-cost preparation tools are implemented:

```powershell
.\scripts\New-GpuQualificationBundle.ps1
.\scripts\Build-GpuWorker.ps1 -ImageName registry.example/studio-worker:0.9.0-candidate.1 -AllowCandidate
node scripts\Import-ComfyWorkflow.mjs --workflow-id <id> --input <api-workflow.json>
```

The controlled run sets both `STUDIO_QUALIFICATION_MODE=controlled` and `STUDIO_MODEL_BOOTSTRAP_MODE=qualification`. Normal application-created workers never set the qualification flag. The qualification Pod runs every required image, edit, voice, line-book, draft/final/dialogue motion, animated lip-sync fixture, security, resumable-transfer, reconciliation, shutdown, and cost test.

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

The promotion tool refuses stale pack fingerprints, model/source mismatches, null hashes, missing templates, unreviewed nodes, insufficient VRAM, missing licenses, failed tests, missing shutdown proof, or mismatched image digests. It atomically creates the production workflow pack, model manifest, and readiness receipt. It will not overwrite an earlier release.

## 9. Recovery and cost controls

- Every paid operation uses an idempotency key and unique lease ID.
- An uncertain create response triggers `findPodByLease`; it never blindly creates a second Pod.
- Uploads and downloads use bounded sequential chunks and final SHA-256 verification.
- Job state and events are durable locally; restart reconciliation resumes from known provider and worker IDs.
- Cancellation stops child process groups, purges scoped inputs, terminates the worker, and records closure.
- The remote watchdog uses the hard UTC deadline even if the desktop disappears. The gateway also exits after the configured authenticated-idle period.
- Estimates show one GPU’s current hourly price, expected minutes, hard maximum minutes, and maximum total. They are not presented as actual provider invoices.

## 10. Release and YouTube boundaries

The Finish room renders from an approved timeline, creates editable captions, renders a deterministic thumbnail from authorized imagery and text, verifies the master, records explicit human attestations, and creates an immutable manual-upload package with file hashes.

Title and description validation uses current YouTube field limits. The package retains disclosure and rights decisions, but the app does not decide made-for-kids status or whether a synthetic-content disclosure legally applies. It does not auto-publish, promise ranking, keyword-stuff, or call local variants a real audience experiment.

## 11. What still requires external proof

The following are deliberately not claimed complete on this development machine:

- the candidate Docker image has not been built here because Docker is unavailable;
- official ComfyUI example workflows still require API-format export, safe parameter binding, and controlled benchmark import;
- model hashes and commercial-use license decisions have not been recorded;
- no real RunPod GPU, model download, live workflow, transfer, watchdog, or provider-termination qualification has run;
- no 20–35 minute pilot episode or one-off film has passed human continuity, motion, lip, audio, recovery, and budget acceptance;
- the Windows artifact is not yet a signed production installer and has not passed a clean-machine non-technical acceptance run;
- optional analytics and automatic YouTube publishing remain outside this release.

These are release evidence tasks, not permission to bypass the locks. [BUILD_BACKLOG.md](BUILD_BACKLOG.md) remains the ledger until they pass.

## 12. Change rule

Any model, workflow, source pin, worker image, license decision, GPU class, timeout, output contract, YouTube rule, or security fix changes the candidate version and invalidates the old qualification fingerprint. Update this document, affected specifications, traceability, backlog, tests, sources, status, and changelog in the same change. Existing approved media keeps its original manifest.

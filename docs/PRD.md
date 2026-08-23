# Product requirements document

Product baseline: 1.0

Current source implementation: 0.10.0

Date: 2026-08-23

Status: local control plane implemented; paid media generation qualification pending

Implementation note: [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md) and [STATUS.md](STATUS.md) describe which requirements now have code/local evidence and which still require real GPU, model-license, quality, shutdown, long-form, signing, or clean-machine proof. A requirement is not weakened merely because its external acceptance gate remains locked.

## 1. Product statement

Animated Series Studio gives a non-technical creator one safe place to develop and produce multiple stylized animated series or one-off films. It preserves characters, voices, environments, style, scripts, storyboards, approvals, costs, and exact generation inputs across months of production. Heavy generation runs on temporary rented GPUs that the studio starts and terminates automatically.

The product is a supervised production system, not a “type one prompt and receive a flawless 30-minute episode” promise. It automates repeatable work and exposes clear approval points where creative judgment remains necessary.

## 2. Problem

Current generative-media workflows are usually collections of unrelated tools and folders. That creates predictable failures:

- Character appearance, wardrobe, scale, voice, and personality drift between shots or episodes.
- A storyboard describes intent but does not automatically preserve the exact assets, model settings, audio, and prompt used for a take.
- Changing an upstream decision leaves downstream shots silently outdated.
- Cloud machines are technical to configure and can remain billable after work finishes.
- Long episodes require hundreds of shot decisions, retries, approvals, and file transfers that are hard to resume safely.
- Multiple series can accidentally share the wrong style, character, voice, seed, or asset.
- A model or upstream-skill update can change output behavior in the middle of a season.
- Costs are guessed from hourly GPU prices without accounting for shot count, retries, upscale, lip-sync, and failed generations.

## 3. Primary user

The primary user is a creator who understands stories, characters, and visual taste but should not need to understand Git, Docker, Python, ComfyUI nodes, cloud networking, or GPU memory.

The product may later support collaborators, but version 1 is optimized for one local owner and one workstation.

## 4. Product principles

1. **Lock before multiplying.** Approve a representative character, voice, location, and scene before bulk generation.
2. **Local is authoritative.** Cloud workers can disappear without losing the project.
3. **Every output is reproducible.** A take records its exact inputs, versions, seed, workflow, model, and cost.
4. **Upstream changes are explicit.** A changed asset makes dependants stale; it never silently changes history.
5. **Spend is intentional.** The user sees an estimate and budget cap before a paid batch begins.
6. **Simple surface, inspectable depth.** Normal screens use plain language; an expert panel can reveal technical details.
7. **Hybrid animation is valid animation.** Held frames, parallax, loops, reaction shots, edited camera movement, generated motion, sound, and dialogue all contribute to the final result.
8. **Documentation is executable policy.** A feature or fix is incomplete when the documents and tests still describe old behavior.

## 5. Scope

### 5.1 Version 1 includes

- Multiple isolated series, seasons, episodes, and one-off films.
- Import and validation of the pinned `shuohao-skills` outline, character, art, script, storyboard, and shot-recipe outputs.
- Creation and versioning of character boards, style bibles, locations, props, wardrobe, expression sheets, and reference packs.
- Image generation and controlled editing through Qwen-Image-family workflows.
- Designed or consented recurring voices through Qwen3-TTS, with line-level retakes and a pronunciation dictionary.
- Engine-neutral storyboards converted into versioned LTX generation plans.
- LTX draft, production, image-to-video, audio-to-video, keyframe, retake, and lip-dub workflows where supported and validated.
- Automated RunPod provisioning, authenticated worker startup, job transfer, progress, result download, watchdog termination, and cost capture.
- One to three concurrent workers, limited by budget and compatibility.
- Shot review, comparison, approval, rejection, notes, and targeted retake.
- Automatic rough-cut assembly, dialogue placement, captions, sound layers, technical QC, and YouTube-ready export.
- Versioned channel/series release profiles, a source-labelled idea library, public-facing thumbnail candidates, release metadata/chapters, policy attestations, and a complete manual-upload package.
- Optional post-release performance import or read-only analytics connection whose recommendations require human approval before affecting future planning.
- A versioned timed animatic, engine-neutral pose/depth/edge/mask/motion controls, layered 2D parallax assets, advanced benchmark-approved LTX control/fidelity profiles, creative-assist QC, and rights-aware effects/foley.
- Optional project-scoped character or style adaptation only when the reference-only consistency benchmark proves it is needed.
- Backup, restore, crash recovery, audit history, and upstream update controls.

### 5.2 Explicitly outside version 1

- Real-time animation or live broadcasting.
- Fully automatic public upload or channel management.
- Wan or another second video engine unless a future benchmark and accepted decision justify adding one.
- A promise of zero human review for a 20–35 minute episode.
- Training a new foundation model.
- Native Blender/Maya rigging, skeletal animation, motion capture, or reusable 3D meshes. A “3D-look” generated character is supported; a true rigged 3D production pipeline is a separate future product decision.
- Photorealistic-human quality as a release requirement.
- Voice cloning without documented rights and consent.
- Automatic acquisition of copyrighted music, celebrity likenesses, or unlicensed training/reference material.
- Live multi-user collaboration and cloud-hosted project databases.
- Unreviewed runtime installation of ComfyUI nodes, Python packages, models, or workflow dependencies during a production session.
- Treating an automated identity, motion, lip-sync, or speech-recognition score as creative approval.

## 6. Functional requirements

### Projects and isolation

- **FR-001:** The user can create a project of type `series` or `film` through a guided wizard.
- **FR-002:** A series supports seasons and episodes; a film supports sequences and scenes while using the same shot pipeline.
- **FR-003:** Every project has isolated characters, voices, styles, locations, props, workflows, budgets, and outputs. Cross-project reuse requires an explicit copy operation.
- **FR-004:** The home screen shows project status, last safe checkpoint, queued work, current cloud spend, and blocked approvals without exposing technical implementation details.

### Pre-production and continuity

- **FR-005:** The studio imports the six pinned upstream skills through a versioned adapter and retains the original source files unchanged.
- **FR-006:** The studio validates imported outline, cast, art, script, storyboard, and shot-recipe data and explains errors in plain language.
- **FR-007:** The user can create, compare, approve, lock, and version character, voice, style, scene, prop, wardrobe, and storyboard assets.
- **FR-008:** Each episode pins the exact approved versions it uses; later bible changes do not rewrite an already approved episode.
- **FR-009:** Changing a locked asset produces an impact report and marks every dependent object `stale` until reviewed, regenerated, or explicitly accepted.
- **FR-010:** The studio maintains a continuity view showing character appearance, wardrobe, voice, location state, prop state, time of day, and unresolved differences by scene and shot.

### Image and board production

- **FR-011:** The user can generate character concepts, model sheets, expression/pose boards, wardrobe variants, environment boards, prop boards, and storyboard frames from approved source facts.
- **FR-012:** Image workflows accept multiple approved references and record model, workflow version, prompts, negative prompts, dimensions, seeds, reference hashes, and take lineage.
- **FR-013:** A character cannot be used for bulk video generation until a minimum identity pack and a consistency test are approved.
- **FR-014:** The user can mark image regions or attributes for targeted correction without replacing the approved source version until the correction is accepted.

### Script, voice, and audio

- **FR-015:** Script dialogue remains line-addressable and linked to speaker, delivery, scene, shot, and subtitle text.
- **FR-016:** The user can design a synthetic voice or register a consented reference voice, approve a voice identity pack, and lock it to a character.
- **FR-017:** Qwen3-TTS generation is performed line by line or in small controlled batches, with reusable voice conditioning, emotion/delivery controls, pronunciation overrides, and retakes.
- **FR-018:** The studio preserves approved audio exactly when sending it to audio-driven LTX video generation and records any later mix processing separately.
- **FR-019:** Captions are generated from the approved script and timing data, not invented by speech recognition, while timing can be corrected after the final voice take.

### Storyboard and shot planning

- **FR-020:** The studio converts upstream storyboard intent into an engine-neutral shot plan; vendor-specific H3 prompts are preserved as source material but are not the canonical LTX contract.
- **FR-021:** Each planned shot chooses a production method: held frame, pan/zoom/parallax, loop, LTX image-to-video, LTX audio-to-video, LTX keyframe interpolation, LTX retake, LTX lip-dub, or manual/external.
- **FR-022:** Each shot records duration, frame rate, aspect ratio, framing, camera intent, action, dialogue/audio, references, continuity requirements, and acceptance notes.
- **FR-023:** The system prevents bulk generation while required references, audio, approvals, budget, or continuity data are missing.

### GPU and job automation

- **FR-024:** A one-time cloud setup wizard validates the RunPod account, API credential, storage, worker template, budget defaults, and a no-cost or minimum-cost health check.
- **FR-025:** Pressing `Generate` can create a compatible temporary worker, wait for readiness, transfer inputs, execute jobs, download and verify outputs, record cost, and terminate the worker without terminal use.
- **FR-026:** The cloud lifecycle has independent local and remote watchdogs so loss of the desktop application or internet connection cannot leave a worker running indefinitely.
- **FR-027:** Every paid batch requires an estimate, maximum budget, maximum runtime, idle timeout, worker-count limit, and a visible `Stop now` control.
- **FR-028:** Jobs are durable, resumable, idempotent, cancellable where safe, retry-limited, and never considered complete before output integrity is verified locally.
- **FR-029:** The scheduler can use one to three workers for independent shots and explains that concurrency reduces elapsed time but normally does not reduce total GPU-hours.
- **FR-030:** The scheduler groups compatible jobs to reduce model reloads and refuses a GPU whose verified VRAM/capabilities do not meet the workflow requirement.

### Review, edit, and delivery

- **FR-031:** The user can compare takes side by side with prompt, references, runtime, cost, and notes hidden by default but available on demand.
- **FR-032:** A take can be approved, rejected, held for review, or sent for a targeted retake without losing its history.
- **FR-033:** The studio assembles approved media into a deterministic rough cut with dialogue, ambience, effects, music placeholders, transitions, and captions.
- **FR-034:** The studio runs technical QC for missing media, duration mismatch, invalid format, resolution/frame-rate mismatch, clipping, silence, black/frozen frames, and audio/video synchronization.
- **FR-035:** Final export produces a YouTube-ready MP4 and caption file plus a production manifest, QC report, and the inputs required by the versioned release-package workflow.
- **FR-036:** The studio can export an editable interchange package for a supported external editor without making that editor mandatory for basic delivery.

### Cost, history, and maintenance

- **FR-037:** The studio forecasts and records compute, persistent storage, retries, discarded takes, and cost per approved second, shot, episode, and project.
- **FR-038:** Estimates use measured workflow benchmarks from the creator's own pilot runs and visibly distinguish estimates from actual charges.
- **FR-039:** Every output has a production manifest containing upstream commit, schema versions, model identifiers/checksums, workflow versions, source hashes, parameters, seed, timings, hardware class, and lineage.
- **FR-040:** The studio supports verified backup and restore of project metadata and creative assets without requiring remote GPU availability.
- **FR-041:** Upstream skill updates are previewed, compatibility-tested, accepted explicitly, documented, and reversible.
- **FR-042:** Model and workflow updates are treated like schema changes: benchmarked on a locked test pack before becoming the default for new work.
- **FR-043:** Rights and consent metadata can be attached to voices, likeness references, music, effects, fonts, and imported assets; release checks flag missing evidence.

### Writing providers and external skills

- **FR-044:** The user can add, test, replace, disable, and remove OpenAI, Anthropic, and Google Gemini API credentials through protected settings, then choose from the release-controlled stable model catalogue and save a writing provider/model profile without exposing keys to the renderer, projects, skills, logs, or exports.
- **FR-045:** Story development, character development, world building, outlines, scripts, rewrites, and continuity checks use a provider-neutral writing contract. Canonical creative facts are validated and stored locally; every generated draft records provider, model, settings, source versions, token usage, estimated/actual API cost, and lineage.
- **FR-046:** The user can inspect, install, enable, disable, update, and remove external creative skills whose manifest declares identity, version, source, checksum/signature status, task kinds, instructions entrypoint, input/output schemas, permissions, compatibility, and whether the skill is optional or required.
- **FR-047:** Before a writing or planning job runs, the studio creates a visible skill plan from the task and enabled compatible skills. A required applicable skill cannot be silently skipped; successful output records immutable skill execution receipts and displays `Skills used` with exact versions.
- **FR-048:** Skill failure, timeout, invalid output, missing permission, or incompatibility blocks required-skill completion and offers a safe retry, disable, or explicitly approved fallback. Skills cannot directly read credentials, arbitrary projects, or run executable code by default.

### In-application media viewing

- **FR-049:** Generated images, audio, and videos are downloaded, integrity-checked, indexed, and viewable inside the studio through galleries and native media players; the normal workflow never requires opening ComfyUI or a cloud console.
- **FR-050:** The studio shows bounded progress/previews during generation and creates local thumbnails/proxies for responsive review while preserving original media unchanged. Image/video comparison, zoom, playback, frame/time navigation, captions, audio, approval, rejection, and retake actions retain lineage.
- **FR-051:** The user can create an intentional character-style or redesign version and apply it to one shot, scene, episode, season, or future project work. The studio preserves prior bindings/outputs, separates identity from rendering style/wardrobe/story state, requires a new consistency board, and previews affected assets, stale work, and estimated regeneration cost before rebinding or generating.

### Rich previsualization, control, sound, and adaptation

- **FR-052:** The studio creates a versioned timed animatic from storyboard frames, shot durations, approved dialogue or explicitly labelled temporary audio, captions, and simple editorial motion. The creator can review pacing and revise shot timing before bulk video generation without losing earlier animatic versions.
- **FR-053:** A shot can bind a versioned engine-neutral control pack containing any supported combination of start/end frames, pose skeletons, depth maps, edge maps, segmentation maps, region masks, motion tracks, and rights-cleared reference clips. Every control asset records source, hash, scope, rights, and lineage; an engine adapter uses only controls declared compatible with its pinned workflow.
- **FR-054:** The studio can import or create approved layer-separated foreground, subject, and background assets with masks, occlusion order, camera-safe margins, and deterministic composite instructions for parallax or limited 2D animation. Derived layers never replace the approved source image.
- **FR-055:** The LTX adapter can expose benchmark-approved advanced profiles—including reference-video/IC-LoRA control, motion tracks, structural control, in/outpainting, relighting, native multishot, diffusion-fidelity rendering, and temporal upsampling—only when the exact model, adapter, node, and workflow combination is present in the compatibility matrix. Unsupported or cross-version combinations are blocked rather than substituted.
- **FR-056:** The studio runs creative-assist checks for identity drift, palette/wardrobe/prop mismatch, temporal flicker, suspicious motion/freezes, face/hand/text defects, mouth/audio timing, and approved-script-versus-speech mismatch. Results are explainable warnings with confidence and evidence frames/times; they cannot approve, reject, or release a take without human review.
- **FR-057:** The studio can import or generate versioned ambience, synchronized effects, and foley through a rights-aware audio-effects contract. Dialogue masters remain separate and immutable, generated sound never silently replaces speech or music, and every source/model/prompt/reference has lineage and compatibility evidence.
- **FR-058:** For a long-running project that fails the locked reference-only consistency benchmark, the creator can explicitly authorize a project-scoped character or style adaptation such as a LoRA. Training data, rights, captions/tags, base model, settings, cost, output hash, evaluation, scope, and rollback are recorded; the adaptation is promoted only if it beats the prior workflow without unacceptable regression.

### YouTube release packaging and learning

- **FR-059:** The user can create and version channel release profiles containing audience, language, region/timezone, channel promise, packaging voice/visual direction, CTA/credit blocks, blocked claims/topics, category, playlist conventions, and permitted projects. A source-labelled Idea Library records project/profile scope, rationale, duplicate similarity, continuity conflicts, and editorial status; trend or competitor signals remain suggestions and cannot create an episode or paid job silently.
- **FR-060:** The Thumbnail Room can create, import, edit, preview, compare, version, and select public-facing thumbnail candidates from approved frames/references or an explicitly authorized illustration. Final typography/layout is deterministic, candidate lineage/rights/cost are retained, platform dimensions/format/size and small-card readability are validated, and misleading imagery or character/style drift blocks release lock until reviewed.
- **FR-061:** The Release Details workspace creates editable title candidates, description, timeline-derived chapters, caption/language fields, credits/links, category, tags/hashtags, playlist/episode placement, and end-screen/card notes. Deterministic validation and claim evidence replace a misleading universal `SEO score`; no AI draft becomes selected metadata without human review.
- **FR-062:** Release lock requires explicit human attestations for child-directed audience status, applicable altered/synthetic-media disclosure, metadata/thumbnail truthfulness, originality/non-template review, complete rights/credits, and full master/package review. The studio may explain current platform guidance but cannot default or decide these declarations for the creator.
- **FR-063:** The studio creates an immutable, hash-inventoried release-package version containing the master, captions, selected thumbnail, candidate history, copy-ready release details, chapters, credits/rights, audience/disclosure record, QC/upload checklist, and production/package manifests. Any changed master or release field creates a new version; version 1 never publishes it automatically.
- **FR-064:** After manual upload, the creator can attach a YouTube video ID/URL and import time-windowed performance evidence from a supported report file or an optional least-privilege read-only connector. Every snapshot states its source, time window, collection time, metric definitions/version, missing-data warnings, and real/imported/rehearsal status; simulated data is excluded from baselines.
- **FR-065:** The studio can propose evidence-backed packaging or editorial learnings using comparable releases within the same channel/profile. A recommendation lists its evidence, inference, confidence, and proposed scope and remains inactive until a human approves it; it cannot rewrite locked creative facts, switch live metadata, regenerate media, or trigger spend automatically.
- **FR-066:** A single Prepared Studio and Release Readiness view aggregates prerequisite, provider, worker, media, recovery, package, rights, and policy checks with safe remediation. Paid probes are separately identified and opt-in; a stale or failed blocking result prevents the affected action without disabling unrelated local work.

### Audience and creative direction

- **FR-067:** Every new series or film records a project-local Audience & Creative Direction profile containing target audience, creative age band, primary niche, genres, tone, themes, viewer/story promise, cultural setting, content boundaries, episode/film format, YouTube positioning, visual-style notes, comparable-title direction, and differentiation. Each revision is immutable and project-isolated; later writing and production jobs pin the exact selected profile version/hash. Revising it creates an impact preview rather than silently rewriting approved work. The creative age band and positioning cannot complete child-directed, synthetic-media, originality, rights, or truthfulness attestations, and comparable titles cannot authorize imitation.

### Guided form validation

- **FR-068:** Every required user-entry field displays a visible asterisk, its minimum or allowed range, and a live plain-language state. A primary action remains available unless work is actually running or the action is intrinsically unavailable. If the creator tries to continue with missing, short, invalid, or unconfirmed information, the studio opens an accessible summary that names every correction and states whether anything was submitted, charged, or started. Client guidance supplements rather than replaces contract validation at the trusted process boundary.

### Project-aware field assistance

- **FR-069:** Creative and planning workspaces offer an in-place idea assistant for applicable audience/direction, story, character, relationship, world, location, prop, visual style, voice, storyboard, movement, control, sound/foley, generation, edit, thumbnail, release-profile, Idea Library, metadata, and evidence-analysis text fields. Before each potentially paid text request, the creator sees the selected provider/model, exact project-context preview, applicable skill plan, and confirmation. The result is stored as a project-scoped proposal with lineage and changes a field only after the creator chooses a suggestion. AI assistance cannot enter or decide credentials, cost limits, measured performance values, exact source transcripts, approvals, canon, rights/consent, audience/disclosure/truth/originality attestations, worker starts, or publishing actions; those fields may receive explanation-only guidance where safe.

## 7. Non-functional requirements

- **NFR-001 Usability:** After initial installation, the primary workflow must require no terminal, Docker command, SSH session, ComfyUI graph editing, or manual cloud console operation.
- **NFR-002 Safety:** No destructive action, paid bulk action, upstream update, or migration occurs without a preview and explicit scope.
- **NFR-003 Reliability:** A desktop crash, worker crash, network interruption, or provider timeout must leave the project recoverable from the last durable job state.
- **NFR-004 Reproducibility:** Approved takes must retain enough immutable information to determine exactly how they were made, subject to external model availability.
- **NFR-005 Security:** Secrets are stored in the operating-system credential vault, ComfyUI is not publicly exposed, and worker access uses short-lived authentication.
- **NFR-006 Privacy:** Project files are sent only to the selected worker/provider for the selected job; remote temporary inputs and outputs follow a documented cleanup policy.
- **NFR-007 Portability:** Projects export as documented folders plus open JSON/media formats; the SQLite index must be rebuildable from project manifests.
- **NFR-008 Maintainability:** Upstream skills, image engines, video engines, TTS engines, and GPU providers are separated behind versioned adapters.
- **NFR-009 Observability:** Every job exposes state, timestamps, retry reason, worker identity, runtime, estimated and actual cost, and logs with secrets redacted.
- **NFR-010 Performance:** The UI remains responsive while jobs run; generation is asynchronous; large media transfer is resumable where the provider supports it.
- **NFR-011 Accessibility:** Primary actions are keyboard reachable, status is not conveyed by color alone, and error messages state what happened and the safe next action.
- **NFR-012 Documentation:** Every behavior, fix, migration, external assumption, and release status change updates the affected documents and tests in the same change.
- **NFR-013 Compatibility:** A production release supports the currently documented Windows version, pinned upstream commit, worker image, workflow pack, and model set as one tested compatibility matrix.
- **NFR-014 Budget enforcement:** The remote watchdog must terminate compute at the hard session limit even when the desktop cannot be reached.
- **NFR-015 Provider neutrality:** A writing-provider or model change cannot rewrite canonical creative data or make an existing project unreadable; provider-specific state is replaceable and versioned.
- **NFR-016 Skill safety and proof:** External skills are least-privilege, project-scoped, version-pinned, auditable, timeout-bounded, output-validated, and cannot be represented as used without an execution receipt.
- **NFR-017 Media review:** Completed media remains locally reviewable without an active GPU or ComfyUI session, and preview/proxy failure cannot corrupt or replace an original.
- **NFR-018 Immutable production runtime:** A production worker cannot install or update ComfyUI, custom nodes, Python/CUDA dependencies, models, LoRAs, or workflows while executing an authorized session. Changes occur only through a separately built, scanned, benchmarked, pinned, and rollback-capable worker release.
- **NFR-019 Human creative authority:** Automated creative, identity, speech, motion, and synchronization checks assist review but cannot create an approval, lock, release waiver, or destructive correction. The creator sees the evidence and makes the final decision.
- **NFR-020 Platform-policy safety:** Platform rules, limits, fields, metric definitions, and disclosure guidance are versioned external assumptions and revalidated before release changes. The application never hardcodes a legal/policy declaration, stuffs irrelevant keywords, presents a local candidate comparison as a live audience test, or promises ranking/monetization.
- **NFR-021 Analytics integrity:** Performance evidence is project/profile scoped, time-windowed, source-labelled, immutable after capture, comparable only under stated rules, and separated from recommendations. Missing, simulated, or low-sample data cannot be presented as a reliable result or silently influence generation.
- **NFR-022 Validation clarity:** A creator must never have to infer a hidden field rule from an unexplained grey action. Required markers, inline constraints, invalid-state styling, keyboard-focusable summaries, and safe-next-action wording remain understandable without technical knowledge or color perception.

## 8. Release success criteria

Version 1 is production-ready only when all of the following are demonstrated:

1. A non-technical user installs and completes cloud setup with guided screens.
2. The user produces a 60–90 second end-to-end pilot without terminal intervention.
3. The user then produces a representative multi-scene pilot containing recurring characters, at least two voices, two locations, dialogue, non-dialogue motion, captions, sound, and a targeted retake.
4. No character, voice, or project asset crosses into another project without an explicit copy.
5. Disconnecting the desktop during a paid job still results in bounded worker termination and recoverable job state.
6. Restoring from backup reproduces project state and approved-asset lineage.
7. Every paid generation has a cost entry and every approved take has a complete manifest.
8. The cost forecast for the representative pilot falls within ±25% of measured compute cost after benchmark calibration.
9. The final file passes the documented technical export checks.
10. The selected thumbnail, release details, timeline-derived chapters, rights/credits, audience/disclosure decisions, and upload checklist form one verified release-package version.
11. A second series or a one-off film cannot inherit the wrong release profile, thumbnail, metadata, analytics, or learning without an explicit binding/copy.
12. All acceptance tests in `TEST_PLAN.md`, documentation checks, and release gates pass.

Producing a full 20–35 minute episode is the final production-validation gate, not the first test of the system.

## 9. Product metrics

- Setup completion rate without technical assistance.
- Median user actions from approved shot to queued job.
- Percentage of jobs recovered after forced interruption.
- First-pass approval rate by workflow and shot type.
- Average attempts and GPU cost per approved second.
- Continuity defects per finished minute.
- Lip-sync retake rate for speaking close-ups.
- Percentage of idle sessions terminated within the configured timeout.
- Percentage of outputs with complete manifests.
- Percentage of locked release packages passing metadata, chapter, thumbnail, rights, and policy validation without rework.
- Post-release watch-time/retention and packaging evidence by comparable profile and format, shown as observations rather than universal targets.
- Percentage of analytics recommendations explicitly approved, rejected, or left unresolved by the creator.
- Percentage of code changes passing documentation traceability checks.

Metrics inform workflow changes; they are not permission to weaken creative approval gates silently.

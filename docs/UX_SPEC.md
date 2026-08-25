# Non-technical user experience specification

Current implementation note (0.10.1): Creator Mode is the default project experience. A creator supplies an idea or script, reviews AI-prepared stages, and sees one next unfinished decision without configuring technical rooms. The complete story-package → references → frames → voices → shots → local edit/captions → verified-master → worker-cleanup run is available under one disclosure and is derived from durable canon, media, job, timeline, and worker state. Image, video, audio, composition, and local assembly are a collapsed secondary asset/repair path rather than the primary navigation. Productions, Review, Edit & Export, and Settings remain primary navigation; Story, World & Cast, Storyboard, and Generate controls appear only when Advanced Studio is enabled or a guided handoff needs them. Media is viewed inside the app; ComfyUI is headless. Paid start remains visibly locked until qualification, with exact input, estimate, approval, and separate start guidance. See [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md).

## 1. Experience goal

The creator should feel that they are operating a production studio, not administering AI infrastructure. Normal screens use story language—character, scene, voice, shot, take, approve, cost—not model nodes, ports, containers, or command lines.

The UI does not hide consequences. Before a paid or destructive action it explains scope, estimated spend, affected work, and the recovery path in plain language.

### Current implementation — version 0.10.1

The production library, guided series/film wizard, overview, Story, World & Cast, Storyboard, Generate, Review, Edit & Export, Release, Settings, backup/recovery, protected providers, and declarative skills are wired to production services. Proposals remain separate from canon; generated/imported media remains separate from approval. Creator Mode keeps one next step and one primary action visible, while its complete eight-checkpoint production run, earlier creative stages, and one-off asset tools remain collapsed by default. The Ofibox reference affects this output-first workflow only; the app retains its own studio visual system and vocabulary. A reusable single-column assistant supplies reviewable ideas beside applicable text fields, uses the saved provider/profile automatically, and keeps exact context and skill previews under one optional disclosure. Generate shows input order, compatible memory, expected/hard maximum, cost confirmation, and a separate start confirmation. Exact remote candidates remain visibly locked until the worker qualification receipt exists. The creator reviews media and finishes locally without opening ComfyUI or a terminal. Local control/layer/dataset roles, exact control/foley/adaptation candidates, a rights-reviewed adaptation dataset builder, structured performance/learning records, and checked official-report CSV import exist; higher-risk executable/MCP skills, live advanced-engine qualification, optional read-only OAuth, and automatic publishing remain absent.

### Shared field and warning behavior

- Every required field has a visible red `*`; the control also uses native required semantics for assistive technology.
- Text fields show the minimum before typing, the exact remaining count when short, and the current/maximum count after the minimum is met. Number fields show the allowed range.
- Missing or invalid controls receive a non-color-only warning message and invalid-state border.
- Pressing the primary action with unresolved information opens one keyboard-focusable popup listing all corrections. The popup states that nothing was submitted or charged; RunPod setup wording also makes clear that no GPU was rented.
- Primary actions are disabled only while that action is already running or where the action is genuinely unavailable. Busy-state disabling still prevents duplicate requests.
- Closing the popup returns the creator to the unchanged form. Trusted main-process and domain validation still run when valid-looking data is submitted; renderer guidance is not a security boundary.

### Creator questions and production handoff

- Continuity questions are presented as creative decisions, never as unexplained warnings. Each question has a plain-language answer field and **Let AI recommend** option. Every question must receive one of those responses before Creator Mode can prepare a revision request.
- Preparing question answers only fills the visible change request. The creator must still review it, use the clearly labelled potentially billed **Create** action, review the revised proposal, and explicitly approve its exact fingerprint before canon changes.
- The production handoff sends the creator to Settings only while the RunPod account or spending defaults genuinely need creator action. Once both are complete, the creator stays in Creator Mode and sees which model-storage, worker, and shutdown checks remain studio-managed.
- A locked studio-managed check says explicitly that the creator should not create a Pod. It cannot be bypassed by navigating between Creator Mode and Settings.
- Informational readiness popups say **Production status**, describe what remains, and close with **Close**. They do not use “please correct” or “go back and fix” when the creator has completed every creator-owned step.

## 2. Navigation

Default navigation:

1. **Productions** — the local series/film library and the selected production's safety overview.
2. **Create** — Creator Mode: one progress path, the next useful AI-assisted stage, its proposal review, and production exceptions.
3. **Review** — approved and candidate images, voice lines, video takes, and retakes.
4. **Edit & Export** — timeline, sound, captions, QC, thumbnail, release decisions, and local YouTube package.
5. **Settings** — protected writing/RunPod connections, spending limits, skills, backups, and diagnostics.

**Advanced Studio** is a visible optional toggle for Story controls, World & Cast controls, Storyboard controls, and Generation controls. Turning it off while an advanced room is open returns to Creator Mode. The guided path may open the exact advanced room needed for a production exception, but it never requires the creator to understand the room's internal architecture before starting a project.

Inside **Create**, the creator sees the current creative approval and may expand **View the complete production run** to inspect all eight durable checkpoints. Each checkpoint states approved, next review, or waiting in text as well as color. Reopening the project derives the first unfinished checkpoint from saved evidence. The collapsed **Create or repair one production asset** tool offers Image, Video, Audio, Composition, and Assemble only after their approved prerequisites exist. Preparing one remote asset opens the existing job screen with its name, direction, and intended output type prefilled; it does not request an estimate, approve cost, or start a GPU. Assemble opens local Edit & Export and uses no rented GPU.

The currently open project and production unit are always visible. Switching projects requires an explicit action so the user does not unknowingly work in the wrong series.

## 3. First-run setup

### Step 1: Welcome

Explain in one page:

- Creative work stays on this computer.
- A rented GPU is created only when generation is requested.
- Compute stops when the worker is terminated; persistent model storage has a separate small charge.
- The first target is a short pilot, not a full season.

### Step 2: Storage

- Choose a local project folder.
- Check free space and write permissions.
- Choose or postpone a backup location.
- Explain approximate local media growth without pretending to know final size.

### Step 3: Cloud account

- Link to provider account creation.
- Accept the API key into a masked field.
- Store it in the operating-system credential vault.
- Test account access without displaying or saving the key in logs.
- Show that a key needs at least 20 characters before the free check; a short-key warning makes no provider call and rents no GPU.

### Step 3b: Writing accounts (optional until creative assistance is requested)

- Offer separate **OpenAI**, **Anthropic**, and **Google Gemini** cards with `Connect`, `Test`, `Replace`, `Disable`, and `Remove` actions.
- Explain plainly: “These services charge separately for text usage. They are not covered by your RunPod GPU balance.”
- Accept each key in a masked field and return only opaque connected/error status after the main process stores it with OS protection.
- Let the creator choose a default `Balanced`, `Best draft`, or later benchmarked custom writing profile, while keeping a provider/model selector available per task.
- Both first adapters use a no-cost model-list check. Any future provider that cannot do so must show the smallest test's maximum token/cost before approval.
- Show that each key needs at least 20 characters; a short-key warning makes no provider request.

### Step 4: Spending guardrails

- Default hard session budget.
- Default maximum runtime.
- Idle termination delay.
- Maximum simultaneous GPUs, initially one.
- Confirmation rule for batches over the normal amount.

### Step 5: Prepared studio check

The setup creates or verifies the provider template, persistent model cache, worker image, and compatibility. Show checks as:

- Cloud account connected.
- Model storage ready.
- Studio image available.
- Automatic shutdown tested.
- Ready for a small test generation.

Technical details are available under `Show details` but are never the only explanation.

## 4. Project creation

### Default quick start

The first action is **Start a production**. The default dialog asks only:

- whether the creator has a story idea or an existing script;
- series or one-off film;
- optional title;
- primary language; and
- the story description or pasted/uploaded text script.

Required values show asterisks and live minimum guidance. Story/script text accepts up to 60,000 characters so the later protected context still has room for production settings and approved canon. TXT, Markdown, Fountain, and text-based FDX files can be loaded locally; upload here means reading the local file, not sending it to a service. A missing/short source or language opens the same accessible correction summary used elsewhere. Creating the project stores it locally, infers safe placeholder direction for later AI review, keeps the GPU off, and makes no provider call. If no title is supplied, the studio derives a working title from the opening sentence.

After creation, Creator Mode derives this review path from durable project state:

1. story production plan;
2. complete cast and world/location book;
3. timed production screenplay;
4. shot-by-shot storyboard plan;
5. animation look and original voice/performance book;
6. character/style, voice, motion/lip-sync proofs and approved master; and
7. truthful YouTube release plan and final package checks.

For text stages the studio automatically supplies the original idea/script, production settings, active creative-direction revision, all active approved canon, and applicable enabled skills. It selects the saved connected model first and may try declared connected fallbacks only after the creator approves wording that explains multiple text requests may be billed. A result is visibly **AI proposal · not canon**. The creator can request changes or approve the exact fingerprinted proposal; approval creates a new canon revision and advances to the next missing stage. Revisiting an earlier stage creates a revision rather than overwriting history.

At visual/audio production, the default card shows the small-proof sequence and whether worker setup is protected, existing media needs review, or a job needs attention. Opening setup or an estimate does not rent a GPU. Cost approval and worker start remain separate.

### Detailed setup (optional)

**Use detailed setup instead** opens the original six-screen wizard for creators who want to define every initial field before AI planning.

### Screen 1: What are you making?

- `Series` — seasons and episodes.
- `One-off film` — sequences and scenes.

### Screen 2: Identity

- Title and working code.
- Target episode/film duration.

### Screen 3: Audience

- Who the production is for, in plain language.
- Creative age band, with a warning that this does not answer YouTube's made-for-kids question.
- Primary niche, genres/subgenres, and cultural/story setting.

### Screen 4: Creative direction

- Viewer/story promise, tone words, themes, and episode/film format.
- Content boundaries, visual-style notes, and truthful YouTube positioning.
- Optional comparable titles as directional references plus how this work will be different; copying is not authorized.

### Screen 5: Starting point

- Import a novel/source document.
- Import existing upstream JSON/reports.
- Start from an original idea.
- Import an existing studio project.

The current slice records any selected starting-point intent, but it does not run an import. **Start from an idea** is immediately usable; all import paths remain planned and are labelled as such.

### Screen 6: Review and create

- Review project type, identity, audience, niche, genre, and viewer promise.
- Create the project and direction locally; no API call, GPU, or charge occurs.

The project overview provides **Revise direction**. Saving appends a new revision and says clearly that earlier proposals, approved work, and policy answers do not change. A future impact screen will identify dependent work before any rebinding or regeneration.

### Later pilot definition

Choose a representative 30–90 second scene containing the hardest expected elements: recurring character, dialogue, movement, location, and camera. The app explains that approving this test protects the larger budget.

## 5. Bible-room experience

Each character/location/style/voice uses the same pattern:

1. Facts and creative brief.
2. Generated candidates.
3. Side-by-side comparison.
4. Required consistency checks.
5. Approval note.
6. Lock version.

The page displays `Draft`, `Approved`, `Locked`, or `Stale` clearly. A lock button explains which downstream work will rely on it.

Changing a lock opens an impact preview:

> “This creates Character Maya version 4. Version 3 remains unchanged. Seven storyboard frames, three voice-driven shots, and one approved episode currently use version 3. Nothing will be regenerated automatically.”

Choices are `Create new version`, `Cancel`, and—only where safe—`Create and review impact`.

### Creative Room and attached skills

Story, character, world, episode, scene, dialogue, and continuity assistants share one non-technical pattern:

1. Select the exact local facts/versions the assistant may use; the active Audience & Creative Direction profile is visible and selected by default.
2. Choose the writing profile or keep the project default.
3. Preview **Skills planned**: required, optional, incompatible, and why each matched.
4. Preview estimated text-service usage/cost where available, then generate a draft.
5. Compare the proposal with the current version; accept selected changes rather than silently overwriting.
6. Show **Skills used** with exact versions and expandable execution receipts.

The Skills settings page shows source, publisher, version, task types, requested permissions, signature/checksum state, update impact, and `Enable for this project`. Installation never enables a skill globally without an explicit choice. If a required skill fails or is ignored, the result is visibly blocked; the app offers retry, compatible-version selection, or a clearly explained plan change instead of pretending the skill ran.

Version 0.8.0 implements this pattern for declarative JSON writing skills. `Install skill file` opens the Windows file picker; the app explains that nothing in the package is executed. Each card shows the self-declared publisher/source, unverified/verified signature state, short package fingerprint, matching tasks, requested context, compatibility, and a checkbox for each existing production. Updating to a new version clears every project checkbox. Removal uses a second confirmation and retains historical proposal receipts. The Creative Room refreshes its exact plan when the task changes, refuses a stale or blocked plan, and shows successful/failed receipts on the saved proposal. Higher-risk skill classes remain absent rather than appearing disabled without explanation.

### Project-aware help beside creative fields

Version 0.10.1 reuses the Creative Room's governed path as a compact modal assistant beside creative-direction, cast/world, storyboard, generation, edit/sound, thumbnail, release-profile, Idea Library, metadata, and evidence-analysis text groups:

1. Choose the field when more than one applies, then describe the wanted result in one text box.
2. The saved controlled provider/model is selected automatically and summarized in plain language; changing it remains a Settings action.
3. **What will be shared** contains the selected provider/model, a friendly context summary, matching skills, and a nested exact-text preview without forcing raw canon into the main surface.
4. The **Generate suggestion** or **Explain this decision** button is the explicit approval for one potentially billed text request and states that no GPU starts. There is no second checkbox for the same request.
5. While waiting, the same surface explains that long context can take a few minutes. A completed result replaces the request form, with the best answer first and details/alternatives collapsed.
6. The creator deliberately chooses the best answer or an alternative to place in the unsaved field, then edits and saves through the field's normal validation and approval boundary.

The assistant never auto-saves and cannot write secrets, cost limits, measured metrics, exact reference transcripts, canon, approvals, rights/consent, made-for-kids/synthetic/truth/originality/full-watch decisions, GPU starts, or publishing. A human-only target may ask the model to explain considerations but exposes no **Use** action.

### Writing-request timing and recovery

- Provider model-list/connection checks remain bounded to 30 seconds so setup failures return promptly.
- Confirmed structured writing requests use a separate five-minute ceiling because project context, schema-constrained output, and model reasoning can legitimately take longer than a connection check.
- Short Gemini field suggestions request low thinking; longer production stages request medium thinking. Both remain schema-validated proposals.
- A timeout saves no proposal and changes no local field or canon. The creator can retry the unchanged request; the app does not hide an automatic paid retry.

### Changing a character's visual style

The character page provides **Create style/redesign version**. It asks what is changing—rendering style, proportions, age/story state, wardrobe, hair/details, or a complete approved redesign—and where it applies:

- This shot only.
- This scene.
- This episode.
- This season.
- Future work from a selected episode/season onward.

The app keeps the identity record and old versions, generates a new multi-view/expression/wardrobe board from approved identity anchors, and runs consistency checks before the new look can be locked. An A/B impact preview lists existing frames, boards, shots, voices, and exports; voice/personality remain unchanged unless separately edited. The confirmation shows what will become stale, what can stay, and an estimated regeneration cost. Nothing already published or approved is silently restyled.

## 6. Storyboard experience

The storyboard shows one card per shot:

- Keyframe/reference image.
- Story purpose.
- Who/what is on screen.
- Dialogue or audio.
- Duration and camera intent.
- Production method.
- Required locks and warnings.
- Estimated generation difficulty.

The user can switch between visual board, scene list, and continuity table. ComfyUI workflow fields are absent from the default view.

The app recommends inexpensive production methods where valid:

- `Hold with gentle camera move`.
- `Reuse approved loop`.
- `Animate with LTX`.
- `Animate to approved voice`.
- `Retake only this section`.

Recommendations never silently change story or approval state.

### Timed animatic

The creator selects **Build pacing preview** after storyboard frames and dialogue timing are available. The studio assembles a low-cost animatic with shot order, captions, approved dialogue or visibly labelled temporary audio, and simple hold/pan/zoom/parallax motion.

The screen shows total duration, scene/shot timing, dialogue overruns, silent gaps, missing coverage, and versions affected by a timing change. Actions are **Approve timing**, **Adjust shot**, **Return to script**, and **Create new animatic version**. Animatic approval does not approve final video.

### Shot control panel

The default panel uses plain choices:

- Start image and optional end image.
- Character pose or body direction.
- Foreground/background depth.
- Area that may change or must remain fixed.
- Object/character movement path.
- Reference motion clip.
- Layered parallax.

The UI creates or imports the underlying pose/depth/edge/segmentation/mask/motion assets and previews them over the shot. It shows unsupported combinations before cost approval. Numerical node strengths and ComfyUI graph fields remain in an optional expert drawer.

The current version implements import/review media roles and ordered manifest validation in Generate. Overlay preview, coordinate/time-basis editing, automatic control derivation, and the expert strength editor remain future depth; the text assistant can help plan which controls are needed but cannot fabricate an approved control asset.

## 7. Generate screen

Before a batch starts, show:

```text
Ready shots:             18
Expected attempts:       estimate, not a guarantee
Estimated GPU range:     based on measured pilot data
Hard spending limit:     user-selected
Maximum running GPUs:    1–3
Automatic shutdown:      after queue + sync + idle grace
Missing approvals:       0
Unsupported controls:    0
Animatic timing locked:  yes
```

Primary button: **Start generation**.

Progress messages:

- Looking for a compatible GPU.
- Starting the prepared studio.
- Verifying models and automatic shutdown.
- Generating shot 4 of 18.
- Downloading and checking results.
- No jobs remaining; shutting down GPU.
- GPU terminated; compute billing stopped.

A persistent **Stop GPU now** button explains whether the current partial output may be lost. Emergency stop prioritizes ending spend; the queue remains recoverable.

## 8. Review screen

- Grid or focused view of verified local pending takes; opening ComfyUI is never required.
- Images support fit/actual-size zoom, pan, side-by-side/overlay comparison, and reference toggles.
- Audio supports playback, waveform, transcript/captions, line/version identity, and A/B synchronization.
- Video supports play/pause, volume, scrubbing, frame/time navigation, loop range, captions, full screen, poster frame, and synchronized A/B playback.
- During generation, low-resolution progress previews are labelled `Preview — not downloaded master`; the final take appears only after local integrity and media checks pass.
- A/B comparison synchronized to the same audio and time.
- Plain review tags: identity, movement, framing, continuity, mouth, hands, artifacts, audio, other.
- Assistive warnings may point to identity drift, flicker, unusual motion, dialogue mismatch, or lip timing with evidence frames/times and confidence. They are labelled `Check suggested` and never approve or reject automatically.
- Actions: `Approve`, `Reject`, `Retake`, `Repair mouth`, `Repair section`, `Return to storyboard`.
- Retake form defaults to preserving approved inputs and asks what should change.
- Cost and technical data are in a collapsible panel.
- `Made with` lists provider/model/workflow and exact external skills used without exposing raw keys or technical graphs by default.

Bulk approval is available only for low-risk assets after individual inspection and is never the default for final dialogue close-ups.

## 9. Edit and export

The timeline initially assembles itself from approved shot order. The creator can:

- Trim within safe handles.
- Replace a take.
- Adjust shot duration where the production method permits.
- Move dialogue, ambience, effects, and music levels.
- Generate, import, review, and place independent ambience/foley/effect cues without altering dialogue masters.
- Review captions.
- Insert title/end cards.

Export readiness is a checklist:

- All required shots approved.
- No stale locked dependencies.
- Dialogue and captions complete.
- Rights records complete or explicitly waived with a warning.
- Technical QC passed.
- Final human review signed.

The app creates a video, captions, manifest, and QC report. Public upload remains outside version 1.

## 10. YouTube release room

Release planning can begin before picture lock; locking a package still requires the approved master and all release inputs. The room keeps public packaging separate from story and shot production while retaining exact links to the final episode or film.

The normal flow is:

1. Select or create the current project-local release-profile revision. Cross-project channel-profile reuse remains unavailable until an explicit copy/bind flow exists.
2. Open **Thumbnail Room**, choose approved source frames or an authorized new illustration, compare candidates at large/desktop/phone sizes, and select one. The screen says `Candidate review`, never `A/B test`, unless a real YouTube Test & Compare report has been imported.
3. Open **Release Details** to review title variants, description, timeline-derived chapters, captions/languages, category, playlist placement, credits, links, tags, hashtags, and end-screen notes. The studio shows a factual checklist and truncation previews, not a universal `SEO score`.
4. Complete explicit human questions for audience, altered/synthetic-media disclosure, truthful packaging, originality, rights/credits, and the full-master watch. `Unresolved` blocks the package.
5. Preview **Release Readiness**. It distinguishes missing files, stale versions, technical failures, unresolved human decisions, and optional suggestions.
6. Select **Lock upload package**. The studio writes an immutable, hash-verified folder with the master, selected thumbnail, captions, copy-ready details, chapters, credits/rights, attestations, QC report, checklist, and manifests.
7. Select **Open package folder** and follow the plain-language YouTube Studio checklist. Version 1 does not sign in, paste fields, schedule, or publish for the creator.

After publication, the creator may enter the video ID and a structured metric window copied from an official source, import and select a checked row from a YouTube Analytics CSV, or label a rehearsal. The report path displays only its safe filename and row choices; the trusted process retains its hash without exposing a local path. Missing values stay null with warnings and rehearsal is excluded from baselines. The creator can propose an observation/inference/recommendation citing selected snapshots and explicitly approve or reject it with a reason. A later optional read-only connection remains future work. Lessons are not applied automatically and cannot rewrite a released episode, change YouTube, or start paid generation.

## 11. Error language

Every error answers:

1. What happened?
2. Was money still being spent?
3. Is any work lost?
4. What safe action can the user take now?

Example:

> “The cloud worker stopped responding. Its hard shutdown deadline is still active and will end compute by 14:35. Your project and queued shots are safe locally. We will check whether this worker still exists before starting another one.”

Never show only a stack trace, provider code, or “unknown error.” Expert details can accompany the plain explanation.

## 12. Accessibility and calm operation

- Keyboard access and visible focus for all primary actions.
- Labels in addition to color for status.
- Captions/transcripts for generated audio previews.
- No flashing progress animations.
- Long operations may run in the background with clear notifications.
- Spend notifications are factual, not alarming; hard limits remain prominent.
- A `Pause after current job` control allows a calm stop without abandoning verified work.

## 13. Usability acceptance

A representative non-technical user must be able to:

- Create a project and define a pilot.
- Define an audience/niche/direction for both a series and a one-off film, revise it, and explain why the earlier version and YouTube policy answers did not change.
- Connect the provider using the guided steps.
- Approve a character image and voice.
- Queue and review a shot.
- Confirm the cloud worker terminated.
- Restore a test backup.
- Understand a stale-dependency impact message.
- Connect or skip a writing provider, attach a fixture skill, verify that it was used, and review image/audio/video entirely inside the studio.
- Build and revise a timed animatic, attach a supported motion/control pack, understand an assistive QC warning, and confirm that no warning approved a take automatically.
- Prepare and verify a truthful YouTube upload package, explain every unresolved policy question, and distinguish a local thumbnail comparison from a real platform experiment.

No facilitator may use a terminal or cloud console during the acceptance session.

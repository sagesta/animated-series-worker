# Non-technical user experience specification

## 1. Experience goal

The creator should feel that they are operating a production studio, not administering AI infrastructure. Normal screens use story language—character, scene, voice, shot, take, approve, cost—not model nodes, ports, containers, or command lines.

The UI does not hide consequences. Before a paid or destructive action it explains scope, estimated spend, affected work, and the recovery path in plain language.

### Current implementation — version 0.4.0

The production library, series/film wizard, project overview, navigation, backup/recovery/migration, RunPod setup, and local support flow are implemented. Settings now also provides separate masked OpenAI and Anthropic cards with free model-list validation, independent refresh/disable/enable/remove, and an explicit provider/model/depth preference without claiming a benchmark winner. Story is a working Creative Room for character, world, outline, scene, dialogue, and continuity proposals: it shows exact selected project context, explains the additional instruction/format information, requires a checkbox for one potentially paid text request, and labels the locally saved result “proposal, not canon” with model/token/skill-use lineage. World & Cast, Storyboard, Generate, Review, Edit & Export, Release, canon promotion/version comparison, exact text-dollar quotes, and external skills remain planned/locked. GPU generation remains unavailable.

## 2. Navigation

Primary navigation:

1. **Home** — projects, blocked decisions, active work, spend.
2. **Story** — outline, acts/sequences, scripts, episode status.
3. **World** — style, characters, voices, locations, props, wardrobe.
4. **Storyboard & Animatic** — scenes, shots, timing, production method, control packs, and pacing preview.
5. **Generate** — ready queue, estimates, cloud session.
6. **Review** — images, voice lines, video takes, retakes.
7. **Edit & Export** — timeline, sound, captions, QC, delivery.
8. **Release** — public thumbnail, title, description, chapters, policy review, upload package, and later performance evidence.
9. **Settings** — cloud connection, storage, budgets, backups, optional read-only analytics connection, expert mode.

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

### Step 3b: Writing accounts (optional until creative assistance is requested)

- Offer separate **OpenAI** and **Anthropic** cards with `Connect`, `Test`, `Replace`, `Disable`, and `Remove` actions.
- Explain plainly: “These services charge separately for text usage. They are not covered by your RunPod GPU balance.”
- Accept each key in a masked field and return only opaque connected/error status after the main process stores it with OS protection.
- Let the creator choose a default `Balanced`, `Best draft`, or later benchmarked custom writing profile, while keeping a provider/model selector available per task.
- Both first adapters use a no-cost model-list check. Any future provider that cannot do so must show the smallest test's maximum token/cost before approval.

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

## 4. Project creation wizard

### Screen 1: What are you making?

- `Series` — seasons and episodes.
- `One-off film` — sequences and scenes.

### Screen 2: Creative basics

- Title and working code.
- Primary language.
- Target episode/film duration.
- Aspect ratio and delivery profile.
- Visual direction: 2D, 3D-look, mixed, or undecided.

The visual direction is a style brief, not a claim that a true 3D rig will be created.

### Screen 3: Starting material

- Import a novel/source document.
- Import existing upstream JSON/reports.
- Start from an original idea.
- Import an existing studio project.

### Screen 4: Pilot definition

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

1. Select the exact local facts/versions the assistant may use.
2. Choose the writing profile or keep the project default.
3. Preview **Skills planned**: required, optional, incompatible, and why each matched.
4. Preview estimated text-service usage/cost where available, then generate a draft.
5. Compare the proposal with the current version; accept selected changes rather than silently overwriting.
6. Show **Skills used** with exact versions and expandable execution receipts.

The Skills settings page shows source, publisher, version, task types, requested permissions, signature/checksum state, update impact, and `Enable for this project`. Installation never enables a skill globally without an explicit choice. If a required skill fails or is ignored, the result is visibly blocked; the app offers retry, compatible-version selection, or a clearly explained plan change instead of pretending the skill ran.

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

The Release room opens only when an approved master exists. It keeps public packaging separate from story and shot production while retaining exact links to the final episode or film.

The normal flow is:

1. Select or create the correct versioned channel release profile; a one-off film may use a project-local release brief.
2. Open **Thumbnail Room**, choose approved source frames or an authorized new illustration, compare candidates at large/desktop/phone sizes, and select one. The screen says `Candidate review`, never `A/B test`, unless a real YouTube Test & Compare report has been imported.
3. Open **Release Details** to review title variants, description, timeline-derived chapters, captions/languages, category, playlist placement, credits, links, tags, hashtags, and end-screen notes. The studio shows a factual checklist and truncation previews, not a universal `SEO score`.
4. Complete explicit human questions for audience, altered/synthetic-media disclosure, truthful packaging, originality, rights/credits, and the full-master watch. `Unresolved` blocks the package.
5. Preview **Release Readiness**. It distinguishes missing files, stale versions, technical failures, unresolved human decisions, and optional suggestions.
6. Select **Lock upload package**. The studio writes an immutable, hash-verified folder with the master, selected thumbnail, captions, copy-ready details, chapters, credits/rights, attestations, QC report, checklist, and manifests.
7. Select **Open package folder** and follow the plain-language YouTube Studio checklist. Version 1 does not sign in, paste fields, schedule, or publish for the creator.

After publication, the creator may attach the video URL/ID and import an official report. A later optional read-only connection can collect eligible analytics without permission to edit the channel. Performance observations and proposed lessons show their evidence and confidence; only a human can approve a lesson for future work. They cannot rewrite a released episode or start paid generation.

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

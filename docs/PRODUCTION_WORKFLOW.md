# End-to-end production workflow

Current implementation note (0.10.1): Creator Mode is the default creator-facing workflow. The supplied Ofibox reference informs the workflow sequence, not the interface styling. The app accepts an idea or script, exposes one resumable production run, prepares the next reviewable checkpoint with full approved context, and hands supervised image/audio/video work to the existing local records and governed generation services. A collapsed one-off asset tool covers image, video, audio, composition, and local assembly without replacing the main run. Detailed rooms remain optional. Paid work remains locked until the exact worker passes external qualification. See [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md).

## Default guided path

1. Give the studio a story idea or paste/upload a text script. Choose series or film, optionally name it, and confirm the language. Project creation is local and free.
2. Creator Mode reads durable project state and recommends only the next missing creative approval. For a text stage, it attaches the source, settings, active creative direction, every active approved canon revision, and applicable enabled skills. The clearly labelled Create action confirms the disclosed text request and possible fallback count; no GPU starts.
3. Review each response as a proposal. Request changes or approve that exact fingerprint. Only approval creates a new canon revision and advances the durable run.
4. Complete the approved **story package**: production blueprint, cast, world/locations, timed screenplay, shot-by-shot storyboard, animation look, and original voice/performance direction.
5. Produce and review **character/location references**, then **storyboard frames**, then **voice/dialogue assets**, then short **video shots**. Existing candidates and interrupted jobs remain available for review, retry, or targeted repair.
6. Assemble approved picture, dialogue, ambience/effects/music, and editable captions on a deterministic local timeline. Render and review the delivery-profile master locally.
7. Verify that the master is recovered before the worker lifecycle is considered complete; no active production job or rented GPU may remain after cleanup.
8. Prepare truthful release strategy, complete human audience/disclosure/originality/rights/full-watch decisions, and create the local manual-upload package. Version 1 never publishes automatically.

The collapsed **Create or repair one production asset** path mirrors the useful output-first part of the reference workflow. It prepares one image, video, audio item, composition, or local assembly from already approved prerequisites. A handoff creates no estimate, job, Pod, or charge by itself. Remote work still requires compatible approved inputs, a qualified workflow, exact estimate, maximum-cost approval, and separate worker-start confirmation.

Advanced Studio exposes the original Story, World & Cast, Storyboard, and Generate controls for precise intervention. It does not define separate truth; both experiences use the same proposal, canon, media, job, cost, timeline, and release stores.

## 1. Production shape

The studio uses the same core workflow for a recurring series and a one-off film:

```text
Idea/source
  -> versioned audience and creative direction
  -> story structure
  -> locked world and character bibles
  -> script and line book
  -> engine-neutral storyboard
  -> approved voice and reference assets
  -> timed animatic and shot-control packs
  -> cheap draft tests
  -> selected final generations
  -> review and targeted repair
  -> rough cut, sound, captions, QC
  -> locked master delivery
  -> thumbnail, release details, policy review
  -> versioned manual-upload package
  -> optional evidence-backed learning for future work
```

The difference is organization:

- Series: Project → Season → Episode → Sequence → Scene → Shot.
- Film: Project → Sequence → Scene → Shot.

## 2. Stage gates

| Gate | Must be approved | Why it occurs here |
| --- | --- | --- |
| G0 Project compass | Format plus an exact Audience & Creative Direction revision: audience, niche, genres, tone, themes, promise, setting, boundaries, episode/film shape, visual/public direction, and differentiation | Gives every later stage a consistent brief without treating it as canon or policy authority |
| G1 Story lock | Premise, arc, episode/film structure, major beats | Assets should serve a stable story |
| G2 Bible lock | Style, lead characters, voices, recurring locations/props | Multiplied consistency depends on these |
| G3 Script lock | Scene action, dialogue, line IDs, timing target | Voice and shot timing need stable text |
| G4 Storyboard lock | Shot intent, method, duration, references, continuity | Paid generation must not decide the story accidentally |
| G4A Animatic/control lock | Pacing preview, approved timing, supported control packs, fallback method | Finds coverage/timing/control problems before GPU multiplication |
| G5 Pilot lock | Representative image, voice, dialogue shot, motion shot, measured cost | Proves quality and economics before scale |
| G6 Batch authorization | Ready jobs, estimate, hard cap, worker count | Makes spending explicit |
| G7 Picture/voice lock | Approved takes and final line audio | Edit and captions must have stable sources |
| G8 Master delivery lock | Timeline, sound, captions, rights, technical QC, full human watch | Freezes the exact master and delivery evidence used for packaging |
| G9 Release package lock | Thumbnail, release details, chapters, captions, audience/disclosure/originality/rights attestations, package inventory | Prevents stale or unresolved public packaging from being treated as ready |

Changing an earlier gate creates a new version and an impact report. Later gates do not vanish, but affected items become stale until resolved.

## 3. Stage 0 — define the production

For a series, create and review one project-local Audience & Creative Direction revision:

- Target audience and creative maturity guidance.
- Primary niche, genres, tone, themes, cultural/story setting, and content boundaries.
- Series promise, differentiation, visual direction, and truthful public positioning.
- Season arc and expected episode count.
- Typical 20–35 minute episode structure.
- Visual style and motion budget.
- Recurring cast and locations.
- Language and voice approach.
- Delivery and budget profiles.

For a one-off film, define the same creative constraints with a film-shaped format and sequence-level plan. It does not need fake season metadata.

The creative age band is not a YouTube made-for-kids decision. Comparable titles help explain direction but never authorize copied characters, plots, shots, dialogue, or distinctive visual expression. Revision creates a new profile version and later shows impact; it never overwrites earlier production history.

Select a pilot scene that is difficult enough to be honest. A silent landscape shot alone is not a valid proof for a dialogue-heavy series.

## 4. Stage 1 — story development and upstream import

Creator Mode selects the saved connected OpenAI, Anthropic, or Gemini writing profile automatically and reveals the exact context and skill plan only when requested. The compact field assistant follows the same rule: ask what the creator wants, show the saved model and a plain-language context summary, then keep exact manifest/direction text, hashes, and project-enabled declarative skills under **What will be shared**. The clearly labelled Create or Generate action is the paid-request confirmation; there is no duplicate checkbox. A valid request is schema-validated and saved locally as a schema-3 proposal with provider/model, source versions, token usage, uncalculated dollar cost, exact plan hash, and execution receipts. Connection checks keep a 30-second ceiling, confirmed structured drafts have a separate five-minute ceiling, and no timed-out request is retried invisibly. The provider remains a drafting assistant; only a separate reviewed promotion can create canon.

The same governed path is available beside applicable text fields throughout Direction, World & Cast, Storyboard, Generate, Edit & Export, and Release. It can propose character/world/style/voice/motion/control/foley/thumbnail/release/learning text, but it cannot fill a secret, measurement, exact source transcript, approval, canon fact, rights/policy attestation, cost limit, GPU confirmation, or publishing action. A suggestion remains a saved proposal until the creator deliberately inserts and then saves it through the destination form.

Use the exact selected direction revision with the pinned upstream skills and other enabled compatible skills where they help:

1. Outline and adaptation facts.
2. Character roster and design prompts.
3. Scene and prop art-bible facts.
4. Script scenes, beat flow, dialogue, delivery notes, and line book.
5. Storyboard segment/cut suggestions and shot vocabulary.

The studio copies imported source files unchanged, records the upstream commit, runs upstream validation, and generates a normalization preview. A required skill that fails, times out, produces invalid output, or lacks an execution receipt blocks that creative job until the creator retries or explicitly changes the plan.

Every current writing/idea request records the selected profile version/hash in its exact context snapshot. Future upstream/media compilers must continue pinning it. The adapter does not modify `vendor/shuohao-skills` or assume one storyboard paragraph can fully determine identity, staging, motion, dialogue timing, and engine controls.

For long-form episodes, the creator and studio then organize material into acts/sequences. The upstream short-drama cut cadence is a suggestion, not the final pacing law. The normalized episode may contain longer holds and editorial construction while retaining story evidence and IDs.

## 5. Stage 2 — build and lock the world

### Style bible

Approve:

- 2D, 3D-look, or mixed visual language.
- Shape language, line/texture treatment, color palette.
- Lighting rules and time/weather variants.
- Camera/lens language and movement limits.
- Background complexity and crowd treatment.
- Forbidden traits and negative prompt rules.
- Delivery aspect ratio and safe title/caption areas.

### Character identity pack

For every lead and recurring character:

- Hero portrait and neutral full body.
- Front, side, and back/three-quarter references.
- Expression board and mouth/eye references.
- Key poses and scale comparison.
- Wardrobe versions and signature props.
- Color values and identifying details.
- “Do not change” attributes.
- Test images in at least two locations and with another character.

Functional background characters can use a lighter pack. Leads cannot.

### Location and prop packs

- Empty environment master.
- Important camera directions and scale anchors.
- Day/night/weather/state variants.
- Recurring prop geometry, condition, and story state.

Only accepted versions are available to the bulk-generation planner.

The style bible is developed from the profile's high-level visual direction, but it becomes a separate reviewed record. Changing “2D”, “3D-look”, palette, or rendering language never changes a character's identity or previously approved style binding automatically.

## 6. Stage 3 — voice lock and line production

For each recurring character:

1. Design or register a rights-cleared reference voice.
2. Generate a calibration set: neutral, emotional, quiet, loud, question, fast, names/terms.
3. Approve a reusable voice profile and pronunciation dictionary.
4. Lock the voice version.
5. Generate script lines individually or in small coherent batches.
6. Review delivery and pronunciation; retake only failed lines.
7. Normalize and time approved audio while preserving the original generated master.

The exact approved WAV is the input to an LTX dialogue shot. The video model does not invent a new recurring voice for each clip.

## 7. Stage 4 — engine-neutral storyboard

For every shot decide:

- Narrative job: reveal, reaction, information, movement, mood, transition.
- Composition and camera intent.
- On-screen characters, wardrobe, location, props, and states.
- Dialogue/audio and required lip visibility.
- Duration in frames.
- Continuity from the previous and to the next shot.
- Production method and fallback.
- Approval criteria.
- Optional start/end frame, pose/depth/edge/mask, motion track, layered composite, or rights-cleared motion reference.

The storyboard compiler uses the pinned audience/tone/format/style direction together with the approved script and bibles. It cannot replace locked character references, timed dialogue, staging, or shot-control records with a general prompt.

### Production-method selection

| Situation | Preferred method |
| --- | --- |
| Quiet exposition or reaction | Held image with subtle pan/parallax or loop |
| Reusable ambience | Short approved loop |
| Character movement without dialogue | LTX image-to-video or keyframes |
| Visible speaking close-up | Approved TTS + LTX audio-to-video |
| Existing good clip with a small bad area | LTX retake |
| Good acting but mouth/audio mismatch | LTX lip-dub/repair |
| Precise object/character path | Benchmark-approved LTX motion control |
| Pose/depth/edge-guided action | Benchmark-approved structural-control profile |
| Existing motion should guide a new style/character | Rights-cleared reference-video control |
| 2D shot needing controlled depth | Layered foreground/subject/background parallax |
| High-detail approved motion | Diffusion-fidelity/final upscale profile |
| Complex unsupported action | Split action, redesign shot, or external/manual method |

The fallback is decided before generation, not improvised after unlimited retries.

### Timed animatic and control lock

Before the paid pilot or batch:

1. Assemble storyboard frames, shot durations, captions, and approved dialogue or visibly temporary audio.
2. Review the full scene/episode pacing, missing coverage, dialogue overruns, reaction time, and transition points.
3. Revise script, shot order, or duration through new versions until timing is approved.
4. Build each difficult shot's engine-neutral control pack and preview pose/depth/edge/mask/motion data over the frame.
5. Validate the control roles against the selected pinned workflow and choose a fallback for unsupported combinations.
6. Lock the animatic/timing and control versions used by the pilot. Later changes produce an impact report rather than silently changing queued jobs.

## 8. Stage 5 — pilot and benchmark

Run a locked test pack before bulk production:

- Lead character in several framings and two environments.
- Two-character shot.
- Simple walk/body movement.
- Emotional dialogue close-up.
- Dialogue with a camera move.
- Hand/prop interaction.
- Non-dialogue establishing shot.
- Retake and lip-dub repair.
- Draft and final workflow comparison.
- Timed animatic reconstruction and a deliberate timing revision.
- Pose/depth/edge/mask, motion-track, reference-video, and layered-parallax control samples where the production needs them.
- Diffusion-fidelity and temporal-upsample comparison for one demanding approved shot.
- Creative-assist identity/flicker/motion/lip/script-audio warnings with known positive and negative fixtures.
- Generated/imported foley sample kept separate from dialogue and music.
- Optional adaptation candidate only if the reference-only identity test fails.

Capture runtime, attempts, cost, approval reason, failure class, identity drift, lip quality, and local/remote transfer time. Use the results to set workflow defaults and the episode forecast.

If the pilot fails, revise the bible, shot design, or workflow. Do not proceed by assuming hundreds of generations will average out the problem.

## 9. Stage 6 — batch production

Batch only shots with locked inputs. The recommended daily session:

1. Review `Ready to generate` shots.
2. Confirm estimate, hard cap, and worker count.
3. Start the cloud session.
4. Let the scheduler provision, verify, generate, download, and terminate.
5. Confirm the session says `GPU terminated`.
6. Review verified takes locally inside the studio gallery/player; ComfyUI can already be closing or terminated.
7. Approve, reject, or make targeted retake requests.
8. Review creative-assist warnings as evidence; no warning or score changes approval automatically.

Group work by workflow/model so the GPU does not repeatedly load different large models. Voice lines can be prepared before video batches.

## 10. Stage 7 — editorial construction

The rough cut places approved takes by shot order and frame duration. Then:

- Adjust safe trims and holds.
- Add reaction holds and transitions.
- Layer dialogue, room tone, effects, and music.
- Generate or import synchronized foley/effects only into their own versioned layers; never overwrite dialogue masters.
- Verify dialogue continuity and emotional rhythm.
- Add titles/credits.
- Generate captions from approved line timing.
- Review at normal speed from start to finish.

A 20–35 minute stylized episode is not required to contain 20–35 minutes of unique high-motion generation. Editorially controlled stills, loops, reactions, and audio storytelling are intentional production tools.

## 11. Stage 8 — quality control and delivery

### Automated checks

- Every timeline source exists and matches its manifest hash.
- No stale or unapproved required assets.
- Video dimensions, frame rate, pixel format, color profile, duration, and codecs match delivery.
- Audio streams, sample rate, loudness, peaks, silence, and sync are within profile.
- No unintended black/frozen frame runs or corrupt packets.
- Captions cover required dialogue and stay inside duration.
- Rights records and credits are present where required.

### Human checks

- Story clarity and pacing.
- Character identity, scale, wardrobe, and emotion.
- Location and prop continuity.
- Mouth movement and dialogue performance.
- Hands, interactions, visual artifacts, and unwanted text/logos.
- Music/effects balance and caption readability.
- Full end-to-end watch without relying on thumbnails.

Master delivery outputs:

```text
<title>-master.mp4
<title>-captions.srt
<title>-captions.vtt
<title>-manifest.json
<title>-qc-report.html
<title>-credits-and-rights.csv
```

## 12. Stage 9 — YouTube packaging and prospective learning

1. Bind the project to an approved release-profile version, or use a project-local release brief for a one-off film.
2. Create truthful public-thumbnail candidates from approved frames/references or a separately authorized illustration. Apply final typography and layout deterministically, preview at realistic sizes, and select one candidate by human review.
3. Draft and select title/description details, derive chapters from the locked timeline, attach captions/languages, and review category, playlist, tags/hashtags, credits, links, and end-screen notes. Validation checks facts and platform rules; it does not award a universal SEO score.
4. Record explicit human decisions for made-for-kids status, altered/synthetic-media disclosure, packaging truth, originality, rights/credits, and the complete watch. No field silently defaults to the safest-looking answer.
5. Preview and lock a new immutable release-package version containing the master, selected thumbnail, captions, release details, chapters, rights/credits, attestations, QC, upload checklist, production manifest, and a hash inventory.
6. Upload manually through YouTube Studio in version 1. Attach the eventual video ID/URL to the exact package without rewriting it.
7. Optionally import official performance reports or later collect eligible metrics through a separately approved read-only connector. Human-approved recommendations apply prospectively to a named release, project, series, or profile version; they never alter locked history or authorize paid work.

Thumbnail candidates are not an audience A/B test. Only a real accepted platform-result artifact tied to the exact candidate hashes may declare an experiment winner.

## 13. Managing multiple series

- Open one project at a time for editing; background jobs remain visibly labeled by project.
- Each project has separate bibles, workflows, model pins, budgets, and output folders.
- Shared model files are safe to cache globally; creative references are not.
- Channel release profiles are shared only through explicit project bindings; ideas, selected packaging, performance baselines, and recommendations remain scoped to their named profile/project.
- Copying a character/style into another project creates a new owned version and preserves lineage.
- A worker session can process more than one project only if the scheduler creates separated roots/tokens; version 1 should prefer one project per worker session for simpler isolation.

## 14. Handling a one-off film

A one-off film uses the same approvals and infrastructure but skips season mechanics. Its style and cast can be lighter or unique, while manifests, budgets, continuity, recovery, final QC, truthful packaging, and release evidence remain identical. It may use a channel release profile or a film-local release brief without inventing series/season metadata.

If a one-off later becomes a series, clone it into a new series project and explicitly promote selected bibles; do not mutate the released film's historical project structure.

## 15. Change scenarios

| Change | Result |
| --- | --- |
| Correct character spelling only | Metadata/caption impact; visual shots may remain current |
| Change face, hairstyle, or palette | Character-dependent images/video become stale |
| Change voice pronunciation | Affected audio, A2V video, and captions become stale |
| Change one script line | That line, linked shots, audio, captions, and timeline segment become stale |
| Change model/workflow default | Existing takes remain valid; new takes use a new manifest version |
| Update upstream skills | Existing imports remain pinned; re-import is an explicit new source version |
| Change delivery frame rate | Timeline durations and all export/QC assumptions require migration review |
| Change title, thumbnail, chapters, captions, or audience/disclosure answer | Locked package remains unchanged; preview and lock a new release-package version |
| Approve an analytics recommendation | Only future work inside the chosen scope receives the new constraint; released history stays unchanged |

No change deletes historical evidence automatically.

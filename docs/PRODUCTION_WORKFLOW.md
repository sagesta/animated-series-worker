# End-to-end production workflow

## 1. Production shape

The studio uses the same core workflow for a recurring series and a one-off film:

```text
Idea/source
  -> story structure
  -> locked world and character bibles
  -> script and line book
  -> engine-neutral storyboard
  -> approved voice and reference assets
  -> cheap draft tests
  -> selected final generations
  -> review and targeted repair
  -> rough cut, sound, captions, QC
  -> final export package
```

The difference is organization:

- Series: Project → Season → Episode → Sequence → Scene → Shot.
- Film: Project → Sequence → Scene → Shot.

## 2. Stage gates

| Gate | Must be approved | Why it occurs here |
| --- | --- | --- |
| G0 Project brief | Format, audience, language, duration, delivery, budget envelope | Prevents incompatible assumptions |
| G1 Story lock | Premise, arc, episode/film structure, major beats | Assets should serve a stable story |
| G2 Bible lock | Style, lead characters, voices, recurring locations/props | Multiplied consistency depends on these |
| G3 Script lock | Scene action, dialogue, line IDs, timing target | Voice and shot timing need stable text |
| G4 Storyboard lock | Shot intent, method, duration, references, continuity | Paid generation must not decide the story accidentally |
| G5 Pilot lock | Representative image, voice, dialogue shot, motion shot, measured cost | Proves quality and economics before scale |
| G6 Batch authorization | Ready jobs, estimate, hard cap, worker count | Makes spending explicit |
| G7 Picture/voice lock | Approved takes and final line audio | Edit and captions must have stable sources |
| G8 Release lock | Timeline, sound, captions, rights, technical QC, human review | Final delivery decision |

Changing an earlier gate creates a new version and an impact report. Later gates do not vanish, but affected items become stale until resolved.

## 3. Stage 0 — define the production

For a series, define:

- Series promise and audience.
- Season arc and expected episode count.
- Typical 20–35 minute episode structure.
- Visual style and motion budget.
- Recurring cast and locations.
- Language and voice approach.
- Delivery and budget profiles.

For a one-off film, define the same creative constraints at film and sequence level. It does not need fake season metadata.

Select a pilot scene that is difficult enough to be honest. A silent landscape shot alone is not a valid proof for a dialogue-heavy series.

## 4. Stage 1 — story development and upstream import

Use the pinned upstream skills where they help:

1. Outline and adaptation facts.
2. Character roster and design prompts.
3. Scene and prop art-bible facts.
4. Script scenes, beat flow, dialogue, delivery notes, and line book.
5. Storyboard segment/cut suggestions and shot vocabulary.

The studio copies imported source files unchanged, records the upstream commit, runs upstream validation, and generates a normalization preview.

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

### Production-method selection

| Situation | Preferred method |
| --- | --- |
| Quiet exposition or reaction | Held image with subtle pan/parallax or loop |
| Reusable ambience | Short approved loop |
| Character movement without dialogue | LTX image-to-video or keyframes |
| Visible speaking close-up | Approved TTS + LTX audio-to-video |
| Existing good clip with a small bad area | LTX retake |
| Good acting but mouth/audio mismatch | LTX lip-dub/repair |
| Complex unsupported action | Split action, redesign shot, or external/manual method |

The fallback is decided before generation, not improvised after unlimited retries.

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

Capture runtime, attempts, cost, approval reason, failure class, identity drift, lip quality, and local/remote transfer time. Use the results to set workflow defaults and the episode forecast.

If the pilot fails, revise the bible, shot design, or workflow. Do not proceed by assuming hundreds of generations will average out the problem.

## 9. Stage 6 — batch production

Batch only shots with locked inputs. The recommended daily session:

1. Review `Ready to generate` shots.
2. Confirm estimate, hard cap, and worker count.
3. Start the cloud session.
4. Let the scheduler provision, verify, generate, download, and terminate.
5. Confirm the session says `GPU terminated`.
6. Review takes locally.
7. Approve, reject, or make targeted retake requests.

Group work by workflow/model so the GPU does not repeatedly load different large models. Voice lines can be prepared before video batches.

## 10. Stage 7 — editorial construction

The rough cut places approved takes by shot order and frame duration. Then:

- Adjust safe trims and holds.
- Add reaction holds and transitions.
- Layer dialogue, room tone, effects, and music.
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

Output package:

```text
<title>-master.mp4
<title>-captions.srt
<title>-captions.vtt
<title>-manifest.json
<title>-qc-report.html
<title>-credits-and-rights.csv
```

## 12. Managing multiple series

- Open one project at a time for editing; background jobs remain visibly labeled by project.
- Each project has separate bibles, workflows, model pins, budgets, and output folders.
- Shared model files are safe to cache globally; creative references are not.
- Copying a character/style into another project creates a new owned version and preserves lineage.
- A worker session can process more than one project only if the scheduler creates separated roots/tokens; version 1 should prefer one project per worker session for simpler isolation.

## 13. Handling a one-off film

A one-off film uses the same approvals and infrastructure but skips season mechanics. Its style and cast can be lighter or unique, while manifests, budgets, continuity, recovery, and final QC remain identical.

If a one-off later becomes a series, clone it into a new series project and explicitly promote selected bibles; do not mutate the released film's historical project structure.

## 14. Change scenarios

| Change | Result |
| --- | --- |
| Correct character spelling only | Metadata/caption impact; visual shots may remain current |
| Change face, hairstyle, or palette | Character-dependent images/video become stale |
| Change voice pronunciation | Affected audio, A2V video, and captions become stale |
| Change one script line | That line, linked shots, audio, captions, and timeline segment become stale |
| Change model/workflow default | Existing takes remain valid; new takes use a new manifest version |
| Update upstream skills | Existing imports remain pinned; re-import is an explicit new source version |
| Change delivery frame rate | Timeline durations and all export/QC assumptions require migration review |

No change deletes historical evidence automatically.

# Image, voice, video, audio, and delivery pipeline

## 1. Pipeline policy

Creative facts and approvals are canonical. Model prompts and workflow graphs are compiled from them. This prevents a model-specific string from becoming the only record of what a shot was supposed to achieve.

Every workflow has:

- Stable ID and semantic version.
- JSON/API graph or Python recipe hash.
- Supported engine/model revisions.
- Minimum verified hardware class.
- Input and output contract.
- Default parameters and allowed user controls.
- Benchmark measurements.
- Known failure classes and fallback.
- License/source snapshot in `SOURCES.md` and the compatibility matrix.

## 2. Image pipeline

### Initial engines

- Qwen-Image for text-to-image concepts.
- Qwen-Image-Edit for reference-preserving edits, multi-reference composition, controlled variants, and consistency work.

The exact checkpoint and quantization are selected by the Phase 0 benchmark and pinned. Model-family choice does not bypass the consistency gate.

### Character workflow

1. Compile character facts and style bible into a concept brief.
2. Generate a deliberately small candidate set.
3. Human selects one identity direction.
4. Use controlled editing to create neutral portrait/full-body references.
5. Create views, expressions, poses, wardrobe, and detail crops from the selected identity.
6. Run identity tests in different backgrounds, framings, and two-character compositions.
7. Correct targeted failures through edit workflows.
8. Approve and lock the identity pack.

Do not independently prompt every view from text; each later board must condition on approved images.

For a deliberate character style/redesign change, preserve the approved identity anchors and old presentation pack, create a new presentation version, generate the required multi-view/expression/wardrobe consistency board, and test it in representative environments and multi-character compositions. Only after approval may the continuity engine bind it to the selected shot/scene/episode/season/future scope. A 2D-to-3D-look change is therefore a traceable new presentation, not an in-place prompt edit.

### Environment and prop workflow

- Generate an empty master before character composites.
- Record spatial anchors, entrances, windows, furniture, scale, and important colors.
- Make state variants by controlled edit when possible.
- Separate narrative props from generic dressing.
- Approve reusable plates and camera-direction references.

### Storyboard-frame workflow

Compile:

- Locked style and identity references.
- Location/prop state.
- Shot composition and camera intent.
- Required action and emotion.
- Previous/next continuity frame where useful.

Storyboard images are planning assets. A production first frame becomes a separate reviewed version rather than silently reusing an unapproved rough frame.

### Public release-thumbnail workflow

A public YouTube thumbnail is a release artifact, not the small rebuildable proxy used by the in-app media gallery. It starts from approved episode frames/character references or a separately authorized illustration request, keeps exact source and rights lineage, and may use the same versioned image adapter for controlled generation/editing. Final spelling, logo, border, and typography are rendered locally from approved text rather than trusted to generated raster text.

Candidates are previewed at full, desktop-card, and phone-card sizes and checked for current delivery dimensions/aspect ratio/format/file size, readability, safe margins, corruption, duplicates, and truthful representation. Each candidate preserves its hypothesis, recipe, hashes, cost, and review decision. Local comparison never creates an audience experiment result; only imported official platform evidence for the exact candidate hashes may do that.

### Layered 2D/parallax workflow

1. Start from an approved source image or approved generated candidate.
2. Produce or import foreground, subject, and background layers plus masks.
3. Inspect holes, edge contamination, occlusion, subject completeness, and safe camera movement margins.
4. Repair layers without editing or replacing the approved source.
5. Record layer hashes, mask hashes, anchors, occlusion order, composite recipe, and preview.
6. Approve the layered composite for a bounded shot/scene use.
7. Render parallax deterministically in the local media/timeline service; use GPU generation only when missing content must be reconstructed.

## 3. Voice pipeline

### Voice creation modes

- `Designed`: Qwen3-TTS creates a new voice from a description.
- `Built-in`: use an approved included voice.
- `Consented reference`: condition on a voice recording with recorded rights and transcript.

For a reusable designed voice, produce a reference clip, approve it, and create reusable conditioning. Store the model revision, reference hashes, transcript, conditioning artifact, and rights record.

### Dialogue generation

1. Validate line ID, text, speaker, language, delivery, and pronunciation dictionary.
2. Generate line-level WAV masters.
3. Review identity, delivery, pronunciation, noise, and clipping.
4. Retake only failed lines.
5. Lock approved master.
6. Create a derived mix copy with trim, fades, level, and final sample rate.
7. Time captions from approved audio.

Original TTS output and mixed derivative remain separate assets.

### Voice consistency rules

- Never regenerate a recurring voice from description alone after it is locked.
- Changes to reference, model revision, conditioning, language, or pronunciation create a new voice version.
- A season may deliberately pin an older voice version.
- Emotion controls may vary by line; speaker identity conditioning remains locked.

## 4. Video pipeline

### LTX workflow profiles

| Profile | Purpose | Typical use |
| --- | --- | --- |
| `ltx-draft-i2v` | Fast composition/movement check | Cheap iterations before final |
| `ltx-final-i2v` | Production image-to-video | Non-speaking motion and cinematic shots |
| `ltx-final-a2v` | Image + locked audio to video | Dialogue/performance shots |
| `ltx-keyframe` | Motion between approved frames | Controlled start/end composition |
| `ltx-retake` | Replace a selected bad time region | Preserve good parts of a clip |
| `ltx-lipdub` | Re-voice or repair mouth/audio relation | Approved acting with dialogue mismatch |
| `ltx-upscale` | Production resolution pass | Only after content approval |
| `ltx-control` | Pose/depth/edge/mask or motion-track-guided generation | Difficult action needing explicit structure/path |
| `ltx-v2v-iclora` | Reference-video/IC-LoRA transformation | Rights-cleared motion or structure reference |
| `ltx-dfr` | Diffusion-fidelity final rendering and optional temporal upsampling | Approved demanding shot where detail/fluidity justifies cost |
| `ltx-inoutpaint-relight` | Targeted spatial/lighting repair | Preserve most of a take while changing a controlled region |
| `ltx-multishot` | Native connected-shot experiment | Only after pilot continuity/editorial benchmark passes |

Exact capabilities depend on the pinned open-source release and are tested, not assumed from a hosted API with the same name.

The current official compatibility evidence does not permit assuming every LTX-2.3 IC-LoRA works with LTX-2.5. Dub-It and Foley remain blocked/experimental until the exact selected adapter passes the compatibility matrix; no workflow silently mixes model families.

### Prompt compilation

An LTX motion prompt is compiled from:

- Who/what is visible, described by approved reference roles rather than unstable names alone.
- Initial composition.
- Ordered subject action.
- Camera movement.
- Emotion/performance.
- Environment motion and sound intent.
- Explicit continuity constraints.
- Negative constraints only where the workflow supports them reliably.

If an optional prompt enhancer is used, the manifest stores the creator/compiler prompt, enhancer identity/version/settings, enhanced prompt, and whether enhancement was enabled. The enhanced string never replaces canonical story, shot, or control facts.

### Control-pack compilation

Canonical control roles are start/end frame, pose, depth, edge, segmentation, mask, motion track, and reference clip. Before estimation:

1. Validate asset hashes, dimensions/time bases, project scope, rights, and approval.
2. Compare requested roles with the exact workflow capability manifest.
3. Resolve plain-language strength intent to benchmarked adapter parameters.
4. Preview the control overlays and expected crop/frame snapping.
5. Fail unsupported/conflicting combinations; never ignore a requested control.
6. Record the resolved numerical values only in the compiled job manifest.

Dialogue text is not used as a substitute for the approved audio file. For A2V, the manifest marks audio preservation as required and QC compares source/returned audio.

### Duration and shot boundaries

- Canonical duration is frames at project frame rate.
- Engine-supported frame counts may require snapping. The adapter reports the difference before generation and the editor reconciles it explicitly.
- Prefer several intentional shots over asking one generation to perform a complicated long scene.
- Native multi-shot may be used only after the pilot proves identity, timing, and editorial control for the selected style.

### Failure-driven fallback

| Failure | First response | Escalation |
| --- | --- | --- |
| Identity drift | Strengthen/replace approved first frame or references | Redesign composition; split shot |
| Bad hands/interaction | Reduce visibility or split action | Controlled image edit/keyframes/external |
| Mouth mismatch | Check locked audio and A2V setup | Lip-dub repair or change framing |
| Camera ignores prompt | Simplify to one movement | Use keyframes or editorial pan |
| Motion too busy | Reduce action/camera complexity | Hold/loop hybrid method |
| Good first half, bad second half | Retake time region | Split shot and edit |
| Repeated failure over retry limit | Stop spending and flag creative redesign | External/manual shot |

Retry count is bounded by the budget policy. “Try again” without a changed hypothesis is not a production strategy.

## 5. Hybrid animation methods

The timeline supports methods that do not need a new full-motion generation:

- Held frame with slow crop/pan/zoom.
- Layered parallax from separated foreground/character/background.
- Short seamless idle, ambience, blink, breathing, weather, or machinery loops.
- Reaction holds and cutaways.
- Mouth-focused dialogue shot with limited body motion.
- Reused establishing shot where continuity permits.
- Motion graphics, text cards, maps, inserts, and transitions.

The storyboard records these as deliberate methods so the cost forecast reflects them and the final style remains coherent.

## 6. Lip-sync policy

Lip-sync effort follows visibility:

- Close/medium visible mouth: strict human review and repair option.
- Wide shot or profile/occluded mouth: normal review; do not spend on invisible precision.
- Off-screen voiceover: mouth should not appear to speak.
- Multiple visible speakers: prefer shot/reverse-shot or controlled staging rather than ambiguous simultaneous speech.

Primary path is locked Qwen3-TTS audio → LTX A2V. LTX lip-dub is a repair/re-voice path for an existing clip. No shot is accepted solely because an automated score passes.

## 6.1 Headless generation and local review

ComfyUI runs headlessly on the temporary worker and is addressed only by the authenticated gateway on loopback. The studio submits a pinned compiled workflow, receives bounded progress/preview events, downloads completed artifacts, validates type/size/hash/media properties, and writes the original atomically into the local project before presenting it as a take.

The normal creator experience is entirely inside Animated Series Studio:

- Images: gallery, zoom/pan, reference toggles, side-by-side and overlay comparison.
- Audio: player, waveform, transcript/captions, line/version identity, synchronized A/B.
- Video: player, scrubbing, frame/time navigation, captions, volume, loop range, full screen, synchronized A/B.
- Review: approve, reject, annotate, retake, repair, and return to storyboard with complete lineage.

Low-resolution generation previews are temporary and visibly labelled. They never become approved assets. Every canonical original has rebuildable derived review media—thumbnail, poster frame, waveform, or proxy—with its own recipe and hash. A derivative failure can be retried locally and cannot replace, edit, or invalidate the original.

## 7. Editorial and audio pipeline

Audio layers:

1. Dialogue masters.
2. Room tone/ambience.
3. Synchronized effects/foley.
4. Designed transitions.
5. Music.
6. Optional voiceover.

### Ambience, effects, and foley

- Imported libraries, recorded sources, and generated sources use the same rights/provenance registry.
- Text- or video-conditioned effects are created as separate immutable WAV assets and aligned as editable cues.
- Dialogue and music are excluded from an effects-generation job unless the job explicitly targets their own separate approved workflow.
- Current LTX Foley evidence is validated on LTX-2.3 rather than the selected LTX-2.5 baseline, so it remains a Phase 0/7 benchmark candidate behind `AudioEffectsEngine`.
- Failed or near-silent generated effects can produce new candidates within a bounded budget; they never overwrite a cue or trigger unlimited seed retries.

The mix pipeline stores editable layer sources and creates a derived master. Initial web-delivery target is approximately -14 to -16 LUFS integrated with true peak no higher than -1 dBTP; the exact profile is confirmed during the pilot and recorded rather than silently changed.

Captions derive from line IDs and approved audio timing. Export SRT and WebVTT; preserve a machine-readable cue file linked to dialogue versions.

## 8. Final delivery profile

Default baseline:

- MP4 container with fast-start metadata.
- H.264 High Profile, progressive, 4:2:0.
- 1920×1080, 16:9, SDR BT.709.
- 24 fps, or another project-locked progressive rate.
- AAC-LC stereo, 48 kHz.
- Target bitrate based on current YouTube guidance; default 1080p standard-frame-rate profile uses 8 Mbps video and up to 384 kbps stereo audio unless the delivery benchmark justifies a higher mezzanine.
- Separate SRT and VTT captions.

The source and verification links are maintained in `SOURCES.md`. Delivery settings are versioned profiles, not constants scattered through code.

The locked master is then referenced—not silently copied or altered—by the separate versioned YouTube release package defined in `YOUTUBE_RELEASE_WORKFLOW.md`. That package adds the selected public thumbnail, release details, timeline-derived chapters, captions, attestations, rights/credits, checklist, QC, and hash inventory; it does not publish automatically in version 1.

## 9. Technical QC

Automated probes and tests include:

- File/container readability and expected streams.
- Exact/allowed dimensions, sample rate, frame rate, pixel format, duration, and start time.
- Audio presence, excessive silence, clipping, peak and loudness.
- Source-vs-A2V audio fingerprint/timing where preservation is required.
- Missing/corrupt frames, unintended black runs, and suspicious long freezes.
- Caption parse, ordering, overlap, bounds, and dialogue coverage.
- Manifest-to-file hashes and timeline dependency completeness.

Visual/creative QC remains human and uses the checklist in `PRODUCTION_WORKFLOW.md`.

### Creative-assist QC

Assistive checks may flag:

- Character-reference, wardrobe, palette, location, prop, and text mismatch.
- Temporal flicker, discontinuity, implausible motion, suspicious freezes, or abrupt optical-flow changes.
- Face, hand, mouth, object-interaction, and unwanted-logo/text regions for inspection.
- Mouth/audio timing and multi-speaker ambiguity.
- Speech-recognition mismatch against the approved line, with word/time evidence.

Every observation records checker/model version, confidence, reference hashes, and frame/time evidence. A checker failure leaves the take reviewable. No threshold approves, rejects, repairs, or releases media automatically.

## 10. Model-update gate

Before adopting a new model revision, precision, quantization, LoRA, or workflow:

1. Preserve current default and test pack.
2. Verify source, license, checksum, and hardware requirements.
3. Run the locked character/style/voice/video benchmark.
4. Compare quality, runtime, GPU memory, retry rate, and cost.
5. Record known regressions.
6. Accept prospectively through a decision/change entry.
7. Keep old workflow available for existing production manifests until retention policy permits archive.

Runtime ComfyUI Manager installation, package updates, model downloads, and Git changes are disabled in a production worker. A missing dependency is a worker-release defect: quarantine/terminate, then build and test a new image separately.

## 11. Optional project adaptation

Use an adaptation only after the reference-only locked image/video benchmark fails the agreed identity/style threshold:

1. Curate a project-owned, rights-reviewed dataset from approved identity/style assets.
2. Version captions/tags, exclusions, dataset splits, and hashes.
3. Estimate and explicitly authorize training cost.
4. Train against an exact compatible base model in an isolated job.
5. Compare reference-only versus candidate adaptation on the unchanged test pack.
6. Reject overfit, identity/style regression, composition loss, unsafe memorization, unacceptable runtime/cost, or incompatible-license candidates.
7. Promote prospectively as a project-scoped version with rollback to the reference-only workflow.

Training a new foundation model remains outside scope.

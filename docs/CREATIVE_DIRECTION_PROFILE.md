# Audience and creative-direction profile

## 1. Purpose

Every series and one-off film has one project-local creative compass. It records who the work is for, what kind of experience it promises, and the creative boundaries that later story, character, storyboard, media, voice, thumbnail, and release work must respect.

The profile is deliberately broader than a single `niche` box. A niche such as “African folklore fantasy” is useful, but it cannot by itself tell a writer the intended audience, emotional tone, episode shape, cultural setting, safety boundaries, visual language, or what makes the production distinct.

This profile is creative guidance, not canon and not a platform declaration:

- it does not silently rewrite a character, script, approved image, voice, board, or release package;
- it does not decide whether a YouTube video is made for children;
- it does not decide synthetic-media disclosure, rights, originality, or metadata truthfulness;
- comparable titles describe a creative neighbourhood only and are never instructions to copy protected expression.

## 2. Resource synthesis

This contract reconciles the resources already reviewed for the studio:

| Resource | Contribution retained in this profile and workflow |
| --- | --- |
| Current studio PRD, architecture, media pipeline, and production workflow | Per-project isolation, immutable versions, approval gates, local authority, continuity impact, no silent paid action, and distinct series/film handling |
| User-supplied rich animation-workflow comparison | Separate identity, presentation style, environment, movement, dialogue, shot control, timing, and approval stages instead of expecting a storyboard paragraph to control every engine perfectly |
| Pinned `shuohao-skills` production skills | One consistent direction input for normalized outline, characters, art direction, script, storyboard, and shot-recipe tasks, while the vendored upstream source remains unchanged |
| Reviewed `darkzOGx/youtube-automation-agent` workflow | Audience/channel promise, packaging voice, visual positioning, blocked claims/topics, thumbnail and release-detail preparation; platform attestations remain a later separate human gate |
| Current GPT/Claude/Gemini Creative Room | Exact preview of the selected profile version and hash before a potentially paid writing request; output remains a proposal |
| Planned Qwen, ComfyUI, Qwen3-TTS, LTX, and YouTube stages | A neutral source that future compilers can translate into engine-specific image, voice, motion, thumbnail, and release briefs without storing one giant prompt as project truth |

## 3. Versioned record

`CreativeDirectionProfile` is a project-owned immutable record:

```json
{
  "schemaVersion": 1,
  "profileId": "01J...",
  "projectId": "01J...",
  "revision": 2,
  "createdAt": "2026-08-22T00:00:00.000Z",
  "direction": {
    "targetAudience": "Families and viewers aged 9–15 who enjoy hopeful fantasy.",
    "ageBand": "mixed",
    "primaryNiche": "African folklore fantasy adventures",
    "genres": ["fantasy", "mystery", "family adventure"],
    "toneKeywords": ["hopeful", "witty", "adventurous"],
    "coreThemes": ["belonging", "courage", "responsible power"],
    "storyPromise": "Each episode resolves an emotional problem through a magical adventure.",
    "culturalSetting": "A fictional West African coastal kingdom.",
    "contentBoundaries": ["no graphic injury", "no contempt for real traditions"],
    "episodeFormat": "A serialized 24-minute adventure with a complete episode arc.",
    "youtubePositioning": "Premium family animation with clear episode hooks and honest packaging.",
    "visualStyleNotes": "Graphic 2D shapes, warm painted backgrounds, expressive silhouettes.",
    "comparableTitles": ["title used only as a directional reference"],
    "differentiation": "Folklore-inspired problems are solved through community knowledge, not copied plots."
  }
}
```

The implementation stores versions at:

```text
projects/<project-id>/bibles/creative-direction/versions/
  creative-direction-v0001-<profile-id>.json
  creative-direction-v0002-<profile-id>.json
```

Creating a project writes revision 1. Choosing **Revise direction** writes the next file; it never replaces the prior file. Existing projects without this folder open normally with no profile and can add revision 1 from the overview. The manifest schema therefore does not need a forced migration.

## 4. Field intent

| Field | Plain-language question | Main future consumers |
| --- | --- | --- |
| `targetAudience` | Who should care about and enjoy this production? | writing, review, packaging |
| `ageBand` | What creative maturity level should guide the work? | writing, visual/voice direction; never the YouTube attestation |
| `primaryNiche` | What clear subject-and-experience space does it occupy? | ideation, writing, release positioning |
| `genres` | Which story conventions should the production use? | outline, script, boards, sound |
| `toneKeywords` | How should it feel? | writing, art, voice, music, motion |
| `coreThemes` | What recurring ideas should stories explore? | season/episode planning and review |
| `storyPromise` | What reliable experience does each episode or film give the viewer? | outline, script, release details |
| `culturalSetting` | Which place, culture, or fictional context grounds the work? | research, world, art, voice review |
| `contentBoundaries` | What must be avoided or handled carefully? | writing, boards, media prompts, review |
| `episodeFormat` | What duration/structure/serialization pattern is expected? | outline, script timing, storyboard, scheduler |
| `youtubePositioning` | How should truthful public packaging frame the work? | thumbnail and release-detail candidates |
| `visualStyleNotes` | What high-level visual language is wanted? | style bible and image compiler; not character identity |
| `comparableTitles` | Which existing works help explain the neighbourhood? | human/AI direction only; no copying |
| `differentiation` | Why should this production feel recognizably its own? | all creative reviews and packaging |

## 5. Current application flow

The six-step production wizard is:

1. Format — series or one-off film.
2. Identity — title, code, intended duration.
3. Audience — target audience, creative age band, niche, genres, and setting.
4. Creative direction — viewer promise, tone, themes, format, boundaries, visual/public direction, references, and differentiation.
5. Starting point — original idea or later import.
6. Review — confirm the project and direction before local creation.

The overview displays the active revision and lets the creator add or revise it. Required direction fields show an asterisk and live minimum guidance; attempting to continue or save while a required value is missing or short opens one correction summary without writing a revision. Saving the profile is a local, no-GPU, no-provider action. Version 0.10 adds **Generate direction ideas** beside the direction form for audience, niche, genre, setting, promise, tone, themes, format, boundaries, visual style, positioning, comparables, and differentiation. That optional action previews exact project context/skills, requires a separate potentially paid text confirmation, stores a proposal, and inserts only a creator-selected answer into the unsaved field. Creative age-band policy meaning remains explanation-only.

The Creative Room and field assistant include the active profile by default, show it in the exact context preview, and record its ID, revision, timestamp, and SHA-256 in every new schema-3 writing proposal.

## 6. Compilation into the full production workflow

The profile is an input, not an all-powerful prompt. Each stage combines it with the exact approved records relevant to that job:

| Stage | Profile contribution | Additional authority required |
| --- | --- | --- |
| Idea and outline | audience, niche, genre, themes, promise, format, boundaries | approved series/film premise and current canon |
| Character and world | audience, culture, tone, visual notes, differentiation | identity bible, world bible, rights/research review |
| Script | audience, tone, themes, promise, boundaries, format | approved outline, character/voice facts, continuity state |
| Storyboard and shot recipe | tone, visual notes, episode shape | approved script, line timing, shot grammar, staging and control constraints |
| Image/character board | niche, culture, tone, visual direction | locked identity references, presentation binding, environment and shot record |
| Voice/TTS | audience, tone, culture and boundaries | consented voice profile, casting/line direction, pronunciation book |
| LTX video and lip sync | tone and visual direction | approved keyframe/source asset, timed line, motion/camera/control pack, compatible workflow pin |
| Thumbnail candidates | audience, positioning, visual direction, differentiation | truthful approved frame/assets, exact title treatment, responsive-size validation |
| Release details | audience, niche, promise, themes, positioning | factual episode/package sources, rights/credits, timeline chapters |
| Release attestations | no decision authority | creator's explicit current YouTube/policy/rights answers |

Every writing request now pins the exact profile version. Every media/upstream/release compiler must do the same as it qualifies. Revising the profile never automatically invalidates, rewrites, or regenerates approved history; complete cross-stage dependency impact remains part of full AT-059 acceptance.

## 7. Multiple series and films

Profiles never cross project boundaries. Two productions may share a genre or use the same provider, but each keeps its own profile IDs, revisions, assets, prompts, jobs, proposals, and release bindings. A one-off film uses the same record with a film-shaped `episodeFormat` and has no forced season structure.

Possible future reusable channel defaults must be copied or explicitly bound through a versioned release profile. They must never become a hidden global creative prompt.

## 8. Acceptance boundary

The current slice proves local creation, immutable revision, project isolation, renderer editing, exact writing-context lineage, and review-only contextual idea generation for the direction fields. Full acceptance additionally requires each upstream/image/voice/video/thumbnail/release compiler to pin the profile version, impact preview and stale propagation across those records, and representative non-technical users to complete both a series and a one-off-film flow without confusing creative guidance with platform declarations.

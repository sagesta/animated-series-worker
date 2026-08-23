# YouTube release, packaging, and learning workflow

Status: version 0.10.0 implements project-local release-profile revisions, a source-labelled Idea Library, local release details, deterministic thumbnail generation, editable captions, human attestations, immutable release records, a hash-checked manual-upload package, structured performance snapshots, and human-reviewed learning proposals. Report-file parsing, optional read-only OAuth, and automatic publishing remain outside the release. See [PRODUCTION_IMPLEMENTATION.md](PRODUCTION_IMPLEMENTATION.md).

Reference inspected: `darkzOGx/youtube-automation-agent` at commit `0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4` on 2026-08-21.

## 1. Outcome

Finishing the master video is not the end of production. The studio also prepares a versioned YouTube release package containing the selected thumbnail, title, description, chapters, captions, credits, audience/disclosure decisions, and a final upload checklist. A creator can manage different release identities for different series and can package a one-off film without inventing season data.

Version 1 does not publish automatically. The creator reviews the package and uploads it through YouTube Studio. A later separately approved connector may upload privately or schedule a reviewed release, but it cannot bypass rights, policy, audience, disclosure, or human approval gates.

The words `SEO score` are intentionally avoided. YouTube discovery is not a deterministic checklist, and tags are not a substitute for a truthful title, a representative thumbnail, a useful description, a strong episode, and real viewer response. The studio provides metadata validation and evidence-backed suggestions, not a promise of ranking.

## 2. What the reference repository adds

The repository contains working code for several channel-operations concerns that were missing from the studio baseline. It is a useful feature reference, not a compatible production engine or a dependency to copy wholesale.

| Reference capability | Evidence in that repository | Studio position before this review | Decision |
| --- | --- | --- | --- |
| Topic/competitor signals and idea backlog | YouTube most-popular and configured-channel queries, editorial-plan records, and a dashboard backlog | Story development existed, but channel research and release ideas were not explicit | Adopt as creator-controlled research with source evidence and duplicate/brand/continuity checks |
| Channel brand guardrails | One default channel profile stores audience, voice, CTA, visual direction, timezone, and blocked topics | Series style and story bibles existed, but channel packaging identity was not separate | Adopt versioned release profiles that can be shared explicitly across selected projects |
| Thumbnail generation | A thumbnail agent creates a concept, local text treatment, YouTube-sized file, and variants; another path can request an AI image | Only review-media thumbnails/proxies were planned, not public-facing episode art | Adopt a dedicated Thumbnail Room tied to approved characters, frames, rights, and release truth |
| Metadata assistant | Title, description, tags, hashtags, chapters, category, language, and end-screen suggestions are generated and stored | The export package did not include a governed YouTube metadata record | Adopt a Release Details workspace, deterministic validation, and editable variants |
| Packaging variants | Title and thumbnail candidates can be reviewed before approval | Take comparison existed, but release-art comparison did not | Adopt candidates and hypotheses; do not call them an audience A/B test until real test evidence exists |
| Readiness and recovery | Provider/media/upload probes plus stage checkpoints and selective resume are persisted | Durable jobs, preflight, idempotency, and recovery were already required but spread across documents | Keep the stronger studio contracts and add one plain-language Prepared Studio/Release Readiness view |
| Publishing and scheduling | OAuth upload, thumbnail/caption upload, queue processing, and duplicate-upload reconciliation are implemented | Automatic public publishing is explicitly outside version 1 | Defer. Version 1 exports a complete package; any later connector starts private/reviewed and is separately authorized |
| Analytics learning loop | 24-hour/7-day snapshots, channel-relative baselines, and human-approved recommendations are stored | No post-release learning loop was specified | Adopt optional read-only/manual performance import with evidence, confidence, and human promotion |
| Full animation production | Up to five broad visual prompts, cloud image generation, a single Wan I2V call, or a slideshow fallback | The studio plans locked characters, line audio, neutral shot plans, Qwen/LTX, controls, lip-sync, continuity, and long-form editing | Do not adopt; it is not a replacement for the studio animation architecture |
| Multi-series continuity | The reference system centers on one default channel/profile and topic videos | The studio already isolates many series and films with versioned bibles and dependencies | Keep the studio model and add explicit project-to-release-profile bindings |
| Secret and policy handling | Credentials/tokens are written to ignored JSON files and upload code defaults `selfDeclaredMadeForKids` to false | The studio already uses Windows-protected encrypted storage and human release authority | Reject these patterns; OAuth tokens use the protected vault and audience/disclosure choices are explicit human attestations |

## 3. Release profile and idea library

### Project direction versus release decisions

The implemented project Audience & Creative Direction profile supplies a pinned target audience, niche, viewer promise, tone, themes, visual direction, differentiation, boundaries, and preliminary YouTube positioning. Future idea, thumbnail, and Release Details tasks may use that exact version as drafting context.

It is not the same as either record below:

- A `ChannelReleaseProfileVersion` governs reusable channel/public-packaging conventions and must be explicitly bound to projects.
- A `ReleaseAttestationVersion` records the creator's explicit made-for-kids, altered/synthetic-media, truthfulness, originality, rights/credits, and full-watch decisions for the exact release.

A creative age band of `children`, `all-ages`, or any other value never pre-fills the made-for-kids attestation. `youtubePositioning` never proves that a title or thumbnail is truthful. The release UI may show the project direction beside the question as context, but it must leave the legal/platform answer unresolved until the creator decides it.

The current `ProjectReleaseProfile` is immutable project-local packaging guidance, not a creative project database. It records profile name/revision, audience, language, region/timezone, channel promise, packaging voice/visual direction, default CTA/credits, blocked claims/topics, category, and playlist convention. A later explicit copy/bind operation is still required before one channel profile can be shared across projects safely.

The broader `ChannelReleaseProfileVersion` target records:

- Channel/profile name and optional channel ID after connection.
- Intended audience, language, region, timezone, and release cadence.
- Channel promise, brand voice, title/description tone, visual packaging direction, CTA, credit/link blocks, and blocked claims/topics.
- Default category, license choice, playlist naming convention, and whether every release is reviewed separately for child-directed status.
- Source/version, projects permitted to use it, and an explicit copy/bind history.

One profile may be bound to several series only after an explicit choice. A series may change to a new profile version prospectively without changing old releases. A film can use a profile or a project-local release brief.

The current Idea Library stores a project-scoped title, premise, creator/LLM/audience/trend/other source label, rationale, continuity notes, and editorial status. Trend and competitor signals are suggestions; they cannot silently create an episode, rewrite a season arc, or trigger paid generation. Automated duplicate scoring, source-link import, and shared-profile scope remain later slices.

## 4. Thumbnail Room

Thumbnail work starts after a sufficiently stable picture lock so it represents the actual episode. Earlier concepts may be labelled `draft`, but they cannot become the selected release thumbnail.

1. Select the exact project direction and release-profile versions, then choose a truthful release promise and one to three approved source frames, character references, or a specifically authorized new illustration.
2. Create concepts with composition, emotion, focal subject, background, text/no-text choice, palette, and intended viewing size.
3. Generate or edit the visual through the versioned image adapter. Character identity, wardrobe, series style, likeness rights, and misleading-content checks remain active.
4. Apply exact text, logo, border, and safe-area layout locally so spelling and typography are deterministic. Generated raster text is never trusted as final copy.
5. Produce two or more genuinely different candidates when useful. Each candidate records its hypothesis, source assets, model/workflow if generated, local layout recipe, rights, hash, and cost.
6. Preview every candidate at full size, desktop card size, phone card size, light/dark surroundings, and with timestamp/duration overlays where relevant.
7. Run technical checks for aspect ratio, dimensions, format, file size, contrast/readability, clipping, unsafe margins, duplicate candidates, and corrupted output.
8. A human selects the release candidate. Rejected candidates remain in history and are excluded from the upload package.

A local comparison is called `candidate review`, not `A/B test`. If the creator later uses YouTube Studio Test & Compare, the imported result records the exact candidate hashes, time window, metric/evidence, and platform report. The studio never fabricates an experiment winner or silently changes a live thumbnail.

## 5. Release Details workspace

The creator sees one editable workspace containing:

- A control title plus optional truthful variants, with length and truncation previews.
- Description summary, episode/film context, credits, links, CTA, rights/affiliate disclosures where applicable, and the selected chapters block.
- Chapters derived from the locked final timeline rather than estimated script durations. Validation checks `00:00`, ascending order, minimum chapter count/duration, and bounds against the master.
- Caption tracks and language labels.
- Category, primary language, recording/location fields when intentionally supplied, license, playlist/series/season/episode placement, and privacy suggestion for the manual upload.
- Tags and hashtags as secondary aids. The UI explains their limited role and blocks keyword stuffing or unrelated terms.
- End-screen/card plan as editorial notes. It does not claim those elements have been created on YouTube.
- A factual-support view showing which title/description claims come from approved story facts or cited research.

AI may draft options through the provider-neutral writing contract and applicable skills using the exact project context selected. Version 0.10 exposes that governed assistant beside release-profile, Idea Library, thumbnail, title, description, credits, chapter/metadata, and evidence-analysis text fields. A human chooses whether to insert, edit, and save an answer. Made-for-kids, synthetic-media, truthfulness, originality, rights, and full-watch decisions are explanation-only and cannot be inserted by the assistant. Validation is deterministic; a numerical `SEO score` does not approve or block release.

## 6. Policy and release-attestation gate

The app explains each question but does not make legal or policy decisions for the creator. Before a package can be locked, the creator must explicitly record:

- Whether the release is made for kids, not made for kids, or still requires advice/review. Animation alone does not answer this question.
- Whether the selected platform disclosure for realistic altered/synthetic media is required, not required, or still unresolved, with the policy version reviewed.
- Whether title, description, thumbnail, and claims accurately represent the episode and avoid deceptive metadata.
- Whether the episode is original and materially distinct rather than a generic, repetitive, mass-produced template.
- Whether all visual, voice, music, effect, font, likeness, reference, affiliate, sponsor, and credit obligations are satisfied.
- Whether the full master and packaging candidates received human review.

`Unresolved` blocks release lock. The studio never defaults a child-directed or synthetic-media declaration to false, and analytics cannot waive a policy, rights, or originality concern.

## 7. Release package

Each locked package is immutable and self-describing:

```text
release/<release-id>/
  master.mp4
  captions/
    <language>.srt
    <language>.vtt
  thumbnail/
    selected.jpg
    candidates/
  release-details.json
  release-details.txt
  chapters.txt
  credits-and-rights.csv
  audience-and-disclosure.json
  qc-report.html
  upload-checklist.html
  production-manifest.json
  package-manifest.json
```

`package-manifest.json` records every file hash, source creative-direction/release-profile versions, selected candidate IDs, approval identities/times, ruleset versions, and master lineage. A changed title, thumbnail, chapter, caption, master, direction binding, or attestation creates a new release-package version. It never edits a previously locked package in place.

The upload checklist gives plain instructions for YouTube Studio and copy-ready fields. It can open the local folder and the official upload page, but it does not paste secrets, click Publish, or claim that an upload occurred.

## 8. Post-release measurement and learning

Version 0.10 accepts a structured local evidence slice after the creator manually records the YouTube video ID:

- choose `manual official`, `official report`, or `rehearsal` as the source;
- enter the exact start/end window, collection time, supplied metrics, and evidence notes;
- store an immutable snapshot with metric-definition version and warnings for every unavailable metric;
- retain but exclude rehearsal, fewer-than-100-view, and views-only records from learning baselines; 100 is a conservative local eligibility floor, not a claim of statistical significance or success;
- create a separate learning proposal citing one or more snapshots, then record a human approval or rejection with reason.

The broader studio may later use one of two additional explicit paths:

1. Import creator-exported reports/files.
2. Connect a read-only YouTube/Analytics account using least-privilege OAuth credentials stored in the operating-system vault.

Performance snapshots are immutable, time-windowed observations such as 24 hours, 7 days, and 28 days. They record eligible official metrics, collection time, scope, API/report version, missing-data warnings, and whether the values are official/manual or a local rehearsal. Rehearsal, fewer-than-100-view, and views-only records remain visible but cannot be cited by a learning proposal. The 100-view floor is a conservative product guardrail, not evidence that 100 views is statistically sufficient. Version 0.10 does not claim to parse a report file or connect an account; `official report` means the creator transcribed a named official report slice into the structured form and retained its evidence notes.

Recommendations compare like with like inside the creator's own channel/profile and clearly separate observation from inference. Examples include `the opening lost viewers earlier than the series median` or `candidate B earned more watch-time share in YouTube's test`. Every recommendation lists its supporting releases and confidence. It remains `proposed` until the creator approves it for a named scope such as one next release, this series, or a future profile version.

Analytics can inform packaging, pacing experiments, and editorial questions. It cannot rewrite locked story facts, redesign a character, regenerate shots, switch live metadata, or trigger paid work automatically.

## 9. Implementation slices

1. **Implemented local slice:** project release-profile and Idea Library schemas, storage, revision/source status, and project isolation.
2. Release Details editor, timeline-derived chapter validator, deterministic metadata/package contracts, and copy-ready export.
3. Thumbnail Room using approved project media, local typography/layout, responsive previews, candidate lineage, and selection.
4. Policy/rights/originality attestations plus Release Readiness gate.
5. Versioned release package and clean-machine verification.
6. **Implemented local slice:** manual video ID, structured time-windowed evidence capture, rehearsal exclusion, and human-reviewed learning proposals. Report-file parsing remains open.
7. Optional read-only YouTube Analytics connector after OAuth/security review.
8. Separately decided post-version-1 private upload/scheduling connector, only if its failure, duplicate, quota, privacy, audit, and rollback model passes.

No slice is complete until its acceptance tests, non-technical wording, security review, source updates, and rollback/portability evidence pass.

# Test and acceptance plan

## 1. Test philosophy

Tests protect four scarce things: creative continuity, user data, user trust, and paid GPU time. A happy-path render is insufficient. The system must prove failure recovery, bounded spend, exact lineage, and understandable user behavior.

## 2. Test layers

| Layer | Scope |
| --- | --- |
| Unit | Domain invariants, hashes, budgets, durations, state machines, prompt compilation |
| Contract | JSON Schemas, IPC, provider adapter, worker gateway, engine adapters, upstream fixtures |
| Integration-local | Project files/SQLite, migrations, FFmpeg, credential vault, app process recovery |
| Integration-mocked-cloud | Provider timeouts, duplicates, rate changes, worker events, transfer interruption |
| GPU smoke | Exact image/voice/video workflows on compatibility hardware |
| End-to-end | Non-technical UI through verified local artifact and termination |
| Media quality | Technical probes plus locked human review pack |
| Security | Secret leakage, auth, public ports, traversal, project isolation, tamper rejection |
| Recovery | Backup restore, crash, network outage, worker loss, failed update/migration |
| Usability | Representative user completes critical tasks without technical intervention |

## 3. Fixture strategy

Maintain small, rights-safe fixtures:

- One mini series with two episodes.
- One one-off film sequence.
- Two visually distinct series to detect cross-project leakage.
- Two recurring characters, one functional character, two voices, two locations, two props.
- Silent, dialogue, two-person, hand/prop, camera, keyframe, retake, and lip-dub shots.
- Timed animatic revisions; pose/depth/edge/mask/motion-track/reference-video controls; layered-parallax plates; DFR/temporal-upsample candidates; known creative-QC positives/negatives; foley; and an optional adaptation candidate.
- Valid and intentionally invalid upstream JSON for every skill.
- Corrupt/truncated media, wrong hashes, missing files, bad captions, clipped/silent audio.
- Mock provider responses for success, timeout-after-create, rate change, capacity failure, termination delay, and billing discrepancy.

Creative benchmark references are locked by hash. Changing them is a test-version change documented in the changelog.

## 3.1 Current development evidence — version 0.6.0

| Evidence | Current result | Boundary |
| --- | --- | --- |
| Domain unit tests | Four passing tests for ULID shape/order, code normalization, safe manifest defaults, and invalid inputs | Does not cover creative asset versions/state machines |
| Project-store integration tests | Fifteen passing cases add immutable creative-direction creation/revision, damaged-revision preservation, stale-screen refusal, old-project no-profile compatibility, project isolation, and project-isolated no-overwrite writing-proposal persistence to the prior series/film, migration, backup/restore, tamper, path, and writer-lock matrix | Local profile/storage evidence passes; downstream compiler/impact behavior, clean-machine AT-030, and full asset/query/token/cache AT-031 isolation remain |
| Renderer tests | Nine passing tests cover the prior local/backup/migration/support/RunPod/writing flows plus the six-step audience/direction wizard and overview revision submission while preserving the earlier profile object | Does not replace representative non-technical usability, complete AT-059, packaged secret scan, clean-machine recovery, or live-provider acceptance |
| Creative-writing service tests | Five passing tests cover independent provider setup, controlled-catalogue filtering/refusal, schema-1→2 settings reads, exact manifest/direction context preview, two-source hashes, validated source/model/token/cost-state lineage, and refusal before explicit paid confirmation | Uses injected providers/vault/project store; live account switching, actual price/cost, canon promotion, other direction consumers, and full AT-036/AT-039/AT-059 remain |
| OpenAI/Anthropic/Gemini adapter tests | Nine passing mocked-HTTP tests cover model-list validation, required authorization/version/key headers, OpenAI non-stored structured Responses payload, Anthropic structured Messages payload, Gemini structured GenerateContent payload, usage/request IDs, safe key errors, and partial/incomplete-response refusal | No real account, model quality, current billing/quota, retention-policy, or end-to-end network evidence |
| Support-diagnostics tests | Two passing tests cover known RunPod/OpenAI/Anthropic/Gemini/Bearer values, protected fields, private paths, flushed log/support output, and preservation of harmless operational context | Worker/skill/provider-payload patterns, retention, malformed historical logs, large-volume behavior, and packaged-profile scanning remain |
| Credential-vault tests | Three passing tests prove encrypted storage contains no plaintext key, supports replacement/read/removal, and fails closed when OS protection is unavailable | Uses an injected protector in unit tests; packaged Windows DPAPI persistence still needs install/upgrade evidence |
| RunPod provider contract tests | Seven passing API v2 tests cover read-only account aggregate, catalogue prices/4090 baseline flag, 401, 403, 429, 503, timeout, and secret-safe errors | Mocked HTTP only; no user's live key or provider resource is used in automated tests |
| Cloud-setup tests | Three passing tests cover validate-before-store, no key in settings, local guardrails with generation lock, and disconnect retaining non-secret defaults | Storage/template/worker/watchdog/termination remain absent |
| Static quality | Type check, lint, documentation check, and three-part Electron production build pass | Not a security audit or clean-machine test |
| Windows package smoke | The full version-0.6.0 quality gate passes; a separate unpacked package (used because the prior package remained open) contains an executable reporting product version `0.6.0.0`, SHA-256 `781C89F819EDC55FA29CBF2910AF1DF606374328F23C88EFB41E2E72B56CEA22`, and 235,534,336 bytes | Authenticode is `NotSigned`; no clean-machine runtime, installer, upgrade, live-provider, or rollback evidence exists for version 0.6.0 |

The suite contains 57 automated tests. The direction/storage/UI tests and enhanced writing test provide a local slice of AT-059; the writing tests provide a mocked local slice of AT-036 and the lineage/context portion of AT-039. They are not full acceptance: no real key, external request, provider charge, model-quality comparison, actual-cost receipt, task-specific benchmark default, upstream/media/release direction compiler, or dependency-impact engine was used. AT-013 remains open because no provider resource, worker, job, purge, watchdog, termination, or GPU charge has been tested.

## 4. Core acceptance tests

### Project and continuity

- **AT-001:** Create, close, reopen, back up, and restore a series and a film with no data loss.
- **AT-002:** Attempt to open/copy an asset from the wrong project; access is denied unless using explicit copy, and lineage is preserved.
- **AT-003:** Lock character v1, create dependent shots/takes, create character v2, and verify only the correct dependants become stale while v1 history remains intact.
- **AT-004:** Interrupt an atomic write and a migration at each failure point; startup restores or reconciles without corrupting the active project.
- **AT-059:** Create a series and one-off film with distinct Audience & Creative Direction profiles; append a revision, refuse a stale or wrong-project revision, preserve every earlier file, and prove an exact profile ID/revision/hash appears in writing, upstream, canon, image, voice, video, thumbnail, and release compilation lineage. Show precise downstream impact without rewriting approved history, and prove creative age/style/positioning values cannot complete a YouTube release attestation.

### Upstream integration

- **AT-005:** Run all pinned upstream self-tests and studio adapter contract fixtures at the lock commit.
- **AT-006:** Import valid outline/cast/art/script/storyboard/shot-recipe data, preserve source hashes/IDs/evidence, and normalize deterministically.
- **AT-007:** Import a 20–35 minute episode plan and prove the studio supports long-form acts/holds without editing the upstream checkout or executing H3 prompts as LTX prompts.
- **AT-008:** Apply an intentionally incompatible upstream candidate; compatibility fails and the submodule/lock returns to the prior commit.

### Images and voices

- **AT-009:** Generate the locked image benchmark and pass human identity/style consistency criteria across required views and environments.
- **AT-010:** Generate two reusable voice profiles and pass speaker identity, language, delivery, and pronunciation review across calibration lines.
- **AT-011:** Change one pronunciation entry; only affected lines and downstream media become stale.
- **AT-012:** Attempt release with a consent-required voice lacking evidence; release is blocked with a clear remedy.

### Cloud and spend

- **AT-013:** Complete setup wizard, create a worker, verify capability, run smoke job, download/hash/probe result, purge, terminate, and record cost without terminal/cloud console.
- **AT-014:** Simulate create timeout after provider resource exists; reconciliation finds it and no duplicate is created.
- **AT-015:** Kill the desktop while worker runs; remote deadline terminates compute within the documented bound and local restart reconciles state.
- **AT-016:** Cut network connectivity during generation and download; no new worker is created blindly, output recovery is bounded, and cost status is explained.
- **AT-017:** Present a 24GB worker to a job requiring at least 32GB; readiness fails before paid generation/upload and worker terminates.
- **AT-018:** Cross the warning threshold and approach hard budget; scheduler stops new assignments and preserves sync/termination reserve.
- **AT-019:** Termination API is delayed/ambiguous; app keeps alerting/reconciling and never claims billing stopped without evidence.

### Video and review

- **AT-020:** Produce draft and final I2V, A2V, keyframe, retake, and lip-dub benchmark outputs with complete manifests.
- **AT-021:** For A2V requiring locked audio, verify the source audio identity/timing policy and flag an unacceptable alteration.
- **AT-022:** Reject and retake a shot; every attempt and cost remains, and only the approved take enters the timeline.
- **AT-023:** Exhaust retry policy without changed hypothesis; automatic retries stop and creative redesign is required.
- **AT-024:** Produce the 60–90 second pilot with recurring character, two voices/locations, dialogue, motion, repair, sound, captions, and export entirely through the normal UI.

### Timeline and release

- **AT-025:** Rebuild rough cut twice from identical manifests; timeline and master hash are deterministic where encoders/settings permit, otherwise decoded media equivalence is verified.
- **AT-026:** Inject missing/stale/unapproved/corrupt media, wrong frame rate, audio clipping, caption overlap, and manifest mismatch; release gate detects each.
- **AT-027:** Export the default YouTube profile and verify container, codecs, 1080p, 24fps, BT.709, audio sample rate, captions, manifest, and QC report.
- **AT-028:** Replace an approved take and verify only affected timeline/export versions become stale.

### Scale and recovery

- **AT-029:** Run equivalent independent batches on one, two, and three workers; outputs retain exact version compatibility, result order is correct, and total GPU-hours/cost are accounted.
- **AT-030:** Restore the project on a clean machine without the network volume and recover all canonical data/release media.
- **AT-031:** Operate two series plus a film, switch repeatedly, and prove no references, voices, prompts, costs, or paths cross project boundaries.
- **AT-032:** Produce a full 20–35 minute validation episode that passes creative, technical, cost, recovery, and release gates.

### Documentation and release

- **AT-033:** Change a requirement in a test branch without traceability/documentation updates; quality check fails.
- **AT-034:** Package/install/upgrade/rollback on a clean supported Windows environment without losing projects or credentials.
- **AT-035:** Representative non-technical user completes setup, pilot generation, review, termination confirmation, backup, and restore without terminal assistance.

### Writing providers, skills, and media viewing

- **AT-036:** Connect test OpenAI, Anthropic, and Gemini accounts independently, switch the writing provider for equivalent fixtures, and prove canonical story/character/script records remain provider-neutral while keys never enter renderer state, projects, logs, exports, or skill input.
- **AT-037:** Attach required and optional fixture skills, run matching and non-matching tasks, and prove routing, declared permissions, output validation, timeout/failure behavior, exact-version receipts, and the user-visible `Skills used` list. A deliberately ignored required skill must fail the job.
- **AT-038:** Generate fixture image/audio/video artifacts through a mocked headless ComfyUI worker, close the worker, and prove the studio still displays, plays, compares, approves, rejects, and retakes locally verified media without opening ComfyUI.
- **AT-039:** Run locked story, character, and script benchmarks through each supported writing profile; record quality review, token usage, actual API cost, context selection, and continuity differences before choosing defaults.
- **AT-040:** Interrupt preview and proxy creation, then prove originals and manifests remain unchanged and local review recovers by rebuilding derived media.
- **AT-041:** Change a locked character from one visual style to another, approve a new multi-view consistency board, and apply it separately to a shot, episode, and future season. Verify identity anchors remain acceptable, prior outputs/bindings are unchanged, only the selected scope becomes stale/rebound, and the impact/cost preview is accurate.
- **AT-042:** Assemble a timed animatic from locked storyboard frames and approved dialogue, revise one shot duration, and prove version history, total timing, captions, dependency impact, and deterministic rebuild remain correct without generating final video.
- **AT-043:** Bind pose, depth, edge, mask, motion-track, start/end-frame, and reference-clip fixtures to neutral shots; compile supported roles exactly and reject unsupported, wrong-project, unapproved, rights-missing, dimension/time-base, and hash-mismatch controls before spend.
- **AT-044:** Create a layered foreground/subject/background composite, detect a mask/occlusion defect, repair the derivative, and prove the approved source image is unchanged while deterministic parallax output and lineage remain valid.
- **AT-045:** Benchmark compatible LTX control, reference-video, in/outpaint/relight, multishot, DFR, and temporal-upsample candidates. Cross-version or unavailable adapters must remain disabled; every accepted profile records quality, VRAM, runtime, cost, workflow/model/node hashes, and fallback.
- **AT-046:** Inject known identity drift, continuity mismatch, flicker, bad motion, face/hand/text defects, lip-timing error, and script-versus-speech mismatch. Creative-QC reports the expected evidence while false-positive fixtures remain reviewable and no checker can approve/reject/repair/release media.
- **AT-047:** Import and generate rights-safe ambience/foley fixtures, align them to picture, and prove dialogue/music masters remain byte-identical, source/model/rights lineage is complete, incompatible LTX adapters are blocked, and failed candidates do not overwrite approved cues.
- **AT-048:** After the reference-only identity fixture fails its declared threshold, explicitly authorize a project-scoped adaptation, train/evaluate a candidate, reject a regressing fixture, promote a passing fixture prospectively, and roll back without changing historical manifests or another project.
- **AT-049:** Submit production jobs that request ComfyUI Manager, Git, pip/package installation, model download, unknown nodes, or unpinned workflow changes; the worker rejects/quarantines them and the last production image remains unchanged and rollback-capable.

### YouTube packaging and learning

- **AT-050:** Create two release-profile versions, bind them to two series plus a project-local film brief, and prove channel voice, links, blocked claims, thumbnails, metadata, ideas, and later analytics cannot cross scope without an explicit bind/copy operation. Add manual/imported trend and competitor signals with dates/sources; prove they cannot create an episode, rewrite continuity, or queue paid work without a separate human production decision.
- **AT-051:** Create/import representative thumbnail candidates from approved frames and references; verify exact local typography, source/rights/cost lineage, platform format/dimension/size rules, desktop/phone previews, and rejection of corrupt, misleading, wrong-project, stale-character, clipped, or unreadable fixtures.
- **AT-052:** Review several local thumbnail/title candidates and prove the UI calls them candidates, retains their hypotheses/hashes, selects only one for the package, and never claims a live A/B winner. Import a real/signed fixture result and link it only to the exact tested candidate hashes.
- **AT-053:** Build release details from the locked master/timeline; detect excessive/missing fields, keyword stuffing, unrelated claims, unsupported links, `00:00`/ordering/minimum-duration chapter errors, caption-language mismatch, and chapter times beyond the final duration. A corrected package remains deterministic.
- **AT-054:** Attempt release with each audience, synthetic-media, truthfulness, originality, rights/credits, and human-watch attestation unresolved. Every case blocks with guidance; no default value or model output can complete the attestation.
- **AT-055:** Lock a release package, verify every file/hash and copy-ready field on a clean machine, then change a title, thumbnail, caption, chapter, master, and attestation separately. Each change creates a new package version and leaves the prior version byte-identifiable and unchanged.
- **AT-056:** Attach a manual YouTube ID and import 24-hour/7-day/28-day real, partial, malformed, low-sample, and rehearsal fixtures. Preserve source/window/metric/version evidence, exclude simulated/rehearsal data from baselines, and deny wrong-profile/project data.
- **AT-057:** Generate learning proposals from comparable profile releases, display observation/inference/confidence/evidence separately, approve one for one named future scope, reject another, and prove neither can rewrite locked creative records, switch live metadata, or start a paid job.
- **AT-058:** Run Prepared Studio/Release Readiness with healthy, stale, skipped-paid-probe, and blocking-failure fixtures. The view gives plain remediation, blocks only the affected action, leaves unrelated local work available, and never spends on an unapproved probe.

## 5. Human benchmark rubrics

### Image identity

- Face/defining features preserved.
- Body proportions and silhouette within style tolerance.
- Palette, hair, wardrobe, and signature details correct.
- Multi-character composition does not merge identities.
- No unintended text, watermark, or anatomy artifact accepted.

### Voice identity

- Same perceived speaker across neutral/emotional lines.
- Required language/accent intelligible and stable.
- Names/terms pronounced according to dictionary.
- Delivery matches line note without changing identity.
- No cloning/reference use outside recorded rights.

### Video continuity

- Identity, wardrobe, location, prop state, and lighting match pinned references.
- Action and camera intent are understandable.
- No unacceptable morphing, hands, object, text, or background artifacts.
- Dialogue performance and mouth movement are acceptable for shot visibility.
- First/last composition cuts cleanly with neighbors.

Rubric thresholds are established with pilot examples and versioned. Automated scores support review but cannot replace it.

## 6. Performance and cost tests

For each compatibility row capture:

- Cold start, model load, P50/P90 job runtime.
- Peak VRAM/RAM/disk.
- Transfer rates and sync overhead.
- Attempts to approval and failure distribution.
- Cost per attempt, approved second, shot type, and workflow.
- Writing-provider input/output tokens, skill/tool/context overhead, latency, actual API cost, and accepted-draft rate by task/profile.
- One/two/three-worker scaling efficiency.

Regression thresholds are set after Phase 0. A material regression blocks default promotion even if output still renders.

## 7. Security tests

- Credential-vault and renderer-boundary inspection.
- Secret-pattern scan of logs, project export, manifests, crash dumps, support bundles.
- OAuth scope/token non-leakage, revocation, wrong-channel/profile binding, imported-report validation, and read-only connector mutation-denial tests.
- Gateway authentication, expiry, wrong-project token, replay, and permission tests.
- Path traversal, symlink/junction escape, oversized upload, wrong MIME/hash.
- Port scan proving no public ComfyUI/model service.
- Tampered workflow/model/image capability rejection.
- Provider API idempotency and least-privilege failure tests.
- Malicious/corrupt upstream fixture isolation.
- OpenAI/Anthropic/Gemini key isolation, renderer/skill non-disclosure, task-context minimization, controlled-catalogue rejection, and provider-switch lineage tests.
- External-skill quarantine, manifest/schema/signature state, permission scope, path/network denial, timeout/output limits, required-receipt enforcement, update/rollback, and project-isolation tests.
- Production-runtime immutability tests for disabled Manager/install/update paths, pinned control/QC/audio/adaptation dependencies, and quarantine on missing nodes/models.
- Control/reference/adaptation dataset rights and cross-project isolation tests plus denial of creative-QC approval mutations.
- Local media protocol authorization, path escape, MIME/hash mismatch, corrupt media, preview spoofing, and immutable-original/proxy-rebuild tests.

## 8. Release evidence

Each release stores:

- Compatibility matrix and exact pins.
- Automated test summary.
- GPU benchmark and cost summary.
- Security scan/SBOM summary.
- Backup/restore evidence.
- Usability result.
- Pilot/full-episode evidence appropriate to release stage.
- Verified release-package inventory, thumbnail/release-details/chapter validation, policy-attestation evidence, and clean-machine copy/upload-checklist review.
- Known limitations and rollback version.
- Updated status, sources, decisions, traceability, and changelog.

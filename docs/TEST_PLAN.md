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
- Valid and intentionally invalid upstream JSON for every skill.
- Corrupt/truncated media, wrong hashes, missing files, bad captions, clipped/silent audio.
- Mock provider responses for success, timeout-after-create, rate change, capacity failure, termination delay, and billing discrepancy.

Creative benchmark references are locked by hash. Changing them is a test-version change documented in the changelog.

## 4. Core acceptance tests

### Project and continuity

- **AT-001:** Create, close, reopen, back up, and restore a series and a film with no data loss.
- **AT-002:** Attempt to open/copy an asset from the wrong project; access is denied unless using explicit copy, and lineage is preserved.
- **AT-003:** Lock character v1, create dependent shots/takes, create character v2, and verify only the correct dependants become stale while v1 history remains intact.
- **AT-004:** Interrupt an atomic write and a migration at each failure point; startup restores or reconciles without corrupting the active project.

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
- One/two/three-worker scaling efficiency.

Regression thresholds are set after Phase 0. A material regression blocks default promotion even if output still renders.

## 7. Security tests

- Credential-vault and renderer-boundary inspection.
- Secret-pattern scan of logs, project export, manifests, crash dumps, support bundles.
- Gateway authentication, expiry, wrong-project token, replay, and permission tests.
- Path traversal, symlink/junction escape, oversized upload, wrong MIME/hash.
- Port scan proving no public ComfyUI/model service.
- Tampered workflow/model/image capability rejection.
- Provider API idempotency and least-privilege failure tests.
- Malicious/corrupt upstream fixture isolation.

## 8. Release evidence

Each release stores:

- Compatibility matrix and exact pins.
- Automated test summary.
- GPU benchmark and cost summary.
- Security scan/SBOM summary.
- Backup/restore evidence.
- Usability result.
- Pilot/full-episode evidence appropriate to release stage.
- Known limitations and rollback version.
- Updated status, sources, decisions, traceability, and changelog.

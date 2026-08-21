# Pinned upstream integration

## 1. Purpose

`shuohao-skills` supplies useful pre-production workflows and deterministic validators. Animated Series Studio remains a separate product because its long-form project management, GPU orchestration, model workflows, versioning, recovery, costs, and editing are outside the upstream repository's scope.

The connection is a Git submodule:

```text
vendor/shuohao-skills
```

This gives three protections:

- Studio code and documentation are outside the upstream checkout.
- The active upstream version is an exact commit, not whatever changed remotely today.
- Updates can be fetched, tested, accepted, or rolled back explicitly.

## 2. Current supported baseline

| Item | Value |
| --- | --- |
| Source | `https://github.com/eternityspring/shuohao-skills.git` |
| Pinned commit | `4cff5ae3a4a2d2b5d13161f5a2378c5910be7cad` |
| Lock file | `config/upstream.lock.json` |
| Verified | 2026-08-21 |
| Upstream self-tests | Six skill self-tests passed |
| Combined report self-test | Passed |
| Studio adapter contract tests | Not implemented yet; required in Phase 2 |

The submodule Git commit and lock-file commit must match.

## 3. Consumed upstream capabilities

| Upstream area | Studio use |
| --- | --- |
| `novel-outline` | Adaptation facts, characters, scenes, props, beats, episode synopsis |
| `novel-characters` | Character profiles, image/style prompts, voice-design prompts, model-sheet intent |
| `novel-art` | Locations, lighting/state variants, props, consistency anchors |
| `novel-script` | Scene/beat flow, line IDs, speaker/delivery, duration inputs, line book |
| `novel-storyboard` | Segment/cut/source-beat mapping, frames, shot/camera intent, timing suggestions |
| `shot-recipes` | Optional shot vocabulary and auditable prompt phrases |
| Combined report | Human-readable source inspection |

The adapter invokes public scripts as separate processes. It does not import private functions from upstream files.

## 4. Known boundary differences

### Short drama versus 20–35 minute episodes

The upstream system was built and tested around AI short-drama production. Its outline/script/storyboard assumptions and examples are not automatically long-form animation rules. The studio imports source decisions, then adds acts/sequences and a long-form editorial plan.

### MiniMax H3 versus LTX

The upstream storyboard creates H3 alignment prompts and uses H3 camera vocabulary. The studio:

- Preserves `h3Prompt` and associated files as source provenance.
- Imports cuts, beats, composition, camera, characters, props, and reference frames as suggestions/facts.
- Builds a new engine-neutral `Shot` and production method.
- Compiles a versioned LTX workflow from studio-owned canonical data.

H3 strings are never sent to LTX blindly.

### Cut timing

The upstream storyboard hard-gates 2–5 second cuts and up-to-15-second generation segments. The studio may retain that for energetic sequences, but supports longer holds, reactions, loops, dialogue framing, and editorial camera movement. It does not patch upstream validation to pretend the rules changed.

### Language

Upstream reports can render English labels, but some canonical character content is intentionally Chinese-first. The studio preserves original fields/evidence and creates a normalized language-aware display/production layer. Translation is a derived version with provenance, not a silent rewrite of quoted evidence.

### Image generation

Upstream skills may use an agent-provided image generator. The studio treats upstream image prompts and existing outputs as inputs/references, while production image generation uses the pinned Qwen workflow and its own manifests.

## 5. Import process

1. Inspect submodule/lock/adapter compatibility.
2. Copy selected upstream JSON/report/source files into the project's immutable `source/shuohao/<import-id>/` folder.
3. Hash copied files and record source commit.
4. Run applicable upstream validation against the copies.
5. Parse through versioned studio schemas.
6. Produce normalization preview: IDs, language, duration, missing fields, long-form changes, H3 provenance.
7. User accepts import.
8. Create studio-owned versions and source-alias mappings.
9. Run studio long-form/continuity validation.

Re-import creates a new source/import version; it never overwrites a previous import.

## 6. Update process

Normal operation does not run `git pull` inside the submodule. Use:

```powershell
./scripts/update-upstream.ps1
```

The default is preview-only. It fetches upstream and reports current/candidate commits. To test and stage the candidate:

```powershell
./scripts/update-upstream.ps1 -Apply
```

Required automated sequence:

1. Refuse if the studio or submodule has conflicting local changes.
2. Fetch source and resolve candidate commit.
3. Save current commit/lock as rollback point.
4. Check out candidate in detached state.
5. Run all upstream self-tests and combined report test.
6. Run studio upstream-adapter contract tests when implemented.
7. Run documentation checks.
8. On any failure, restore previous submodule commit and leave lock unchanged.
9. On success, update lock file and stage submodule/lock changes for review.

Acceptance is not complete until a human/agent reviews upstream changes for schema, prompt, report, license, and behavioral impact and updates:

- Adapter/fixtures/tests as needed.
- `SOURCES.md` and `DECISIONS.md` where assumptions changed.
- Compatibility matrix.
- `CHANGELOG.md` with impact and rollback.

## 7. Project behavior after upstream update

- Existing imports retain their source commit and normalized versions.
- Existing approved outputs and manifests do not change.
- New imports use the new default only after acceptance.
- Re-normalizing an old import is an explicit migration/new version with impact preview.
- The previous supported submodule commit remains documented for rollback until the next release is proven.

## 8. Compatibility suite requirements

Phase 2 must add fixtures for:

- Minimum/complete valid output from each skill.
- Current bundled examples.
- Invalid references, language, duration, missing optional blocks, and version boundaries.
- Combined report invocation.
- Long-form normalization of episode/sequence/shot timing.
- H3 prompt preservation but non-execution.
- C/S/P/E source alias mapping.
- Changes in render-only output that do not alter imported facts.

The suite outputs a machine-readable comparison of schema and normalized behavior between current and candidate commits.

## 9. Licensing and attribution

The upstream repository is currently Apache-2.0 and contains `LICENSE` and `NOTICE`. Distributed studio packages must preserve required license/notice material for any vendored or incorporated upstream work. A license change is an update blocker until reviewed and documented.

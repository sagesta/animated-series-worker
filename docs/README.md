# Documentation map

This folder is the authoritative build specification for Animated Series Studio. If code and documentation disagree, the change is incomplete until they are reconciled and tested.

Current version 0.8.0 implements the local project/backup/migration foundation, shared required-field/length/range guidance with accessible correction popups, protected RunPod account checks, a project-local versioned Audience & Creative Direction profile, a protected GPT/Claude/Gemini Creative Room, and the first safe declarative external-skill slice. Skill files are quarantined and parsed without execution, enabled per project, included through an exact previewed plan, validated against declared proposal-section requirements, and recorded with package hashes and receipts. Executable/MCP skills, media generation, canon promotion/version comparison, release packaging, and analytics remain planned.

## Product and experience

| Document | Answers |
| --- | --- |
| [PRD](PRD.md) | What is being built, for whom, and what counts as success? |
| [UX specification](UX_SPEC.md) | What does a non-technical creator see and do? |
| [Audience and creative direction](CREATIVE_DIRECTION_PROFILE.md) | How do audience, niche, tone, themes, style, boundaries, and positioning consistently guide every later stage without becoming canon or a platform declaration? |
| [Production workflow](PRODUCTION_WORKFLOW.md) | How does an idea become an approved YouTube episode or one-off film? |
| [YouTube release workflow](YOUTUBE_RELEASE_WORKFLOW.md) | Which thumbnail, release-details, research, policy, packaging, and learning features were adopted after the reference-repository review? |
| [Status](STATUS.md) | What exists now, what is being built, and what is not yet safe to claim? |
| [Glossary](GLOSSARY.md) | What do the specialist terms mean in plain language? |

## Engineering

| Document | Answers |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | What are the system boundaries, components, data flows, and technology choices? |
| [Domain model](DOMAIN_MODEL.md) | How are projects, characters, voices, shots, versions, approvals, and dependencies represented? |
| [API contracts](API_CONTRACTS.md) | How do the desktop app, upstream adapter, worker, provider, and media engines communicate? |
| [Media pipeline](MEDIA_PIPELINE.md) | How are images, voices, animation, lip-sync, sound, captions, and final exports produced? |
| [GPU operations](GPU_OPERATIONS.md) | How is rented compute provisioned, secured, monitored, and terminated automatically? |
| [Security and recovery](SECURITY_AND_RECOVERY.md) | How are secrets, creative assets, backups, failures, and restore procedures handled? |

## Delivery and governance

| Document | Answers |
| --- | --- |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | In what order will the full system be built and gated? |
| [Master build backlog](BUILD_BACKLOG.md) | What work is stacked, what is next, and what proof closes each item? |
| [Test plan](TEST_PLAN.md) | What must be proven before money, assets, or releases are trusted? |
| [Cost model](COST_MODEL.md) | How are episode cost, storage, retries, and multiple GPUs forecast and measured? |
| [Traceability](TRACEABILITY.md) | Where is every requirement designed and tested? |
| [Decisions](DECISIONS.md) | Which choices are locked, why, and what would justify changing them? |
| [Upstream integration](UPSTREAM_INTEGRATION.md) | How can upstream skills be updated without silently changing the studio? |
| [Change control](CHANGE_CONTROL.md) | How are features, fixes, migrations, and documentation kept synchronized? |
| [Sources](SOURCES.md) | Which external capabilities, limits, prices, licenses, and delivery settings were verified? |

## Authority order

When statements conflict, resolve them in this order:

1. Accepted decisions in `DECISIONS.md`.
2. Requirements and acceptance criteria in `PRD.md`.
3. Contracts and data rules in `ARCHITECTURE.md`, `DOMAIN_MODEL.md`, and `API_CONTRACTS.md`.
4. Operational and implementation documents.
5. Examples and explanatory prose.

Do not quietly choose one. Record the resolution in `CHANGELOG.md` and update every affected document in the same change.

## Baseline assumptions

- Primary user: one non-technical creator on Windows.
- Project types: multiple independent series and one-off films.
- Typical episode: 20–35 minutes.
- Visual target: stylized 2D or 3D-look animation, not a requirement for photorealistic humans.
- Local machine: capable of running the desktop application but not assumed to have a production GPU.
- Cloud: temporary GPU workers; local files remain authoritative.
- Video engine: LTX-2.5 only in version 1.
- Image engine: Qwen-Image/Qwen-Image-Edit initial baseline, behind an adapter.
- Voice engine: Qwen3-TTS initial baseline, behind an adapter.
- GPU provider: RunPod first, behind an adapter.
- Editor: automatic rough assembly and export; optional handoff to an external editor.
- Previsualization/control: versioned timed animatics, engine-neutral control packs, layered parallax, advanced benchmark-approved LTX profiles, warning-only creative QC, and separate rights-aware foley.
- Production workers are immutable: no runtime “install missing nodes,” model, or package updates.

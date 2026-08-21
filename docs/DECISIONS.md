# Architecture and product decisions

Decisions are locked for the current baseline. A reversal requires an entry describing the new evidence, affected requirements, migration, compatibility impact, tests, documentation, and rollback.

| ID | Status | Decision | Reason | Revisit when |
| --- | --- | --- | --- | --- |
| D-001 | Accepted | Keep this studio in its own Git repository and consume `shuohao-skills` as a pinned submodule. | Ordinary upstream pulls cannot overwrite custom work or silently alter production behavior. | The upstream project publishes a stable package/API with equivalent pinning and compatibility guarantees. |
| D-002 | Accepted | Never edit the vendored upstream checkout. Adapt through a studio-owned boundary. | Preserves clean upgrades, attribution, rollback, and upstream self-containment. | Never for ordinary features; only a documented emergency fork could supersede this. |
| D-003 | Accepted | Use a local-first Windows desktop app built with Electron, React, and TypeScript. | It supports a single installer, Node integration with existing scripts, local files, credential-vault access, and a non-technical interface. | A packaged local web app proves materially simpler without weakening file, secret, or process control. |
| D-004 | Accepted | Use SQLite as a rebuildable local index; files and versioned manifests remain the creative source of truth. | Transactional queues and dependencies need a database, while portable files prevent lock-in and aid recovery. | Scale or collaboration requires a server database. |
| D-005 | Accepted | Use LTX-2.5 as the only version-1 video engine; do not install or operate Wan. | It covers image/video/audio conditioning, fast drafts, production paths, retake, keyframes, and lip-dub within one model family. Fewer engines reduce setup and user confusion. | The locked pilot shows an unacceptable shot class that LTX cannot handle, or licensing/hardware changes make it unsuitable. |
| D-006 | Accepted | Keep a versioned `VideoEngine` interface even though only LTX is installed. | A future engine can be added without contaminating canonical story and continuity data. | Never remove; it is a low-cost boundary. |
| D-007 | Accepted | Use Qwen-Image and Qwen-Image-Edit as the initial image family. | Official releases provide generation, editing, multiple-image conditioning, improved consistency, ComfyUI support, and Apache-2.0 licensing. | The character-board benchmark fails or a better commercially usable model wins the locked test pack. |
| D-008 | Accepted | Use Qwen3-TTS as the initial TTS family and save reusable, rights-cleared voice conditioning. | It supports voice design, controlled speech, reusable voice-clone prompts, multiple languages, and Apache-2.0 licensing. | Voice consistency, pronunciation, language, performance, or license gates fail. |
| D-009 | Accepted | Generate recurring dialogue audio first, approve it, and then condition video on that exact audio. | The voice must not be reinvented independently by each video generation. | A validated joint model proves equally controllable and preserves locked character voice identity. |
| D-010 | Accepted | Use RunPod as the first provider through a `GPUProvider` interface. | Templates, REST lifecycle control, persistent network volumes, and temporary GPUs match the one-click requirement. | Availability, support, security, or measured cost fails; the provider interface then permits replacement. |
| D-011 | Accepted | Use temporary Pods with a persistent network model cache for version 1, not serverless first. | Large models, debugging, workflow visibility, and predictable sessions are simpler initially. Automatic creation and termination still hide infrastructure from the user. | Stable benchmarks show serverless cold starts and pricing are better for this workload. |
| D-012 | Accepted | The remote worker is a versioned Docker image with an authenticated gateway; ComfyUI binds only to loopback. | Reproducible setup and a narrow security boundary are safer than exposing ComfyUI directly. | The inference layer no longer uses ComfyUI. The authenticated gateway remains required. |
| D-013 | Accepted | Use human approval gates before character, voice, style, storyboard, bulk generation, and final release locks. | Creative errors become far more expensive when multiplied across hundreds of shots. | Never remove globally; individual gates may gain safe batch approval. |
| D-014 | Accepted | Use hybrid editorial construction rather than generating every final second. | Stylized animation benefits from controlled holds, loops, parallax, reactions, and reusable material; this reduces cost and improves continuity. | A future model makes full-duration generation demonstrably cheaper and more consistent. |
| D-015 | Accepted | Treat series and one-off films as the same `Project` aggregate with different organization. | Both need the same bibles, shot jobs, approvals, continuity, costs, and exports. | Their workflows diverge enough to require separate products. |
| D-016 | Accepted | Do not automatically publish to YouTube in version 1. Produce a verified upload package instead. | Public publishing has account, title, rights, timing, and irreversible audience consequences outside the generation problem. | A separate reviewed publishing feature is approved. |
| D-017 | Accepted | Default delivery is 1920×1080, 16:9, 24 fps, SDR BT.709, H.264 video, AAC-LC 48 kHz stereo, with captions. | It is broadly compatible and matches the planned cinematic animation cadence and YouTube guidance. | A project deliberately selects another delivery profile and passes QC. |
| D-018 | Accepted | Model, workflow, adapter, schema, and upstream updates apply prospectively; existing approved outputs keep their original manifests. | Reproducibility requires history not to mutate when defaults improve. | Never; a new render is a new take/version. |
| D-019 | Accepted | Documentation changes are part of the same feature or fix, with no code-only behavioral hotfix exception. | The user explicitly requires future fixes to keep the plan accurate, and drift is most dangerous during emergency work. | Never; an emergency rollback can precede the completed incident change, but closure still includes docs and tests. |

## Open implementation selections

These choices must be resolved by the named phase rather than guessed during coding:

| ID | Decision needed | Resolution gate |
| --- | --- | --- |
| O-001 | Exact compatible 48GB/80GB GPU allowlist and preferred order | Phase 0 benchmark on current provider inventory |
| O-002 | Exact Qwen image checkpoint, quantization, and ComfyUI workflow | Character-consistency benchmark |
| O-003 | Exact LTX checkpoints, precision, draft/final dimensions, and workflow parameters | LTX 20-shot benchmark |
| O-004 | Local versus remote default for Qwen3-TTS on the user's actual computer | Voice benchmark and local hardware probe |
| O-005 | Supported external-editor interchange format in version 1 | Editorial spike before Phase 7 |
| O-006 | Music and effects source/library | Rights and workflow review before full pilot episode |

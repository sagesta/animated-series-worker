# Verified external sources and assumptions

Last verified: 2026-08-21

External models, APIs, prices, licenses, and platform recommendations can change. These links support the current baseline; implementation and every relevant update must reverify exact versions and terms. This document is technical evidence, not legal advice.

## Desktop foundation

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Electron security | Current Electron guidance recommends context isolation, renderer sandboxing, no Node integration for untrusted renderer content, restrictive content security policy, limited navigation/window creation, and IPC sender validation. | [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), [process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) |
| Electron application protocol | Electron recommends avoiding `file://` privileges where practical; the packaged renderer is therefore served from the restricted `studio://app` protocol. | [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), [protocol API](https://www.electronjs.org/docs/latest/api/protocol) |
| Electron secure storage | Electron `safeStorage` encrypts strings using operating-system cryptography; on Windows both the synchronous and recommended asynchronous implementations protect keys with DPAPI. Electron notes that this protects against other users on the machine, not malicious applications running as the same user. | [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) |
| Local SQLite | Node's built-in `node:sqlite` module is available in the Node generation bundled by Electron 43 and provides `DatabaseSync`, prepared statements, and transactions without a separately compiled add-on. Its current Node documentation still identifies the API as release-candidate stability. | [Node SQLite API](https://nodejs.org/api/sqlite.html), [Electron 43 release](https://www.electronjs.org/blog/electron-43-0) |
| Desktop build system | Electron Vite documents separate main, preload, and renderer builds; its dependency guidance supports bundling preload dependencies required by a sandboxed preload. | [Electron Vite guide](https://electron-vite.org/guide/), [dependency handling](https://electron-vite.org/guide/dependency-handling), [distribution](https://electron-vite.org/guide/distribution) |

Implementation consequence: Electron is pinned at 43.4.1, Electron Vite at 5.0.0, Vite at compatible 7.3.6, and TypeScript at 5.9.3. The main process owns SQLite, files, provider calls, and `safeStorage`; the renderer receives only named schema-validated methods through the preload bridge and never receives a saved key value.

## Writing APIs and external skills

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| OpenAI Responses | The Responses API accepts text/image inputs, can return text or structured JSON, and supports built-in tools, MCP tools, and typed custom function calls with configurable tool choice. | [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) |
| OpenAI model availability | The authenticated models resource is the connection-time source of models available to the supplied account; model availability changes, so the studio does not hardcode an unbenchmarked default. | [OpenAI models API](https://developers.openai.com/api/reference/typescript/resources/models/methods/retrieve), [current model catalogue](https://developers.openai.com/api/docs/models) |
| Anthropic models and Messages | Anthropic documents an authenticated model-list endpoint and the Messages create endpoint with explicit model, system/message content, maximum tokens, and usage. | [List Models](https://platform.claude.com/docs/en/api/models/list), [Create a Message](https://platform.claude.com/docs/en/api/messages/create) |
| Anthropic structured output | Current Anthropic structured output uses `output_config.format` with a JSON schema; refusals and token-limit endings still require application handling. | [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Claude tool use | Claude's Messages API supports declared client/server tools; Claude returns a structured tool call and the application executes and returns client-tool results. | [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) |
| MCP interoperability | MCP is an open standard for connecting AI applications to external data, tools, and workflows and is supported across multiple AI clients. | [Model Context Protocol introduction](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro) |

Implementation consequence: the studio uses provider-neutral writing tasks with OpenAI and Anthropic adapters rather than making either provider's conversation the project database. Version 0.4.0 uses model-list reads for no-cost key validation, OpenAI `POST /responses` with `store: false`, and Anthropic `POST /v1/messages` with structured output. It parses supported output blocks, refuses partial/unreadable structures, records usage/request IDs locally, and leaves dollar cost uncalculated until versioned price profiles and live benchmarks exist. External skill selection/receipts remain planned and are explicitly empty in current proposal records.

## LTX

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Open-source overview | LTX-2.5 supports text/image/video inputs, synchronized audio/video, and native multi-shot positioning in the current documentation. | [LTX open-source overview](https://docs.ltx.io/open-source-model/getting-started/overview) |
| ComfyUI | LTX documents ready-made ComfyUI templates and automatic model downloads; current prerequisites list CUDA GPU with 32GB+ VRAM, 100GB+ storage, and Python 3.12+. | [Using ComfyUI with LTX](https://docs.ltx.io/open-source-model/integration-tools/comfy-ui) |
| Hardware | Current open-source requirements list 32GB minimum VRAM and recommend A100/H100 80GB class hardware plus larger storage headroom. | [LTX system requirements](https://docs.ltx.io/open-source-model/getting-started/system-requirements) |
| Pipelines | Official pipelines include production/draft text/image-to-video, audio+image-to-video, keyframes, retake, and lip-dub/re-voice paths. | [LTX pipelines overview](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/README.md), [pipeline details](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/docs/pipelines.md) |
| Audio conditioning | The A2V pipeline is documented for video generation conditioned on input audio and optional image conditioning. | [LTX PyTorch API](https://docs.ltx.io/open-source-model/integration-tools/pytorch-api) |
| Advanced control/fidelity | Current LTX documentation describes IC-LoRA reference/control inputs, sparse motion tracks, structural control signals, in/outpainting, relight, native multishot, Diffusion Fidelity Rendering, and optional temporal upsampling. Exact adapters still require compatibility benchmarks. | [LTX IC-LoRA](https://docs.ltx.io/open-source-model/usage-guides/ic-lo-ra), [motion control](https://docs.ltx.io/open-source-model/feature-guides/structural-control/motion-control), [pipeline details](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/docs/pipelines.md) |
| Dub-It/Foley compatibility | Current official Dub-It and Foley guides state those adapters are validated on LTX-2.3 while LTX-2.5 support is in development. They therefore cannot be assumed compatible with the version-1 LTX-2.5 pin. | [Dub-It beta](https://docs.ltx.io/open-source-model/feature-guides/audio/dub-it-beta), [video-to-audio Foley](https://docs.ltx.io/open-source-model/feature-guides/audio/video-to-audio-foley) |
| License | The current LTX-2 community license and model card include commercial-use conditions tied to organization revenue; this must be rechecked for the user's entity and exact model files before monetized release. | [LTX-2 license](https://github.com/Lightricks/LTX-2/blob/main/LICENSE.md), [LTX-2.5 model card](https://huggingface.co/Lightricks/LTX-2.5) |

Design consequence: version 1 uses only LTX video, but pins exact open-source model/workflow versions and requires a license check. Hosted LTX API capabilities are not assumed to exist identically in the open-source worker.

## Qwen image and voice

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Qwen-Image | Official repository documents image generation/editing, multi-image input in later edit releases, improved character consistency, native ComfyUI support, and Apache-2.0 licensing. | [Qwen-Image official repository](https://github.com/QwenLM/Qwen-Image) |
| Qwen layered images | The current official Qwen-Image repository includes Qwen-Image-Layered among the released image assets. Its suitability for production layer separation/parallax still requires the locked benchmark. | [Qwen-Image official repository](https://github.com/QwenLM/Qwen-Image) |
| Qwen-Image ComfyUI | Official ComfyUI documentation includes a native Qwen-Image workflow and identifies the open model/license. | [ComfyUI Qwen-Image tutorial source](https://github.com/Comfy-Org/docs/blob/main/tutorials/image/qwen/qwen-image.mdx) |
| Qwen3-TTS | Official repository documents 0.6B/1.7B models, voice design, custom voices, reusable voice-clone prompts, multiple languages, Python 3.12 guidance, and Apache-2.0 licensing. | [Qwen3-TTS official repository](https://github.com/QwenLM/Qwen3-TTS) |

Design consequence: Qwen families are initial defaults behind adapters. Human benchmarks still decide exact checkpoints/quantization and acceptable recurring identity.

## ComfyUI

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Workflow server | ComfyUI can run headlessly without opening a browser; its self-hosted server accepts workflows, uploads/downloads files, and communicates status, progress, errors, previews, and completed output through HTTP/WebSocket mechanisms. | [ComfyUI server overview](https://docs.comfy.org/development/comfyui-server/comms_overview), [server messages](https://docs.comfy.org/development/comfyui-server/comms_messages) |
| Workflow format | Official documentation describes API-format workflows as JSON node graphs and asynchronous job handling. | [ComfyUI API overview](https://docs.comfy.org/development/cloud/overview) |
| Custom-node management risk | ComfyUI Manager can install missing node packs, while official troubleshooting documents dependency-version and frontend conflicts. The production design therefore permits controlled build-time installation only, not runtime repair. | [ComfyUI Manager node management](https://docs.comfy.org/manager/pack-management), [custom-node troubleshooting](https://docs.comfy.org/troubleshooting/custom-node-issues) |

Design consequence: ComfyUI is a headless, loopback-only worker engine behind the studio gateway; its browser graph and native public/cloud API are not the creator interface or studio security boundary. Verified outputs are downloaded to the local project and reviewed through the studio's own gallery/player.

## RunPod

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Current management API | RunPod REST API v2 uses base URL `https://api.runpod.io/v2`, bearer API-key authentication, and standard JSON responses. RunPod states REST v1 is deprecated and will retire November 15, 2026, so new studio calls use v2. | [API v2 overview](https://docs.runpod.io/api-reference-v2/overview), [API-key management](https://docs.runpod.io/get-started/api-keys) |
| No-cost account validation | API v2 `GET /v2/pods` returns Pods owned by the authenticated user and does not create or change a resource. Version 0.3.0 uses only aggregate count/status/current-rate fields and discards provider resource details. | [List Pods API v2](https://docs.runpod.io/api-reference-v2/pods/list-pods) |
| GPU planning prices | API v2 `GET /v2/catalog/gpus` returns GPU memory and separate secure/community list prices; the price is per single GPU per hour, while the actual Pod reports its current billed rate. | [List GPU types API v2](https://docs.runpod.io/api-reference-v2/catalog/list-gpu-types) |
| Pod lifecycle/API | RunPod documents creating and managing Pods through API v2, including permanent termination. Those mutating operations remain unimplemented and locked in version 0.3.0. | [Create Pod API v2](https://docs.runpod.io/api-reference-v2/pods/create-a-pod), [Pod state transition API v2](https://docs.runpod.io/api-reference-v2/pods/trigger-a-pod-state-transition), [Terminate Pod API v2](https://docs.runpod.io/api-reference-v2/pods/terminate-a-pod) |
| Templates | Custom templates can preinstall dependencies/models so repeated workers do not require manual setup. | [Custom Pod templates](https://docs.runpod.io/pods/templates/create-custom-template), [Manage templates](https://docs.runpod.io/pods/templates/manage-templates) |
| Persistent storage | Network volumes persist independently of compute and can be attached to new Pods; current published first-terabyte price is $0.07/GB/month. | [Network volumes](https://docs.runpod.io/storage/network-volumes), [storage types](https://docs.runpod.io/pods/storage/types) |
| Stop/terminate detail | Current Pod docs state stopped Pods preserve volume-disk data and still incur storage; Pods with a network volume are terminated rather than stopped while the network volume persists. | [Manage Pods](https://docs.runpod.io/pods/manage-pods) |
| Scale to zero | RunPod documents configurations with zero minimum workers and idle timeout for no idle compute usage; this remains a future benchmark decision. | [RunPod scale-to-zero guidance](https://docs.runpod.io/flash/configuration/best-practices) |

Design consequence: version 0.3.0 can validate/store/refresh/remove an API key and read current planning prices, but cannot mutate any RunPod resource. Version 1 will create/terminate temporary Pods from a pinned template and keep only a model cache on a network volume after the worker/watchdog gates pass. Prices are refreshed before every future quote and approval.

## YouTube delivery, packaging, policy, and analytics

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Upload settings | Current YouTube guidance lists MP4, H.264, progressive scan, 4:2:0, same recorded frame rate, AAC-LC/other accepted audio at 48kHz, BT.709 for SDR, and an 8 Mbps reference bitrate for 1080p standard frame rates. | [YouTube recommended upload encoding settings](https://support.google.com/youtube/answer/1722171?hl=en) |
| Public thumbnail | Current YouTube Help recommends a large 16:9 JPG/GIF/PNG image, currently 3840×2160 with a minimum width of 640 pixels. It lists different upload-size limits by device, so the studio uses a versioned export profile rather than copying one permanent hard-coded limit. | [Add custom thumbnails](https://support.google.com/youtube/answer/72431?hl=en) |
| Thumbnail experiment meaning | YouTube Studio Test & Compare can expose variants simultaneously and currently evaluates the result by watch-time share; a local side-by-side review is therefore not evidence of an A/B winner. | [Test & compare thumbnails](https://support.google.com/youtube/answer/13861714?hl=en-on) |
| Metadata emphasis | YouTube states that title, thumbnail, and description matter more for discovery than tags, and that tags otherwise play a minimal role except for matters such as misspellings. | [Add tags to videos](https://support.google.com/youtube/answer/146402?hl=en), [How YouTube search works](https://support.google.com/youtube/answer/16090438?hl=en) |
| Manual chapters | Creator-supplied chapters begin at `00:00`, contain at least three ascending timestamps, and each chapter is at least ten seconds under current guidance. | [Video Chapters](https://support.google.com/youtube/answer/9884579?hl=en) |
| Child-directed audience | YouTube requires creators to designate audience accurately and warns not to rely on automated systems. Animated/cartoon characters are one relevant factor, but animation is not automatically child-directed or general-audience content. | [Determining if content is made for kids](https://support.google.com/youtube/answer/9528076?hl=en), [Set a channel or video's audience](https://support.google.com/youtube/answer/9527654?hl=en) |
| Altered/synthetic disclosure | The Data API includes `status.containsSyntheticMedia` for realistic altered/synthetic content, while current YouTube guidance distinguishes realistic generated/altered scenes from non-realistic animation and production assistance. The app records a human decision against the current guidance instead of inferring it from model use. | [YouTube video resource](https://developers.google.com/youtube/v3/docs/videos), [2026 disclosure update](https://support.google.com/youtube/thread/424874071/updates-to-ai-content-disclosure-and-labels?hl=en) |
| Authenticity and monetization | Current YouTube monetization policy requires original/authentic work and can reject generic, repetitive, or mass-produced template content, while explicitly recognizing series with distinct storylines and original AI-assisted creative work as potentially acceptable. | [YouTube channel monetization policies](https://support.google.com/youtube/answer/1311392?hl=en), [Monetizable-content guidance](https://support.google.com/youtube/answer/2490020?hl=en) |
| Metadata policy | YouTube's spam policy applies to content, metadata, and thumbnails and prohibits misleading or manipulative behavior. | [Spam, deceptive practices, and scams policy](https://support.google.com/youtube/answer/2801973/spam-deceptive-practices-and-scams-policies?hl=en-GB) |
| Analytics | The YouTube Analytics API defines metrics such as views, estimated minutes watched, average view duration/percentage, engagement, and audience information. Metrics have different stability/deprecation status and must be stored with source/window/version context. | [YouTube Analytics metrics](https://developers.google.com/youtube/analytics/metrics) |
| Future connector | The Data API supports video insert, thumbnail set, and caption insert operations. Uploads from some unverified API projects are restricted to private and upload behavior has OAuth/quota/audit requirements, so these endpoints are not assumed safe merely because a reference repository calls them. | [YouTube Data API](https://developers.google.com/youtube/v3/docs), [Videos: insert](https://developers.google.com/youtube/v3/docs/videos/insert), [Captions implementation](https://developers.google.com/youtube/v3/guides/implementation/captions?hl=en) |

Design consequence: default video delivery remains a versioned 1080p/24fps SDR H.264/AAC profile with technical QC. Public-facing thumbnails, release metadata, chapters, audience/disclosure attestations, and analytics definitions also use versioned rules rechecked before release changes. Version 1 exports a verified manual-upload package and does not automatically publish.

## FFmpeg encoding

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| CRF | FFmpeg documents CRF as an encoding quality/file-size control. It is not treated as a generative-motion control or a way to repair model motion. | [FFmpeg codec documentation](https://www.ffmpeg.org/ffmpeg-codecs.html) |

## Upstream skills

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Project/source | Upstream provides outline, character, art, script, storyboard, and shot-recipe skills for AI short-drama production and is Apache-2.0 at the pinned commit. | [shuohao-skills repository](https://github.com/eternityspring/shuohao-skills), pinned locally at `4cff5ae3a4a2d2b5d13161f5a2378c5910be7cad` |

Local inspection at the pin established the H3-specific storyboard, 2–5 second cut gate, up-to-15-second segments, Chinese-first fields, and self-test behavior. Those repository facts are preserved through the submodule lock and compatibility suite rather than web assumptions.

## External YouTube-automation reference

The studio reviewed [darkzOGx/youtube-automation-agent](https://github.com/darkzOGx/youtube-automation-agent) at commit [`0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4`](https://github.com/darkzOGx/youtube-automation-agent/tree/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4). The repository is MIT-licensed at that pin. Static source inspection—not only its README—established:

- The [thumbnail agent](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/agents/thumbnail-designer-agent.js) creates a concept, local gradient/text image, optimized file, and several local variants; another media path can request an AI-generated image.
- The [SEO agent](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/agents/seo-optimizer-agent.js) stores titles, descriptions, tags, hashtags, chapters, end-screen notes, and a heuristic score. The studio adopts the governed release fields but rejects the universal score and generic clickbait templates.
- The [strategy agent](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/agents/content-strategy-agent.js) queries most-popular videos/configured competitors and combines those signals with channel history; the studio retains provenance and creator control instead of autonomous trend-to-production execution.
- The [recovery](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/utils/generation-recovery-service.js), [readiness](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/utils/production-readiness-service.js), and [learning](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/utils/channel-learning-engine.js) services provided useful patterns for visible checkpoints, safe probes, source-labelled performance snapshots, and approved recommendations.
- Its [publishing agent](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/agents/publishing-scheduling-agent.js) performs external mutation and its [credential manager](https://github.com/darkzOGx/youtube-automation-agent/blob/0d77cc64980813b4f1e874a6fa5a5a2752ae2cc4/utils/credential-manager.js) writes ordinary JSON credential/token files. These implementations are not adopted; the studio keeps protected-vault storage, human attestations, and no automatic version-1 publishing.

The complete adoption/rejection matrix and target workflow are in [YOUTUBE_RELEASE_WORKFLOW.md](YOUTUBE_RELEASE_WORKFLOW.md).

## Items requiring a future exact review

- Selected GPU inventory and live hourly pricing.
- Exact Qwen/LTX model file licenses, hashes, and distribution obligations.
- ComfyUI and every custom-node license/security state.
- FFmpeg build configuration and redistribution obligations.
- Worker base image/CUDA/NVIDIA component licenses.
- Music, sound, font, reference image, likeness, and voice permissions.
- RunPod data region, privacy, billing, retention, and account limits.
- Current YouTube delivery/policy requirements before publishing.
- Current thumbnail, chapter, audience, altered/synthetic-media, authenticity/monetization, metadata, analytics, OAuth, quota, and API-audit requirements before enabling or changing release behavior.
- Current OpenAI/Anthropic model availability, context behavior, pricing, data handling, and skill/tool features before provider implementation or default changes.
- External Agent Skill/MCP package compatibility and security requirements before non-declarative skill classes are enabled.
- Exact speech-verification/ASR engine, creative-QC models/thresholds, layer-separation implementation, LTX advanced adapter compatibility, Foley engine, and project-adaptation training recipe before those features are enabled.

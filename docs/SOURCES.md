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

Implementation consequence: Electron is pinned at 43.4.1, Electron Vite at 5.0.0, Vite at compatible 7.3.6, and TypeScript at 5.9.3. The main process owns SQLite, files, provider calls, and `safeStorage`; the renderer receives nine narrow schema-validated methods through the preload bridge and never receives a saved key value.

## Writing APIs and external skills

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| OpenAI Responses | The Responses API accepts text/image inputs, can return text or structured JSON, and supports built-in tools, MCP tools, and typed custom function calls with configurable tool choice. | [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create) |
| Claude tool use | Claude's Messages API supports declared client/server tools; Claude returns a structured tool call and the application executes and returns client-tool results. | [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) |
| MCP interoperability | MCP is an open standard for connecting AI applications to external data, tools, and workflows and is supported across multiple AI clients. | [Model Context Protocol introduction](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro) |

Design consequence: the studio uses provider-neutral writing tasks with OpenAI and Anthropic adapters rather than making either provider's conversation the project database. External skills are selected by the studio router and compiled to provider instructions/tools only after manifest, compatibility, permission, and context checks. A model's claim that it used a skill is not proof; the studio records validated exact-version execution receipts.

## LTX

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Open-source overview | LTX-2.5 supports text/image/video inputs, synchronized audio/video, and native multi-shot positioning in the current documentation. | [LTX open-source overview](https://docs.ltx.io/open-source-model/getting-started/overview) |
| ComfyUI | LTX documents ready-made ComfyUI templates and automatic model downloads; current prerequisites list CUDA GPU with 32GB+ VRAM, 100GB+ storage, and Python 3.12+. | [Using ComfyUI with LTX](https://docs.ltx.io/open-source-model/integration-tools/comfy-ui) |
| Hardware | Current open-source requirements list 32GB minimum VRAM and recommend A100/H100 80GB class hardware plus larger storage headroom. | [LTX system requirements](https://docs.ltx.io/open-source-model/getting-started/system-requirements) |
| Pipelines | Official pipelines include production/draft text/image-to-video, audio+image-to-video, keyframes, retake, and lip-dub/re-voice paths. | [LTX pipelines overview](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/README.md), [pipeline details](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-pipelines/docs/pipelines.md) |
| Audio conditioning | The A2V pipeline is documented for video generation conditioned on input audio and optional image conditioning. | [LTX PyTorch API](https://docs.ltx.io/open-source-model/integration-tools/pytorch-api) |
| License | The current LTX-2 community license and model card include commercial-use conditions tied to organization revenue; this must be rechecked for the user's entity and exact model files before monetized release. | [LTX-2 license](https://github.com/Lightricks/LTX-2/blob/main/LICENSE.md), [LTX-2.5 model card](https://huggingface.co/Lightricks/LTX-2.5) |

Design consequence: version 1 uses only LTX video, but pins exact open-source model/workflow versions and requires a license check. Hosted LTX API capabilities are not assumed to exist identically in the open-source worker.

## Qwen image and voice

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Qwen-Image | Official repository documents image generation/editing, multi-image input in later edit releases, improved character consistency, native ComfyUI support, and Apache-2.0 licensing. | [Qwen-Image official repository](https://github.com/QwenLM/Qwen-Image) |
| Qwen-Image ComfyUI | Official ComfyUI documentation includes a native Qwen-Image workflow and identifies the open model/license. | [ComfyUI Qwen-Image tutorial source](https://github.com/Comfy-Org/docs/blob/main/tutorials/image/qwen/qwen-image.mdx) |
| Qwen3-TTS | Official repository documents 0.6B/1.7B models, voice design, custom voices, reusable voice-clone prompts, multiple languages, Python 3.12 guidance, and Apache-2.0 licensing. | [Qwen3-TTS official repository](https://github.com/QwenLM/Qwen3-TTS) |

Design consequence: Qwen families are initial defaults behind adapters. Human benchmarks still decide exact checkpoints/quantization and acceptable recurring identity.

## ComfyUI

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Workflow server | ComfyUI can run headlessly without opening a browser; its self-hosted server accepts workflows, uploads/downloads files, and communicates status, progress, errors, previews, and completed output through HTTP/WebSocket mechanisms. | [ComfyUI server overview](https://docs.comfy.org/development/comfyui-server/comms_overview), [server messages](https://docs.comfy.org/development/comfyui-server/comms_messages) |
| Workflow format | Official documentation describes API-format workflows as JSON node graphs and asynchronous job handling. | [ComfyUI API overview](https://docs.comfy.org/development/cloud/overview) |

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

## YouTube delivery

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Upload settings | Current YouTube guidance lists MP4, H.264, progressive scan, 4:2:0, same recorded frame rate, AAC-LC/other accepted audio at 48kHz, BT.709 for SDR, and an 8 Mbps reference bitrate for 1080p standard frame rates. | [YouTube recommended upload encoding settings](https://support.google.com/youtube/answer/1722171?hl=en) |

Design consequence: default delivery is a versioned 1080p/24fps SDR H.264/AAC profile with technical QC. The platform settings are rechecked before release changes.

## Upstream skills

| Topic | Current verified fact used by the design | Source |
| --- | --- | --- |
| Project/source | Upstream provides outline, character, art, script, storyboard, and shot-recipe skills for AI short-drama production and is Apache-2.0 at the pinned commit. | [shuohao-skills repository](https://github.com/eternityspring/shuohao-skills), pinned locally at `4cff5ae3a4a2d2b5d13161f5a2378c5910be7cad` |

Local inspection at the pin established the H3-specific storyboard, 2–5 second cut gate, up-to-15-second segments, Chinese-first fields, and self-test behavior. Those repository facts are preserved through the submodule lock and compatibility suite rather than web assumptions.

## Items requiring a future exact review

- Selected GPU inventory and live hourly pricing.
- Exact Qwen/LTX model file licenses, hashes, and distribution obligations.
- ComfyUI and every custom-node license/security state.
- FFmpeg build configuration and redistribution obligations.
- Worker base image/CUDA/NVIDIA component licenses.
- Music, sound, font, reference image, likeness, and voice permissions.
- RunPod data region, privacy, billing, retention, and account limits.
- Current YouTube delivery/policy requirements before publishing.
- Current OpenAI/Anthropic model availability, context behavior, pricing, data handling, and skill/tool features before provider implementation or default changes.
- External Agent Skill/MCP package compatibility and security requirements before non-declarative skill classes are enabled.

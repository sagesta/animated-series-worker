# Live core GPU qualification — 2026-08-26

Status: technically executed; production promotion remains blocked by failed creative acceptance and incomplete lifecycle/storage evidence.

## Controlled run

- Provider: RunPod Secure Cloud
- Pod: `jfqio704wuthpf` (`Animated Studio core qualification 0FBQPW`)
- Qualification: `RXYQWHBT22KMBK6885ZP0FBQPW`
- GPU: NVIDIA L40S, 48 GB class; PyTorch reported 44.4 GiB usable
- Worker: `ghcr.io/sagesta/animated-series-worker@sha256:3b1142ede47d387a890b36e7e5e0ae212c3f2304387e128f4f7991ad5c33b0e9`
- Worker config: `sha256:9dc427e506059a685b7b5f588ab0b02161bd87c4fcc080301a21e117b8f3dcb1`
- Canonical GitHub OIDC signature: workflow run `32994632107` passed manifest/config identity, signing, and exact-workflow verification
- Runtime: 2026-08-26 16:26:16Z to 17:40:11Z, 73.923 minutes
- Compute estimate: USD 1.219724 at USD 0.99/hour; this is not a provider invoice and excludes any separately billed storage
- Storage used for qualification: 50 GB container disk plus a 350 GB Pod-local volume; 76.9 GB remained after bootstrap
- Shutdown: the Pod was explicitly deleted after evidence collection and a follow-up provider query returned no Pod

The 350 GB Pod volume was required because the qualification bootstrap retained both Hugging Face cache data and installed model destinations. The volume was not persistent after Pod deletion, so this run does not prove an acceptable production model-storage method.

## Runtime capability

Preflight passed with Python 3.12.3, CUDA 12.8, NVIDIA driver 580.178.04, the pinned ComfyUI commit `783545f689a0af730065994b46b382ae24844c99`, workflow-pack fingerprint `baed1ac0512eee3cfe862df36e454dcd7b45d5b56562c6c60c5938938edd8403`, all required node types, all nine workflow hashes, and 11 model hashes.

| Model component | Live SHA-256 |
| --- | --- |
| Qwen Image 2512 diffusion FP8 | `5dc80554d5d83390046a2f4a94ece06afb7700bf7b0aaf8bde9769793875876b` |
| Qwen Image text encoder FP8 | `cb5636d852a0ea6a9075ab1bef496c0db7aef13c02350571e388aea959c5c0b4` |
| Qwen Image VAE | `a70580f0213e67967ee9c95f05bb400e8fb08307e017a924bf3441223e023d1f` |
| Qwen Image Edit 2511 diffusion BF16 | `ae42d927b5fac4f278b9a894554c727e619727a63622976f2d95625be4bce08c` |
| Qwen3-TTS VoiceDesign | `28e54440f757c673332b435e8fc453a98df0387b14dacb7ec9e65f8c992f52db` |
| Qwen3-TTS Base | `e97c57d1f8cdbca0d349f3fe98b39791133189b9c66924c0bb8bf7755f23f9fc` |
| LTX-2.5 distilled transformer BF16 | `31eb3cad89b9e54e99dd3baf286f70825ac4f6c660a70d9184d895be76d7bff4` |
| LTX-2.5 Gemma text encoder BF16 | `ef7243612fdae7a75cb4d5cee9433e81380675fb6c213bd98ae74a9cd16561d1` |
| LTX-2.5 video VAE BF16 | `847e14ca7f3355debca0cea4eaa24ac0fbcdf0061da054ac89ca638a869ddba3` |
| LTX-2.5 audio VAE BF16 | `c52733d37f6a7fb7949c3dc0fb468c6cb2169e4d836983a73babb9f0d54837a5` |
| LTX-2.5 spatial upscaler BF16 | `eb5a71fe4068ee87ccdb1c3aa635e547ca76bd2d30ae20ae889f2c325c0677e8` |

The local receipt was reconstructed from the authenticated live capability report plus the immutable candidate manifest after the original on-Pod receipt was unavailable. It is useful recovery evidence, not equivalent to the original bootstrap receipt.

## Benchmark result

The final uninterrupted sequence ran from 17:35:26Z to 17:39:56Z. Every allowlisted workflow reached `succeeded`, and every downloaded artifact matched the worker-reported byte size and SHA-256.

| Test | Machine result | Acceptance result |
| --- | --- | --- |
| `BENCH-IMAGE-IDENTITY` | Passed; 512×512 PNG `d29e24c…e9df` | Human creative approval still required |
| `BENCH-IMAGE-EDIT` | Passed; PNG `48313d1c…b914` | Failed the requested edit: the scarf remained red instead of deep blue, and framing changed materially |
| `BENCH-TTS-VOICE` | Passed; WAV `a3429f36…db97` | Human listening/pronunciation/voice-identity review still required |
| `BENCH-TTS-LINE-BOOK` | Passed; two WAV files and manifest | Human listening/continuity review still required |
| `BENCH-LTX-DRAFT` | Passed; MP4 `6b6e43b0…9fa6` | Human motion/identity review still required |
| `BENCH-LTX-FINAL` | Passed; H.264/AAC MP4 `9d474f79…7ee`, 1280×704, 12 fps | Requested one second but produced 0.75 seconds; source frame contained no map or river for the requested glance, so semantic acceptance remains blocked |
| `BENCH-CREATIVE-QC` | Passed; FFprobe report `2ff4e5a0…666e` | Warning-only technical evidence; it cannot approve creative quality |

Gateway authentication refusal and query-parameter rejection passed. The live run also proved exact-digest pulling, model discovery, ComfyUI queueing, verified upload/download, explicit provider termination, and a VRAM handoff between ComfyUI and the isolated TTS process.

## Fixes proven during the run

1. The first image request failed before queueing because bootstrap installed models under `/workspace/models` while ComfyUI scanned `/opt/ComfyUI/models`. Candidate 5 maps the four fixed model categories into ComfyUI before startup.
2. RunPod's proxy did not forward the standard `Range` header. Candidate 5 also accepts the authenticated `X-Studio-Range` header; all final artifacts downloaded and hash-verified through that path.
3. After Qwen image/edit, ComfyUI retained enough VRAM to make the isolated TTS process exit. Candidate 5 explicitly asks loopback-only ComfyUI to unload models and free memory before a worker-Python workflow. Voice design and the line book then passed in the same uninterrupted sequence.

## Promotion decision

Do not create a production workflow pack or readiness receipt from this run. The targeted-edit fixture failed its explicit creative instruction; the final-video duration contract did not match; subjective image/audio/video review is incomplete; exact Gemma encoder provenance remains open; Pod-local model storage is not a production storage method; upload-resume interruption, reconciliation, idle shutdown, hard-deadline shutdown, actual provider cost, clean-machine finishing, and long-form quality were not proven. Advanced workflows and LatentSync remain outside this core result.

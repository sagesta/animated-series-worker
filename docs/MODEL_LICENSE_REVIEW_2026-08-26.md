# Candidate model-license evidence review — 2026-08-26

## Outcome

The no-cost evidence review is complete for all 15 candidate artifacts: eight pinned Hugging Face repositories plus the Gemma 4 source embedded in LTX-2.5's custom text encoder. On 2026-08-26 the individual project owner explicitly accepted the LTX-2.5 license and gated terms for commercial, monetized YouTube animation use. **That single source decision does not approve a model download or production:** the remaining core sources still need decisions, all model hashes are null, and every external GPU gate remains locked. The machine-readable record is [`config/model-license-review.candidate.json`](../config/model-license-review.candidate.json).

This is a technical evidence dossier, not legal advice. A person authorized to bind the creator or relevant legal entity must make and record the decisions.

## Evidence result by source

| Pinned source or transitive component | Workflow scope | Evidence found | Current result |
| --- | --- | --- | --- |
| `Comfy-Org/Qwen-Image_ComfyUI@7beb7b6…` | Core + advanced | Mirror and official Qwen-Image-2512 sources identify Apache-2.0 | Evidence supports commercial use subject to Apache obligations; authorization pending |
| `Comfy-Org/Qwen-Image-Edit_ComfyUI@984166f…` | Core + advanced | Mirror and official Qwen-Image-Edit-2511 sources identify Apache-2.0 | Evidence supports commercial use subject to Apache obligations; authorization pending |
| `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign@5ecdb67…` | Core | Exact model and official repository identify Apache-2.0 | Evidence supports commercial use, but every reference voice still needs separate consent/rights; authorization pending |
| `Qwen/Qwen3-TTS-12Hz-1.7B-Base@fd4b254…` | Core | Exact model and official repository identify Apache-2.0 | Evidence supports commercial use, but voice-clone inputs still need separate consent/rights; authorization pending |
| `ByteDance/LatentSync-1.6@c42c7e6…` | Advanced only by promotion policy | Exact weight repository declares `openrail++`; code repository is separately Apache-2.0 | **Blocked and excluded from core:** pinned weight repository does not include or directly link the binding OpenRAIL++-M license text |
| `stabilityai/sd-vae-ft-mse@31f26fd…` | Advanced only with LatentSync | Exact repository identifies MIT | Evidence supports commercial use subject to retaining the MIT notice; excluded from core with its only consuming workflow |
| `Lightricks/LTX-2.5@6c7e5e5…` | Core + advanced | Exact gated repository identifies the 2026-08-11 LTX-2.x Community License | **Accepted by the individual project owner** for the stated commercial use, subject to every license restriction and notice duty; model/GPU qualification still missing |
| `Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients@5e7a704…` | Advanced only | Exact gated repository points to the earlier 2026-01-05 LTX-2 Community License | **Blocked:** separate terms and LTX-2.5 compatibility remain unapproved; keep outside core promotion |
| Gemma 4 12B-derived custom LTX encoder | Transitive core + advanced | Google's Gemma 4 model card identifies Apache-2.0 | Evidence supports commercial use, but the exact upstream checkpoint used by LTX is not separately pinned and combined attribution/provenance must be confirmed |

## Material conditions requiring a human decision

1. Retain the recorded individual-project LTX acceptance, full use restrictions, distribution duties, safety/transparency/provenance requirements, and gated-access terms with the exact source revision.
2. Confirm and retain the Gemma 4 and LTX notices/provenance for the custom packaged text encoder.
3. Accept the Apache-2.0 obligations for the core Qwen image and TTS artifacts; voice/reference rights remain separate.
4. Obtain a direct licensor clarification or a stable, binding license-text link before separately qualifying LatentSync 1.6. Do not substitute the Apache code license for the weight license.
5. Keep model licensing separate from project-level copyright, trademark, likeness, voice, performance, privacy, music, font, and reference-media permissions.

Only after those steps may the authorized reviewer populate the named, dated per-model `licenseApprovals` in a new qualification evidence bundle. The guarded promotion tool still requires the exact model hashes, compatible-GPU evidence, mandatory media tests, security/recovery results, and provider-side shutdown/cost proof.

## Evidence and enforcement

- Exact source revisions and authoritative links are recorded in [`config/model-license-review.candidate.json`](../config/model-license-review.candidate.json).
- `pnpm test:model-licenses` proves that every pinned manifest repository has one matching record, restrictive promotion-policy scopes are covered, the Gemma transitive link exists, accepted decisions are named/dated/explained, pending decisions remain unnamed/undated, and no candidate model hash or manifest acceptance flag has been introduced.
- The individual LTX terms were accepted; no model weight was downloaded and no RunPod resource was created during this review.

## Authoritative sources

- [LTX-2.x Community License Agreement](https://github.com/Lightricks/LTX-2/blob/main/LICENSE.md) and [LTX-2.5 model repository](https://huggingface.co/Lightricks/LTX-2.5)
- [Earlier LTX-2 Community License](https://github.com/Lightricks/LTX-2/blob/main/LICENSE) and [IC-LoRA repository](https://huggingface.co/Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4) and [Apache-2.0 license](https://ai.google.dev/gemma/apache_2)
- [Qwen-Image-2512](https://huggingface.co/Qwen/Qwen-Image-2512), [Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511), [Qwen3-TTS VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign), and [Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)
- [LatentSync-1.6 weights](https://huggingface.co/ByteDance/LatentSync-1.6), [LatentSync code](https://github.com/bytedance/LatentSync), and [Hugging Face license identifiers](https://huggingface.co/docs/hub/main/repositories-licenses)
- [Stability VAE](https://huggingface.co/stabilityai/sd-vae-ft-mse)

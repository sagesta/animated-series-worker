# Candidate model-license evidence review — 2026-08-26

## Outcome

The no-cost evidence review is complete for all 15 candidate artifacts: eight pinned Hugging Face repositories plus the Gemma 4 source embedded in LTX-2.5's custom text encoder. **No license has been accepted and no model is approved for download, production, or monetized YouTube use.** The machine-readable record is [`config/model-license-review.candidate.json`](../config/model-license-review.candidate.json), and the candidate model manifest deliberately remains `licenseReview: required` with null file hashes.

This is a technical evidence dossier, not legal advice. A person authorized to bind the creator or relevant legal entity must make and record the decisions.

## Evidence result by source

| Pinned source or transitive component | Workflow scope | Evidence found | Current result |
| --- | --- | --- | --- |
| `Comfy-Org/Qwen-Image_ComfyUI@7beb7b6…` | Core + advanced | Mirror and official Qwen-Image-2512 sources identify Apache-2.0 | Evidence supports commercial use subject to Apache obligations; authorization pending |
| `Comfy-Org/Qwen-Image-Edit_ComfyUI@984166f…` | Core + advanced | Mirror and official Qwen-Image-Edit-2511 sources identify Apache-2.0 | Evidence supports commercial use subject to Apache obligations; authorization pending |
| `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign@5ecdb67…` | Core | Exact model and official repository identify Apache-2.0 | Evidence supports commercial use, but every reference voice still needs separate consent/rights; authorization pending |
| `Qwen/Qwen3-TTS-12Hz-1.7B-Base@fd4b254…` | Core | Exact model and official repository identify Apache-2.0 | Evidence supports commercial use, but voice-clone inputs still need separate consent/rights; authorization pending |
| `ByteDance/LatentSync-1.6@c42c7e6…` | Core | Exact weight repository declares `openrail++`; code repository is separately Apache-2.0 | **Blocked:** pinned weight repository does not include or directly link the binding OpenRAIL++-M license text |
| `stabilityai/sd-vae-ft-mse@31f26fd…` | Core | Exact repository identifies MIT | Evidence supports commercial use subject to retaining the MIT notice; authorization pending |
| `Lightricks/LTX-2.5@6c7e5e5…` | Core + advanced | Exact gated repository identifies the 2026-08-11 LTX-2.x Community License | **Blocked:** entity/revenue status, gated terms, use restrictions, downstream duties, and any paid commercial agreement require authorized review |
| `Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients@5e7a704…` | Advanced only | Exact gated repository points to the earlier 2026-01-05 LTX-2 Community License | **Blocked:** separate terms and LTX-2.5 compatibility remain unapproved; keep outside core promotion |
| Gemma 4 12B-derived custom LTX encoder | Transitive core + advanced | Google's Gemma 4 model card identifies Apache-2.0 | Evidence supports commercial use, but the exact upstream checkpoint used by LTX is not separately pinned and combined attribution/provenance must be confirmed |

## Material conditions requiring a human decision

1. Identify the individual or legal entity that will use the models and the person authorized to accept terms for it.
2. Confirm that entity's **aggregate annual revenue** category for LTX. The current LTX-2.x terms require entities at or above USD 10,000,000 to obtain a paid commercial agreement for commercial use. A monetized or end-user-facing production is not the free non-commercial evaluation exception.
3. Review and accept the complete LTX use restrictions, distribution duties, safety/transparency/provenance requirements, and Hugging Face gated-access terms—or record the paid agreement that governs the use.
4. Obtain a direct licensor clarification or a stable, binding license-text link for the pinned LatentSync 1.6 weights. Do not substitute the Apache code license for the weight license.
5. Confirm and retain the Gemma 4 and LTX notices/provenance for the custom packaged text encoder.
6. Accept the Apache-2.0 and MIT obligations for the Qwen and Stability artifacts.
7. Keep model licensing separate from project-level copyright, trademark, likeness, voice, performance, privacy, music, font, and reference-media permissions.

Only after those steps may the authorized reviewer populate the named, dated per-model `licenseApprovals` in a new qualification evidence bundle. The guarded promotion tool still requires the exact model hashes, compatible-GPU evidence, mandatory media tests, security/recovery results, and provider-side shutdown/cost proof.

## Evidence and enforcement

- Exact source revisions and authoritative links are recorded in [`config/model-license-review.candidate.json`](../config/model-license-review.candidate.json).
- `pnpm test:model-licenses` proves that every pinned manifest repository has one matching record, workflow-derived core/advanced scopes are covered, the Gemma transitive link exists, all decisions remain pending/unnamed/undated, and no candidate hash or acceptance flag has been introduced.
- No model weight was downloaded, no gated terms were accepted, and no RunPod resource was created during this review.

## Authoritative sources

- [LTX-2.x Community License Agreement](https://github.com/Lightricks/LTX-2/blob/main/LICENSE.md) and [LTX-2.5 model repository](https://huggingface.co/Lightricks/LTX-2.5)
- [Earlier LTX-2 Community License](https://github.com/Lightricks/LTX-2/blob/main/LICENSE) and [IC-LoRA repository](https://huggingface.co/Lightricks/LTX-2.3-22b-IC-LoRA-Ingredients)
- [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4) and [Apache-2.0 license](https://ai.google.dev/gemma/apache_2)
- [Qwen-Image-2512](https://huggingface.co/Qwen/Qwen-Image-2512), [Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511), [Qwen3-TTS VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign), and [Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base)
- [LatentSync-1.6 weights](https://huggingface.co/ByteDance/LatentSync-1.6), [LatentSync code](https://github.com/bytedance/LatentSync), and [Hugging Face license identifiers](https://huggingface.co/docs/hub/main/repositories-licenses)
- [Stability VAE](https://huggingface.co/stabilityai/sd-vae-ft-mse)

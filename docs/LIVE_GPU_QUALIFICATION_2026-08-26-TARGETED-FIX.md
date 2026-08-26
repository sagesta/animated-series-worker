# Targeted GPU requalification — 2026-08-26 fixes

Status: prepared and locally guarded; live targeted execution is blocked because no reusable qualified-model cache exists. Production promotion remains locked.

## Evidence boundary

The 2026-08-26 core qualification proved seven technical workflow executions but exposed two release-blocking results: `qwen-image-targeted-edit` did not turn the scarf blue and changed pixels outside the intended area, while `ltx2-image-to-video-final` returned 0.75 seconds for a one-second request. This record is intentionally separate from the original [live qualification](LIVE_GPU_QUALIFICATION_2026-08-26.md); the historical artifacts and hashes are not rewritten.

No targeted GPU job has run yet. Therefore this document does not claim that either correction is live-verified, visually accepted, merged, promoted, or production-ready.

## RunPod cache safety gate

The original qualification state records a 350 GB Pod-local volume with `persistentAfterTermination: false`. The Pod was explicitly deleted, so its downloaded model set did not survive.

A read-only provider inventory at `2026-08-26T18:34:14.037Z` returned:

- active or retained Pods: none;
- persistent network volumes: none;
- new compute created: none;
- additional compute cost: USD 0.00.

The targeted rerun is therefore stopped before Pod creation. Starting another Pod would require downloading the qualified model set again, contrary to the explicit targeted-run boundary. The existing signed worker digest `sha256:3b1142ede47d387a890b36e7e5e0ae212c3f2304387e128f4f7991ad5c33b0e9` also embeds the pre-fix workflow pack and cannot serve as evidence for corrected graphs.

## Prepared targeted checks

The maintainer runner now has a fail-closed `targeted-fixes` mode. Before a paid job can start, it requires the live capability report to match the exact integrated candidate-pack fingerprint and the exact hashes for both corrected immutable workflow versions:

- `qwen-image-targeted-edit@1.0.1`;
- `ltx2-image-to-video-final@1.0.1`.

The image check pins the approved parent image SHA-256 `d29e24c81779cfa3a2b24519a0ac658d86072bb9e0a607505a66081eee85e9df` and scarf-region mask SHA-256 `5cbb0a510c6200e030d6caea61f92772813e477ecfa433523279df70a15cff7e`. It submits the parent first and mask second, requests a deep-blue scarf at strength `1.0`, requires changed blue pixels inside the mask, and requires zero changed pixels outside the final composite mask.

The duration check submits the same approved parent to the corrected final-video workflow for 1.0, 2.0, and 4.0 seconds at 24 fps. Local `ffprobe` evidence must show every result within one frame (`1/24` second) of the requested duration.

## Unaffected baseline integrity

The local copies of the five unaffected 2026-08-26 output sets were re-read and matched their recorded byte sizes and SHA-256 values:

| Test | Preserved artifact SHA-256 |
| --- | --- |
| `BENCH-IMAGE-IDENTITY` | `d29e24c81779cfa3a2b24519a0ac658d86072bb9e0a607505a66081eee85e9df` |
| `BENCH-TTS-VOICE` | `62eb3d810615feb95a687abb9a5aadae0b4c2a17c3414adcf70499bcfb4a2fd3`; `a3429f3691a1ad77d42071727b9b21b89d37bd6767c03194a633af4e32f3db97` |
| `BENCH-TTS-LINE-BOOK` | `77c4f5373a7cd1a388992251eb1de96c1e9104fac4f25818a961c5da979d2996`; `ddb86d83e3f750f4d7fb3d3f861b5386771bdb7bb5c4f543631e3f122885885e`; `1234918b89ef86328ba7a56a3d090f54c9393219f9a12f73c8c45ad9077b100e` |
| `BENCH-LTX-DRAFT` | `6b6e43b04cc6894d1cf9e718147ceebefd3c8ba441aa300ebc84b2e448a39fa6` |
| `BENCH-CREATIVE-QC` | `2ff4e5a0ddced1dee689c39d0d1229ca886ffe54f4ed3005920b0eb0b770666e` |

The template-backed identity and LTX-draft workflow hashes also match the original live capability report. The voice, line-book, and assistive-QC workflows run through the direct worker runner and do not have ComfyUI template hashes. This is local artifact/definition integrity evidence, not a new GPU execution or a claim that regenerated media would be byte-identical.

## Required completion evidence

The targeted fix record can move beyond `blocked` only after all of the following exist:

1. the two reviewed `1.0.1` workflow fixes and their regression tests are integrated;
2. a newly built and canonically signed worker image reports the exact integrated pack fingerprint and workflow hashes;
3. an already-populated reusable model cache is available, or the owner explicitly changes the no-redownload boundary;
4. the targeted image and three duration jobs pass and their outputs are downloaded and hash-verified;
5. the Pod is immediately deleted and provider absence plus measured cost are recorded;
6. the project owner reviews the new edited image and video alongside the earlier identity, voice, and video evidence.

Do not run `scripts/Promote-GpuWorker.mjs` from this state. Automated checks can prepare evidence, but NFR-019 reserves creative approval and release authority for the project owner.

# Local verification evidence — 2026-08-25

This record distinguishes reproducible development-machine evidence from production qualification. It is not a substitute for model-license review, a controlled RunPod run, code signing, or a clean-machine acceptance session.

## Application quality gate

| Check | Result | Evidence captured locally |
| --- | --- | --- |
| Documentation traceability | Pass | 93 requirement references, 62 unique decision IDs, pinned upstream lock `4cff5ae3a4a2` |
| TypeScript | Pass | `tsc --noEmit` |
| Formatting | Pass | Repository Prettier check; generated Playwright output is excluded |
| Lint | Pass | ESLint with zero warnings allowed |
| Worker unit tests | Pass | 9 Python tests |
| Pinned upstream validators | Pass | 1,414 assertions across six skill families |
| Application unit/integration suite | Pass | 156 tests across 30 Vitest files |
| Production Electron build | Pass | Main, preload, and renderer bundles built |
| Desktop E2E | Pass for the six current local scenarios | 6 Playwright-for-Electron tests at one worker, 39.8 seconds; the first scenario captured and visually checked the recommended next step, expanded eight-checkpoint production run, and locked one-off asset tool at 1280×720 |

The desktop scenarios verify the five-step non-technical project wizard; one resumable story-to-master/cleanup workflow; the locked one-off Image/Video/Audio/Composition/Assemble gate with zero jobs created; the two-level disclosure boundary at 1280×720; keyboard-only validation with text status; exact backup/delete/restore state identity; cross-project refusal followed by an explicit lineage-preserving copy; and an immutable release package assembled from real local MP4/PNG/SRT fixture bytes. They do **not** claim structured automatic 60–75-shot batch execution or the three live-GPU critical paths: end-to-end pilot generation, multi-scene paid generation/retake, or crash-to-watchdog/provider recovery.

## Windows package candidate

| Artifact | Bytes | SHA-256 | Authenticode |
| --- | ---: | --- | --- |
| `dist/Animated-Series-Studio-0.10.1-x64.exe` | 105,652,428 | `DF655449CF923E6260A522B6AA3CA9B0EBAA37271019DFD0C4EA38C894B96FEB` | `NotSigned` |
| `dist/win-unpacked/Animated Series Studio.exe` | 235,697,152 | `5DE2E6487B8011AEB6215D008DCBC20D16EA656070393B8A18D5E059231B79A1` | `NotSigned` |

The packaged executable reported file version `0.10.1.0`, started with an isolated empty profile, remained alive for eight seconds with four exact application processes, and was then stopped with zero matching application processes remaining. The execution sandbox refused the final recursive removal of that credential-free profile, so it remains in the operating-system temporary folder for manual cleanup. This is a launch smoke on the development workstation, not a clean Windows VM test. The branded source icon is `assets/branding/app-icon.png`; the executable's embedded 32×32 transparent icon was extracted and visually checked after packaging.

## Worker and qualification boundary

The local WSL2 environment exposes Docker 29.1.3, NVIDIA container support, driver 572.83, and an RTX 3050 Ti with 4 GB VRAM. Superseded monolithic candidate `0.10.1-candidate.2` built successfully as a 35,559,933,701-byte (33.12 GiB) local image with ID `sha256:38e244324eff6b937328574f201d59dadeddb298cac6796cac88e2413916f244`.

That exact `.2` image passed the model-free ComfyUI preflight on the local GPU. An unauthenticated health request returned `401`; the authenticated gateway returned `ready`; only container port 8000 was published at `127.0.0.1:18003`, while ComfyUI port 8188 remained internal. The capability record reports ComfyUI CUDA 12.8, driver 572.83, 965 installed node types, nine exact workflow hashes, zero model hashes, and `smokeTestPassed: true`. It also reports LatentSync Python 3.10.20 and the isolated LTX trainer on Python 3.12.3, Torch `2.13.0+cu132`, and CUDA 13.2.

The smaller core candidate `0.10.1-candidate.3` then built locally as image `sha256:7ffde53bf446b896596a3ddee68c5527370c1d2c4e8fcd6af33888df9ec7d7c5`, measuring 29,285,117,474 bytes (27.27 GiB). Removing the trainer reduced the image by 6,274,816,227 bytes (5.84 GiB), or 17.65%. Direct inspection confirmed that `/opt/LTX-2` and `/opt/ltx-trainer-venv` are absent; the remaining `/opt/latentsync-venv` is the 7.3 GiB lip-sync runtime, not the deferred trainer.

Candidate `.3` passed the same model-free preflight at `127.0.0.1:18004`. The unauthenticated gateway returned `401`; authenticated health returned `ready` with release `0.10.1-candidate.3`; and the capability record reports the exact local image ID, ComfyUI CUDA 12.8, driver 572.83, 965 installed node types, nine exact workflow hashes, zero model hashes, `smokeTestPassed: true`, LatentSync Python 3.10.20, and every trainer runtime field as `unavailable`. All temporary smoke containers were removed after evidence capture; both local images remain.

On 2026-08-26 the exact `.3` image was published as `ghcr.io/sagesta/animated-series-worker@sha256:875eea3747e89369df5f375aa600bf6de634950c988a82494a2671c0e643603e`. Independent registry inspection reports config digest `sha256:7ffde53bf446b896596a3ddee68c5527370c1d2c4e8fcd6af33888df9ec7d7c5`, exactly matching the local image ID, and a pull by immutable digest completed and resolved to that same image ID. A keyless Sigstore signature was then pushed as OCI referrer `sha256:47fa41fbdeb19f2821d897826d761f7dd792ae15c4a97d51d18e4cdb318faaec`. Cosign `v3.1.3` verified the exact digest claim, a trusted certificate issued through `https://accounts.google.com`, and offline transparency-log inclusion at Rekor index `2598763822`. The image was not deployed. D-053 and the locally tested `sign-worker-image.yml` now pin the intended organization workflow identity, but that workflow has not yet been published to `main`, protected through the `worker-signing` environment, or executed to create a canonical CI signature. The earlier `.2` GHCR push was sent an interrupt and terminated; its registry inspection returned `manifest unknown`, so it still has no usable tag or digest. Partially transferred unreferenced `.2` blobs may remain for registry garbage collection.

This GPU cannot qualify the 18–48 GB core workflows or any separately packaged advanced profile. The deferred LTX trainer's CUDA 13.2 runtime has an official forward-compatibility floor of R595; that restriction now belongs only to a future adaptation image, not the core worker. The model-free preflight proves image construction, dependency import, gateway authentication/binding, and a trivial Comfy graph only. It is not model, media-quality, cost, provider-lifecycle, or production qualification.

Still required before production promotion:

- publish the locally tested D-053 workflow to `main`, protect its `worker-signing` environment, and retain a successful exact-identity GitHub OIDC signing/verification run;
- every model-file SHA-256 plus dated commercial-use decision by an authorized reviewer;
- real 48 GB+ controlled RunPod fixtures for every core operation, plus profile-specific compatible fixtures for each advanced image pursued later;
- gateway exposure, chunk-resume, lease reconciliation, cost, idle exit, hard-deadline termination, and provider deletion evidence;
- measured estimate-versus-actual calibration within the acceptance threshold;
- human quality review of the representative episode and film fixtures;
- production-pack promotion from passing evidence;
- a code-signing identity and signed installer;
- a recorded clean-Windows-VM install, cloud setup, pilot creation, recovery, and uninstall run.

No production-named capability, model-qualification, or promotion artifact may be created from this registry publication plus local model-free evidence.

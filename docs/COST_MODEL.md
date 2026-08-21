# Cost and capacity model

## 1. Honest cost statement

The hourly GPU price is only one variable. Episode cost depends on how many seconds require generated motion, average clip length, attempts per approved take, runtime per attempt on the selected workflow/GPU, upscale/repair work, worker startup/idle time, and persistent storage.

If all work truly completes in five total GPU-hours at $2/hour, compute is $10. A 20–35 minute episode may require hundreds of clip attempts, so five GPU-hours is a measurement to prove, not an assumption derived from the episode duration.

## 2. Cost categories

| Category | When charged | Control |
| --- | --- | --- |
| GPU compute | Worker is provisioned/running according to provider billing | Batch jobs, terminate quickly, hard caps |
| Persistent model storage | Even when no GPU is active | Right-size cache, remove obsolete model versions deliberately |
| Local storage/backup | As project media grows | Retention and backup policy |
| Transfer/provider extras | If provider pricing applies | Measure and display current provider terms |
| OpenAI/Anthropic writing API | Input/output tokens and any selected provider tools/caching/service tier | Task estimate, context preview, model/profile choice, token cap, actual usage ledger |
| Optional external tools/assets | Music, effects, fonts, editor, APIs | Rights and purchase records |

The product must not claim “GPU is the only cost.” A creator-supplied OpenAI or Anthropic key creates a separate text-API bill on that provider account; RunPod balance does not cover it. The studio shows the current provider/storage assumptions and separates optional expenses.

## 3. Forecast variables

| Symbol | Definition |
| --- | --- |
| `D` | Final episode duration in seconds |
| `M` | Fraction of timeline requiring newly generated motion, 0–1 |
| `L` | Average approved generated clip duration in seconds |
| `A` | Average generation attempts per approved clip |
| `R` | Average GPU runtime per attempt in seconds for the pinned workflow/hardware |
| `U` | Additional GPU-hours for images, TTS, upscale, retakes, QC |
| `P` | Provider GPU price per hour |
| `H` | Startup/sync/idle GPU-hours across sessions |
| `G` | Concurrent worker count |

Derived values:

```text
approved_generated_clips = ceil((D × M) / L)
video_attempts = approved_generated_clips × A
video_gpu_hours = (video_attempts × R) / 3600
total_gpu_hours = video_gpu_hours + U + H
estimated_compute_cost = total_gpu_hours × P
approximate_elapsed_generation_hours = total_gpu_hours / G
```

The elapsed formula is optimistic because job lengths, startup, loading, availability, and review are uneven. Total GPU-hours generally do not fall when `G` increases.

## 4. Illustrative example, not a quote

Assume:

- 25-minute episode: `D = 1,500 seconds`.
- 45% newly generated motion: `M = 0.45`.
- Average 5-second generated clip: `L = 5`.
- 2.5 attempts per accepted clip: `A = 2.5`.
- Measured 4 minutes per attempt: `R = 240 seconds`.
- Other GPU work and overhead: `U + H = 2 hours`.
- GPU price: `P = $2/hour`.

Then:

```text
approved generated clips = 135
generation attempts       ≈ 338
video GPU-hours           ≈ 22.5
total GPU-hours           ≈ 24.5
illustrative compute      ≈ $49
```

If the measured attempt takes 8 minutes instead of 4, video compute approximately doubles. If first-pass approval improves or motion coverage falls through thoughtful hybrid editing, it falls.

This example exists to show the arithmetic. It is not a promise that LTX will achieve either runtime or retry rate for the selected style.

## 5. Episode planning modes

The project chooses a motion budget, then replaces it with measured shot plans:

| Planning mode | Newly generated motion target | Intended use |
| --- | --- | --- |
| Lean | About 25–35% | Dialogue-heavy stylized animation, strong use of holds/loops/parallax |
| Standard | About 40–60% | Balanced acting and motion |
| Motion-heavy | About 65–85% | Action or cinematic episodes; requires stronger budget proof |

These are planning bands, not quality grades. A well-directed lean episode can be more coherent than an uncontrolled motion-heavy one.

## 6. Pilot calibration

The first cost forecast is provisional. Run at least a 20-shot benchmark spanning the actual shot classes and record:

- Draft/final workflow.
- GPU class and current price.
- Cold start and model-load time.
- Generation runtime P50/P90.
- Peak VRAM and out-of-memory rate.
- Attempts to approval.
- Repair/upscale time.
- Control-map preprocessing, layer extraction/repair, diffusion-fidelity/temporal-upsample passes, creative-QC/ASR checks, foley candidates, and optional adaptation training/evaluation.
- Transfer and sync time.
- Cost per attempt and per approved second.
- Failure category.

Forecasts use the creator's measured P50 and a conservative P90 range. A model/provider update invalidates only affected benchmark rows and cannot silently inherit old performance.

## 7. Persistent storage example

Current RunPod documentation lists network volume storage at $0.07/GB/month for the first 1TB. At that published rate:

- 100GB ≈ $7/month.
- 200GB ≈ $14/month.
- 250GB ≈ $17.50/month.

Prices are externally controlled and must be refreshed in the app before purchase. The source and verification date are in `SOURCES.md`.

The model cache is kept because downloading large model packs for every session adds delay and operational risk. Creative assets remain local and backed up; the cache can be rebuilt.

## 8. Session budgeting

Each batch has:

- Estimated low/likely/high compute range.
- Current hourly rate and compatible hardware.
- Startup/sync reserve.
- Hard dollar cap.
- Hard time cap.
- Maximum workers.
- Stop threshold that leaves time to sync and terminate.

Version 0.3.0 can read current RunPod catalogue rates for planning and report the aggregate current rate of already-active account Pods. These reads cost $0 and create nothing. They are not a generation quote: the future estimator must refresh compatibility, availability, the exact Pod rate, storage price, worker count, and reserve immediately before approval.

Budget state:

```text
unestimated -> estimated -> authorized -> reserved -> spending
            -> completed | stopped_at_limit | reconciled_difference
```

The scheduler stops assigning jobs before the hard limit. The remote deadline is calculated from the more restrictive time/dollar bound using the provider rate plus safety margin.

## 9. Cost-saving order

Use savings that also improve consistency:

1. Lock story, character, voice, and storyboard before bulk work.
2. Use Qwen image/voice and LTX draft workflows to test cheaply.
3. Generate only representative candidates, not huge blind grids.
4. Reuse approved locations, loops, reactions, and camera holds.
5. Batch compatible workflows to avoid repeated model loads.
6. Retake only the bad line/time region when possible.
7. Upscale only approved content.
8. Approve timing in the animatic before multiplying motion takes.
9. Use advanced control/DFR/temporal-upsample and adaptation only when a cheaper tested method cannot meet the shot acceptance criteria.
8. Terminate immediately after verified synchronization.
9. Measure failure reasons and change the shot rather than repeating identical attempts.

Cheaper hardware is not automatically cheaper per approved second. A slower or less capable GPU can increase runtime/failures; benchmarks choose the actual value.

## 10. Multiple GPUs

Example:

- One worker runs 24 measured GPU-hours: about 24 hours of compute queue.
- Three workers divide the work ideally: about 8 hours elapsed.
- Total remains about 24 GPU-hours, plus extra startup/imbalance overhead.

At $2/GPU-hour, both are around $48 compute before overhead. The three-worker option buys time, not a threefold discount.

## 11. Cost reporting

Dashboard levels:

- Take: attempts, accepted/discarded cost.
- Shot: total and cost per approved second.
- Episode/film: image, voice, video, repair, upscale, and overhead.
- Project: compute, storage estimate, optional assets/tools.
- Creative writing: provider/model/profile, context and output tokens, skill/tool overhead, estimated/actual API cost per draft and accepted version.
- Workflow/GPU: runtime, approval rate, out-of-memory rate, cost effectiveness.

Provider statements are the billing authority. Studio measurements aid decisions and must reconcile differences rather than hiding them.

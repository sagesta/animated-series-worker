# GPU worker

This directory is the reproducible, headless GPU side of Animated Series Studio.

The container exposes only the authenticated studio gateway on port `8000`. ComfyUI remains bound to `127.0.0.1:8188` inside the container. Jobs name an allowlisted workflow and validated parameters; the gateway never accepts an arbitrary ComfyUI graph, URL, filesystem path, installation command, or shell command.

`config/workflow-pack.candidate.json` is deliberately non-runnable for paid jobs. The qualification process must add exact worker-image, model, and workflow hashes, complete the license reviews, pass the benchmark/security/recovery pack, and create `config/workflow-pack.production.json`. The build/release process then copies that production pack into the signed worker image.

ComfyUI uses the base Python runtime with reviewed Transformers 5.14.1 and Kornia 0.8.2 compatibility pins. Qwen3-TTS uses an isolated system-site-packages environment with the `sox` executable and common codecs verified in the image. LatentSync uses an isolated Python 3.10 environment because its pinned upstream setup declares Python 3.10.13 and `mediapipe==0.10.11` has no Python 3.12 wheel. Each core build imports the available runtime entrypoints before an image can be tagged; none may install or repair dependencies during a paid job.

The normal core image deliberately excludes the optional LTX adaptation trainer. Advanced workflows remain candidate-only and are filtered out when the core production pack is promoted. A future adaptation profile must add the pinned trainer in a separate immutable image and pass its own model, license, GPU, quality, cost, security, recovery, and rollback gates.

The worker has two hard-stop layers: the gateway stops accepting work at its deadline, and the independent watchdog ends the container at the same deadline. Provider-side reconciliation and termination remain the desktop application's responsibility. Stopping/terminating and actual billing behavior still require a controlled RunPod proof before generation can be unlocked.

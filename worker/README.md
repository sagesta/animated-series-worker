# GPU worker

This directory is the reproducible, headless GPU side of Animated Series Studio.

The container exposes only the authenticated studio gateway on port `8000`. ComfyUI remains bound to `127.0.0.1:8188` inside the container. Jobs name an allowlisted workflow and validated parameters; the gateway never accepts an arbitrary ComfyUI graph, URL, filesystem path, installation command, or shell command.

`config/workflow-pack.candidate.json` is deliberately non-runnable for paid jobs. The qualification process must add exact worker-image, model, and workflow hashes, complete the license reviews, pass the benchmark/security/recovery pack, and create `config/workflow-pack.production.json`. The build/release process then copies that production pack into the signed worker image.

The worker has two hard-stop layers: the gateway stops accepting work at its deadline, and the independent watchdog ends the container at the same deadline. Provider-side reconciliation and termination remain the desktop application's responsibility. Stopping/terminating and actual billing behavior still require a controlled RunPod proof before generation can be unlocked.

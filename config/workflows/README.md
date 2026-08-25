# Qualified ComfyUI API workflows

Candidate API-format workflow templates are placed under `candidate/`. A controlled qualification run must verify their exact hashes and node inventory before the promotion tool can create a production workflow pack. The desktop app and GPU-worker build both carry this directory so a promoted pack can resolve only the templates it names.

Do not place ComfyUI UI-format exports here. Runtime templates must be API-format prompt JSON and must use only the declared `$PARAM:<key>` and `$INPUT:<zero-based-index>` placeholders.

`qualification-sources/` retains the human-reviewed API graphs and exact runner contracts used to create the candidate copies. The Qwen graphs were derived from the pinned ComfyUI blueprint structure; the LTX graphs follow the pinned Lightricks LTX-2.5 distilled single/two-stage, audio-driven, and control-guided node topology with prompt enhancement disabled. The foley contract binds the model-free procedural runner; the adaptation contract binds the official pinned LTX trainer plus reviewed sample IDs/hashes. `candidate/` is the hash-locked runtime copy produced by `scripts/Import-ComfyWorkflow.mjs`. Structural validation is not a quality claim: models, licenses, GPU execution/training, outputs, regression, cost, and shutdown still require the controlled evidence gate.

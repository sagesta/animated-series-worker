# Qualified ComfyUI API workflows

Candidate API-format workflow templates are placed under `candidate/`. A controlled qualification run must verify their exact hashes and node inventory before the promotion tool can create a production workflow pack. The desktop app and GPU-worker build both carry this directory so a promoted pack can resolve only the templates it names.

Do not place ComfyUI UI-format exports here. Runtime templates must be API-format prompt JSON and must use only the declared `$PARAM:<key>` and `$INPUT:<zero-based-index>` placeholders.

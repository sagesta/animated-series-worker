# Maintenance scripts

## GPU worker release — one-time maintainer flow

These commands prepare and qualify a worker release. They are not repeated by an ordinary creator for every episode, and none should be represented as qualified until the real evidence exists.

```powershell
.\scripts\New-GpuQualificationBundle.ps1
.\scripts\Build-GpuWorker.ps1 -ImageName registry.example/studio-worker:0.9.0-candidate.1 -AllowCandidate
node scripts\Import-ComfyWorkflow.mjs --workflow-id <workflow-id> --input <api-workflow.json>
node scripts\Promote-GpuWorker.mjs --model-receipt <model-receipt.json> --capability-report <capability.json> --evidence <qualification-evidence.json>
```

The bundle command is no-cost. It refuses unaccepted core licenses, emits only the policy-eligible model IDs, and references a RunPod secret named `huggingface_token`; do not paste that credential into the generated JSON. The build command needs Docker but does not rent a GPU. The controlled RunPod qualification described in the bundle is paid and requires a deliberate provider action. Promotion refuses missing license, model, workflow, runtime, quality, security, recovery, cost, or shutdown evidence and will not overwrite an earlier production release.

## Local finishing tools

```powershell
.\scripts\Install-LocalMediaTools.ps1
```

This uses Windows Package Manager to install/check FFmpeg for local timelines, captions, thumbnails, and technical verification. It does not rent a GPU.

## Documentation checks

```powershell
node scripts/check-docs.mjs
```

Checks required documents, relative links, requirement traceability, decision IDs, and the pinned upstream commit.

## Upstream update preview

```powershell
./scripts/update-upstream.ps1
```

Fetches and reports the candidate `origin/main` commit without changing the pin.

To evaluate a specific commit/tag/remote ref:

```powershell
./scripts/update-upstream.ps1 -Ref <commit-or-ref>
```

To check out and test the candidate after the studio repository is clean:

```powershell
./scripts/update-upstream.ps1 -Apply
```

The apply path restores the previous commit/lock on failure. A passing script still requires review, compatibility/media benchmarks where relevant, documentation, and a commit.

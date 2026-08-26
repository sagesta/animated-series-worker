[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'qualification\gpu-worker-candidate')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'config\model-install-manifest.candidate.json'
$packPath = Join-Path $projectRoot 'config\workflow-pack.candidate.json'
$evidenceTemplatePath = Join-Path $projectRoot 'config\gpu-qualification-evidence.template.json'
$outputPath = [System.IO.Path]::GetFullPath($OutputDirectory)

if (Test-Path -LiteralPath $outputPath) {
  throw 'The qualification bundle already exists. Choose a new folder so earlier evidence is never overwritten.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$pack = Get-Content -LiteralPath $packPath -Raw | ConvertFrom-Json
$evidence = Get-Content -LiteralPath $evidenceTemplatePath -Raw | ConvertFrom-Json
$coreModelIds = @(
  $pack.workflows |
    Where-Object { $_.qualificationTier -ne 'advanced' } |
    ForEach-Object { $_.requiredModels } |
    ForEach-Object { $_.modelId } |
    Sort-Object -Unique
)
$evidence.licenseApprovals = @(
  $manifest.models | Where-Object { $coreModelIds -contains $_.modelId } | ForEach-Object {
    [ordered]@{
      modelId = $_.modelId
      decision = 'review-required'
      reviewer = ''
      reviewedAt = $null
      licenseUrl = $_.licenseUrl
      notes = ''
    }
  }
)

New-Item -ItemType Directory -Path $outputPath | Out-Null
$evidence | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $outputPath 'qualification-evidence.json') -Encoding utf8NoBOM

$environment = [ordered]@{
  STUDIO_GATEWAY_TOKEN_HASH = '<sha256-of-one-time-bearer-token>'
  STUDIO_LEASE_ID = '<26-character-qualification-lease-id>'
  STUDIO_HARD_DEADLINE = '<UTC-ISO-time>'
  STUDIO_WORKER_IMAGE_DIGEST = '<64-character-image-digest-without-sha256-prefix>'
  STUDIO_WORKER_RELEASE = $pack.packVersion
  STUDIO_MODEL_BOOTSTRAP_MODE = 'qualification'
  STUDIO_QUALIFICATION_MODE = 'controlled'
  STUDIO_ACCEPTED_MODEL_LICENSES = '<comma-separated-model-ids-after-license-review>'
  STUDIO_IDLE_TIMEOUT_MINUTES = '10'
}
$environment | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputPath 'runpod-environment.template.json') -Encoding utf8NoBOM

$instructions = @'
GPU WORKER QUALIFICATION — NO GPU HAS BEEN STARTED

1. Review every license URL in qualification-evidence.json. Record a named, dated accepted decision only when commercial YouTube use is genuinely approved.
2. Import and review the API-format ComfyUI templates with scripts\Import-ComfyWorkflow.mjs.
3. Build the candidate image with scripts\Build-GpuWorker.ps1 -AllowCandidate. Push it to your private registry and record its immutable digest.
4. Create one controlled RunPod qualification worker using the generated environment template. Do not expose ComfyUI port 8188; expose only authenticated gateway port 8000.
5. Download studio-model-qualification.json and studio-capability.json. Run every listed core benchmark, security, recovery, cost, and shutdown test and link its evidence. Advanced control, native-audio, foley, and adaptation candidates stay locked.
6. Terminate the qualification Pod and confirm provider termination. Storage may continue to cost money if a persistent volume is retained.
7. Run scripts\Promote-GpuWorker.mjs with the three evidence files. It creates production files only if every lock passes.

The candidate desktop app cannot start paid work. Promotion is a one-time release-engineering step, not something an ordinary creator repeats for every episode.
'@
$instructions | Set-Content -LiteralPath (Join-Path $outputPath 'READ-ME-FIRST.txt') -Encoding utf8NoBOM

Write-Output "Qualification bundle created at $outputPath"
Write-Output 'No cloud machine was created and no paid action was taken.'

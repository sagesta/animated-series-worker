[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9._/-]+:[a-zA-Z0-9._-]+$')]
  [string]$ImageName,
  [switch]$AllowCandidate
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$productionPack = Join-Path $projectRoot 'config\workflow-pack.production.json'
$candidatePack = Join-Path $projectRoot 'config\workflow-pack.candidate.json'
$productionManifest = Join-Path $projectRoot 'config\model-install-manifest.production.json'
$candidateManifest = Join-Path $projectRoot 'config\model-install-manifest.candidate.json'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop is required to build the GPU worker.'
}

if (-not (Test-Path -LiteralPath $productionPack) -and -not $AllowCandidate) {
  throw 'The production workflow pack does not exist yet. Finish qualification, or use -AllowCandidate only for a no-production test image.'
}

$useProduction = (Test-Path -LiteralPath $productionPack) -and (Test-Path -LiteralPath $productionManifest)
if ((Test-Path -LiteralPath $productionPack) -xor (Test-Path -LiteralPath $productionManifest)) {
  throw 'The production workflow pack and model manifest must be promoted together.'
}
$selectedPack = if ($useProduction) { $productionPack } else { $candidatePack }
$selectedManifest = if ($useProduction) { $productionManifest } else { $candidateManifest }
$selectedPackName = Split-Path -Leaf $selectedPack
$selectedManifestName = Split-Path -Leaf $selectedManifest
$pack = Get-Content -LiteralPath $selectedPack -Raw | ConvertFrom-Json
if ($pack.workerImageDigest -and $AllowCandidate) {
  Write-Warning 'A production-like digest is present; verify that this is intentionally a candidate build.'
}

Push-Location $projectRoot
try {
  docker build --pull --file worker/Dockerfile --build-arg "WORKFLOW_PACK_FILE=$selectedPackName" --build-arg "MODEL_MANIFEST_FILE=$selectedManifestName" --tag $ImageName .
  if ($LASTEXITCODE -ne 0) { throw 'The worker image build failed.' }
  docker image inspect $ImageName --format '{{.Id}}'
  if ($LASTEXITCODE -ne 0) { throw 'The built image could not be inspected.' }
} finally {
  Pop-Location
}

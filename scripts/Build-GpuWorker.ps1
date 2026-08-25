[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9][a-z0-9._/-]+:[a-zA-Z0-9._-]+$')]
  [string]$ImageName,
  [switch]$AllowCandidate,
  [ValidatePattern('^[a-zA-Z0-9._-]+$')]
  [string]$WslDistribution = 'Ubuntu'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$productionPack = Join-Path $projectRoot 'config\workflow-pack.production.json'
$candidatePack = Join-Path $projectRoot 'config\workflow-pack.candidate.json'
$productionManifest = Join-Path $projectRoot 'config\model-install-manifest.production.json'
$candidateManifest = Join-Path $projectRoot 'config\model-install-manifest.candidate.json'

$dockerMode = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { $dockerMode = 'native' }
}
if (-not $dockerMode -and (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  wsl.exe -d $WslDistribution -u root -- docker info *> $null
  if ($LASTEXITCODE -eq 0) { $dockerMode = 'wsl' }
}
if (-not $dockerMode) {
  throw 'A running Docker engine is required, either directly on Windows or inside WSL2.'
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
$workerRelease = $ImageName.Substring($ImageName.LastIndexOf(':') + 1)
$pack = Get-Content -LiteralPath $selectedPack -Raw | ConvertFrom-Json
if ($pack.workerImageDigest -and $AllowCandidate) {
  Write-Warning 'A production-like digest is present; verify that this is intentionally a candidate build.'
}

Push-Location $projectRoot
try {
  if ($dockerMode -eq 'native') {
    docker build --pull --file worker/Dockerfile --build-arg "STUDIO_RELEASE=$workerRelease" --build-arg "WORKFLOW_PACK_FILE=$selectedPackName" --build-arg "MODEL_MANIFEST_FILE=$selectedManifestName" --tag $ImageName .
    if ($LASTEXITCODE -ne 0) { throw 'The worker image build failed.' }
    docker image inspect $ImageName --format '{{.Id}}'
    if ($LASTEXITCODE -ne 0) { throw 'The built image could not be inspected.' }
  } else {
    $resolvedProjectRoot = (Resolve-Path -LiteralPath $projectRoot).Path
    if ($resolvedProjectRoot -notmatch '^([a-zA-Z]):\\(.+)$') {
      throw 'The project must be on a local Windows drive for the WSL2 Docker build.'
    }
    $wslDrive = $Matches[1].ToLowerInvariant()
    $wslPathTail = $Matches[2].Replace('\', '/')
    $wslProjectRoot = "/mnt/$wslDrive/$wslPathTail"
    wsl.exe -d $WslDistribution -u root -- docker build --pull --file "$wslProjectRoot/worker/Dockerfile" --build-arg "STUDIO_RELEASE=$workerRelease" --build-arg "WORKFLOW_PACK_FILE=$selectedPackName" --build-arg "MODEL_MANIFEST_FILE=$selectedManifestName" --tag $ImageName $wslProjectRoot
    if ($LASTEXITCODE -ne 0) { throw 'The WSL2 worker image build failed.' }
    wsl.exe -d $WslDistribution -u root -- docker image inspect $ImageName --format '{{.Id}}'
    if ($LASTEXITCODE -ne 0) { throw 'The built WSL2 image could not be inspected.' }
  }
} finally {
  Pop-Location
}

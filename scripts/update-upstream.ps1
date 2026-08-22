param(
    [string]$Ref = "origin/main",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $projectRoot "vendor\shuohao-skills"
$lockPath = Join-Path $projectRoot "config\upstream.lock.json"

function Invoke-Git {
    param(
        [string]$Repository,
        [string[]]$GitArgs
    )

    $output = & git -C $Repository @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed in $Repository`n$($output -join "`n")"
    }
    return $output
}

if (-not (Test-Path -LiteralPath $vendorRoot)) {
    throw "Pinned upstream folder is missing: $vendorRoot. Run git submodule update --init first."
}

if (-not (Test-Path -LiteralPath $lockPath)) {
    throw "Upstream lock file is missing: $lockPath"
}

$submoduleStatus = (Invoke-Git -Repository $vendorRoot -GitArgs @("status", "--porcelain")) -join "`n"
if (-not [string]::IsNullOrWhiteSpace($submoduleStatus)) {
    throw "The upstream submodule has local changes. This tool will not overwrite them."
}

$lockTextBefore = [System.IO.File]::ReadAllText($lockPath)
$lock = $lockTextBefore | ConvertFrom-Json
$currentCommit = ((Invoke-Git -Repository $vendorRoot -GitArgs @("rev-parse", "HEAD")) -join "").Trim()

if ($currentCommit -ne $lock.commit) {
    throw "Current submodule commit ($currentCommit) does not match the lock file ($($lock.commit)). Reconcile this before updating."
}

Write-Output "Fetching the upstream repository..."
Invoke-Git -Repository $vendorRoot -GitArgs @("fetch", "--prune", "origin") | Out-Null
$candidateCommit = ((Invoke-Git -Repository $vendorRoot -GitArgs @("rev-parse", "$Ref^{commit}")) -join "").Trim()

Write-Output "Current pinned commit:  $currentCommit"
Write-Output "Candidate commit:       $candidateCommit"
Write-Output "Candidate reference:    $Ref"

if ($candidateCommit -eq $currentCommit) {
    Write-Output "The studio is already pinned to this commit. No update is needed."
    exit 0
}

if (-not $Apply) {
    Write-Output "Preview complete. No files were changed. Re-run with -Apply to test and stage this candidate."
    exit 0
}

$rootStatus = (Invoke-Git -Repository $projectRoot -GitArgs @("status", "--porcelain")) -join "`n"
if (-not [string]::IsNullOrWhiteSpace($rootStatus)) {
    throw "The studio repository has uncommitted changes. Commit or safely set them aside before applying an upstream update."
}

try {
    Write-Output "Checking out the candidate in detached mode..."
    Invoke-Git -Repository $vendorRoot -GitArgs @("checkout", "--detach", $candidateCommit) | Out-Null

    $testFiles = @()
    $testFiles += Get-ChildItem -LiteralPath (Join-Path $vendorRoot "skills") -Recurse -Filter "selftest.mjs" |
        Sort-Object FullName |
        ForEach-Object { $_.FullName }
    $testFiles += Join-Path $vendorRoot "scripts\report-selftest.mjs"

    foreach ($testFile in $testFiles) {
        Write-Output "Running $testFile"
        & node $testFile
        if ($LASTEXITCODE -ne 0) {
            throw "Upstream self-test failed: $testFile"
        }
    }

    $studioCompatibilityTest = Join-Path $projectRoot "packages\upstream-adapter\src\index.test.ts"
    $studioTestCount = 0
    if (Test-Path -LiteralPath $studioCompatibilityTest) {
        Write-Output "Running studio upstream compatibility tests..."
        & pnpm vitest run packages/upstream-adapter/src/index.test.ts --pool=forks --maxWorkers=1
        if ($LASTEXITCODE -ne 0) {
            throw "Studio upstream compatibility tests failed."
        }
        $studioTestCount = 1
    } else {
        Write-Warning "Studio adapter compatibility tests are missing. This candidate cannot be promoted."
    }

    $lock.commit = $candidateCommit
    $lock.verifiedOn = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
    $lock.verification.skillSelfTests = ($testFiles.Count - 1)
    $lock.verification.reportSelfTests = 1
    $lock.verification.studioContractTests = $studioTestCount
    $lock.verification.note = if ($studioTestCount -gt 0) {
        "Upstream and studio compatibility tests passed."
    } else {
        "Upstream tests passed; studio contract tests are still required before production promotion."
    }

    $lockJson = $lock | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($lockPath, "$lockJson`n", [System.Text.UTF8Encoding]::new($false))

    Write-Output "Running documentation and lock checks..."
    & node (Join-Path $projectRoot "scripts\check-docs.mjs")
    if ($LASTEXITCODE -ne 0) {
        throw "Documentation/lock checks failed."
    }

    Write-Output "Candidate tests passed and the submodule/lock changes are prepared for human review."
    Write-Output "Before accepting: review upstream changes, run media/adapter benchmarks, update compatibility docs and CHANGELOG.md, then commit both the gitlink and lock file."
}
catch {
    Write-Warning "Candidate update failed. Restoring the previous pin."
    Invoke-Git -Repository $vendorRoot -GitArgs @("checkout", "--detach", $currentCommit) | Out-Null
    [System.IO.File]::WriteAllText($lockPath, $lockTextBefore, [System.Text.UTF8Encoding]::new($false))
    throw
}

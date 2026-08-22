[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Test-MediaTools {
  $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
  $ffprobe = Get-Command ffprobe -ErrorAction SilentlyContinue
  if (-not $ffmpeg -or -not $ffprobe) { return $false }

  $filters = & $ffmpeg.Source -hide_banner -filters 2>&1 | Out-String
  $encoders = & $ffmpeg.Source -hide_banner -encoders 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { return $false }
  return $filters.Contains(' drawtext ') -and
    $filters.Contains(' subtitles ') -and
    $encoders.Contains('libx264') -and
    $encoders.Contains(' aac ')
}

if (Test-MediaTools) {
  Write-Host 'The free local media tools are already ready.'
  & ffmpeg -hide_banner -version | Select-Object -First 1
  exit 0
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw 'Windows Package Manager is unavailable. Install App Installer from Microsoft, then run this setup again.'
}

Write-Host 'Installing the free local media tools. This does not rent a GPU.'
winget install --id Gyan.FFmpeg.Essentials --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
if ($LASTEXITCODE -ne 0) { throw 'The free local media tools could not be installed.' }

Write-Host 'Installation finished. Close and reopen Animated Series Studio so Windows can refresh the tool path.'

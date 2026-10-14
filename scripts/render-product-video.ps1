param([Parameter(Mandatory=$true)][string]$Python)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskComposer = Join-Path $taskRoot '.tools/openmontage/bacf55796fc6/OpenMontage-main/remotion-composer'
& $Python (Join-Path $taskRoot 'scripts/prepare-product-video.py')
if ($LASTEXITCODE -ne 0) { throw 'Video preparation failed' }
& (Join-Path $PSScriptRoot 'narrate-product-video.ps1')
& $Python (Join-Path $PSScriptRoot 'video-audio.py')
if ($LASTEXITCODE -ne 0) { throw 'Narration assembly failed' }
$taskBrowser = (Get-Content -LiteralPath (Join-Path $taskRoot '.oax/browser-install.json') -Raw | ConvertFrom-Json).executable
Push-Location $taskComposer
try {
    & node 'node_modules/@remotion/cli/remotion-cli.js' render src/index.tsx Explainer (Join-Path $taskRoot 'dist/product-video/oax-60s.mp4') --props (Join-Path $taskRoot 'dist/product-video/props.json') --codec h264 --frames 0-1799 --concurrency 2 --browser-executable $taskBrowser --overwrite
    if ($LASTEXITCODE -ne 0) { throw 'OpenMontage render failed' }
} finally { Pop-Location }
$taskFfmpeg = Join-Path $taskComposer 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'
& $taskFfmpeg -v error -i (Join-Path $taskRoot 'dist/product-video/oax-60s.mp4') -t 60 -c copy -movflags +faststart -y (Join-Path $taskRoot 'dist/product-video/oax-product-video.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Video finalization failed' }

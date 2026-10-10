param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CommandArgs)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskCli = Join-Path $taskRoot '.tools/hyperframes-cli/node_modules/hyperframes/bin/hyperframes.mjs'
$taskBrowser = Get-Content -LiteralPath (Join-Path $taskRoot '.oax/hyperframes-browser.json') | ConvertFrom-Json
$taskFf = Join-Path $taskRoot '.tools/openmontage/bacf55796fc6/OpenMontage-main/remotion-composer/node_modules/@remotion/compositor-win32-x64-msvc'
$taskEncoders = @(Get-ChildItem -LiteralPath (Join-Path $taskRoot '.tools/video-python/imageio_ffmpeg/binaries') -Filter 'ffmpeg*.exe')
if ($taskEncoders.Count -ne 1) { throw 'Install the pinned imageio-ffmpeg wheel before rendering' }
foreach ($taskPath in @($taskCli, $taskBrowser.executable, $taskEncoders[0].FullName, (Join-Path $taskFf 'ffprobe.exe'))) {
    if (-not (Test-Path -LiteralPath $taskPath -PathType Leaf)) { throw "Missing authoring prerequisite: $taskPath" }
}
$env:HYPERFRAMES_NO_TELEMETRY = '1'
$env:HYPERFRAMES_BROWSER_PATH = $taskBrowser.executable
$env:HYPERFRAMES_FFMPEG_PATH = $taskEncoders[0].FullName
$env:HYPERFRAMES_FFPROBE_PATH = Join-Path $taskFf 'ffprobe.exe'
& node $taskCli @CommandArgs
exit $LASTEXITCODE

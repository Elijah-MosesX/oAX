$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskScenes = Get-Content -LiteralPath (Join-Path $taskRoot 'docs/video/storyboard.json') -Raw | ConvertFrom-Json
$taskSpeaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $taskSpeaker.SelectVoice('Microsoft Zira Desktop')
    $taskSpeaker.Rate = 2
    $taskIndex = 0
    foreach ($taskScene in $taskScenes) {
        $taskIndex++
        $taskSpeaker.SetOutputToWaveFile((Join-Path $taskRoot "dist/product-video/voice-$taskIndex.wav"))
        $taskSpeaker.Speak($taskScene.narration)
        $taskSpeaker.SetOutputToNull()
    }
} finally { $taskSpeaker.Dispose() }

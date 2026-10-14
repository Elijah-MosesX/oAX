param([switch]$Offline)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$jdk = Join-Path $repo '.tools/jdk21/jdk-21.0.12.1+1'
$gradle = Join-Path $repo '.tools/gradle/gradle-8.14.3/bin/gradle.bat'
if (!(Test-Path -LiteralPath "$jdk/bin/java.exe") -or !(Test-Path -LiteralPath $gradle)) {
    throw 'Install the pinned portable Java 21 and Gradle 8.14.3 tools described in docs/adapters.md.'
}
$socketDir = Join-Path $repo '.oax/java-tmp'
if ([Text.Encoding]::UTF8.GetByteCount($socketDir) -gt 80) {
    throw 'Use a shorter checkout path for Java temporary UNIX-domain socket names.'
}
New-Item -ItemType Directory -Force -Path $socketDir | Out-Null
$savedJava = $env:JAVA_HOME
$savedGradle = $env:GRADLE_USER_HOME
$savedOptions = $env:JAVA_TOOL_OPTIONS
try {
    $env:JAVA_HOME = $jdk
    $env:GRADLE_USER_HOME = Join-Path $repo '.tools/gradle-cache'
    # The documented socket directory override also reaches Gradle's child workers.
    $env:JAVA_TOOL_OPTIONS = ($savedOptions + ' "-Djdk.net.unixdomain.tmpdir=' + $socketDir + '"').Trim()
    $arguments = @('-p', (Join-Path $repo 'adapters/jetbrains'), 'buildPlugin', 'verifyPluginStructure', '--no-daemon', '--console=plain')
    if ($Offline) { $arguments += '--offline' }
    & $gradle @arguments
    if ($LASTEXITCODE -ne 0) { throw "JetBrains packaging failed with exit code $LASTEXITCODE" }
    $archive = Join-Path $repo 'adapters/jetbrains/build/distributions/oax-jetbrains.zip'
    if (!(Test-Path -LiteralPath $archive)) { throw 'Expected plugin ZIP was not produced.' }
    $receipt = @{
        generatedAt = [DateTime]::UtcNow.ToString('o')
        archive = $archive
        sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        idea = '2025.2.1'
        gradle = '8.14.3'
        packaged = $true
        structureVerified = $true
        liveIdeVerified = $false
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $repo 'dist') | Out-Null
    $receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repo 'dist/jetbrains-package.json') -Encoding utf8
    Write-Output "Verified local plugin package: $archive"
} finally {
    $env:JAVA_HOME = $savedJava
    $env:GRADLE_USER_HOME = $savedGradle
    $env:JAVA_TOOL_OPTIONS = $savedOptions
}

param([string]$Jdk = (Join-Path $PSScriptRoot '../.tools/jdk21/jdk-21.0.12.1+1'))
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskTools=Join-Path $taskRoot '.tools'
$taskGo=Join-Path $taskTools 'go1.27.1'
$taskWorker=Join-Path $taskTools 'language-workers'
New-Item -ItemType Directory -Path $taskWorker -Force | Out-Null
$taskZip=Join-Path $taskTools 'go1.27.1.windows-amd64.zip'
if (-not (Test-Path -LiteralPath $taskZip)) { Invoke-WebRequest -Uri 'https://go.dev/dl/go1.27.1.windows-amd64.zip' -OutFile $taskZip }
if ((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'a3911b5e0e1b1053f25ed0675f4c1c6aad1e2bfcf253df2b9be4caabd2edd95d') { throw 'Go archive checksum mismatch' }
if (-not (Test-Path -LiteralPath (Join-Path $taskGo 'go/bin/go.exe'))) { Expand-Archive -LiteralPath $taskZip -DestinationPath $taskGo }
Copy-Item -LiteralPath (Join-Path $taskRoot 'services/indexer/workers/python_parser.py') -Destination $taskWorker
$env:GOTOOLCHAIN='local'; $env:GOPROXY='off'; $env:GOSUMDB='off'; $env:CGO_ENABLED='0'
$env:GOCACHE=Join-Path $taskTools 'go-build-cache'
& (Join-Path $taskGo 'go/bin/go.exe') build -trimpath -o (Join-Path $taskWorker 'go_parser.exe') (Join-Path $taskRoot 'services/indexer/workers/go_parser.go')
if ($LASTEXITCODE -ne 0) { throw 'Go parser build failed' }
& (Join-Path $Jdk 'bin/javac.exe') -proc:none -encoding UTF-8 -d $taskWorker (Join-Path $taskRoot 'services/indexer/workers/OaxJavaParser.java')
if ($LASTEXITCODE -ne 0) { throw 'Java parser build failed' }
Write-Output "Parser workers built in $taskWorker. Configure OAX_LANGUAGE_WORKERS, OAX_PYTHON, OAX_JAVA and OAX_GO_PARSER explicitly before starting the runtime."

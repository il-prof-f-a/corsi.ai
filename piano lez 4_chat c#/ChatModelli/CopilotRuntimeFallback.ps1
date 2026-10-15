param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Platform,
    [Parameter(Mandatory = $true)][string]$CacheDirectory,
    [Parameter(Mandatory = $true)][string]$RuntimeWrapper
)

$ErrorActionPreference = 'Stop'
$assetName = "github-copilot-$Version-$Platform.tgz"
$releaseUrl = "https://github.com/github/copilot-cli/releases/download/v$Version"
$cacheDirectory = [System.IO.Path]::GetFullPath($CacheDirectory)
$runtimePath = Join-Path $cacheDirectory "prebuilds\$Platform\$RuntimeWrapper"
$runtimeNodePath = Join-Path $cacheDirectory "prebuilds\$Platform\runtime.node"
$completeMarker = Join-Path $cacheDirectory '.copilot-runtime-complete'
$checksumPath = Join-Path $cacheDirectory 'SHA256SUMS.txt'
$archivePath = Join-Path $cacheDirectory 'copilot.tgz'

if ((Test-Path -LiteralPath $completeMarker) -and
    (Test-Path -LiteralPath $runtimePath) -and
    (Test-Path -LiteralPath $runtimeNodePath)) {
    exit 0
}

New-Item -ItemType Directory -Path $cacheDirectory -Force | Out-Null
if (!(Test-Path -LiteralPath $checksumPath)) {
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/SHA256SUMS.txt" -OutFile $checksumPath
}

$checksumMatches = @(Get-Content -LiteralPath $checksumPath | Where-Object {
    $_ -match ('^([0-9a-fA-F]{64})\s+\*?' + [regex]::Escape($assetName) + '\s*$')
})
if ($checksumMatches.Count -ne 1) {
    throw "SHA256SUMS.txt non contiene un checksum univoco per $assetName."
}

$expectedHash = $checksumMatches[0].Substring(0, 64).ToUpperInvariant()
if (!(Test-Path -LiteralPath $archivePath) -or
    (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToUpperInvariant() -ne $expectedHash) {
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/$assetName" -OutFile $archivePath
}

$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualHash -ne $expectedHash) {
    throw "Checksum SHA-256 non valido per $assetName."
}
Write-Host "Runtime Copilot $Version scaricato e verificato."

$tarPath = Join-Path $env:SystemRoot 'System32\tar.exe'
& $tarPath -xzf $archivePath --strip-components=1 -C $cacheDirectory
if ($LASTEXITCODE -ne 0) {
    throw "Estrazione del runtime GitHub Copilot non riuscita (codice $LASTEXITCODE)."
}

if (!(Test-Path -LiteralPath $runtimePath) -or !(Test-Path -LiteralPath $runtimeNodePath)) {
    throw 'Il pacchetto estratto non contiene il runtime Copilot completo.'
}

Set-Content -LiteralPath $completeMarker -Value $Version -NoNewline

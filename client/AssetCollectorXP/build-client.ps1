$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root 'bin'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc = Join-Path $framework 'csc.exe'

if (-not (Test-Path $csc)) {
  $framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319'
  $csc = Join-Path $framework 'csc.exe'
}

if (-not (Test-Path $csc)) {
  throw '.NET Framework 4.0 compiler was not found.'
}

$clientName = [string]::Concat(
  [char]0x8ba1, [char]0x7b97, [char]0x673a,
  [char]0x4fe1, [char]0x606f,
  [char]0x6838, [char]0x67e5,
  '-XP')
$exePath = Join-Path $bin ($clientName + '.exe')
$iconPath = Join-Path $root 'app.ico'

New-Item -ItemType Directory -Force -Path $bin | Out-Null

$compilerArgs = @(
  '/nologo',
  '/target:winexe',
  '/platform:x86',
  '/langversion:4',
  '/codepage:65001',
  '/optimize+',
  ('/out:' + $exePath),
  '/reference:System.dll',
  '/reference:System.Core.dll',
  '/reference:System.Data.dll',
  '/reference:System.Drawing.dll',
  '/reference:System.Management.dll',
  '/reference:System.ServiceProcess.dll',
  '/reference:System.Web.Extensions.dll',
  '/reference:System.Windows.Forms.dll',
  '/reference:System.Xml.dll'
)

if (Test-Path $iconPath) {
  $compilerArgs += ('/win32icon:' + $iconPath)
}

$compilerArgs += @(
  "$root\Program.cs",
  "$root\InstallForm.cs",
  "$root\SecurityClient.cs",
  "$root\PasswordPromptForm.cs",
  "$root\AgentService.cs",
  "$root\AgentSettings.cs",
  "$root\AgentTrayContext.cs",
  "$root\MainForm.cs",
  "$root\Models.cs",
  "$root\ClientStorageSettings.cs",
  "$root\OfflineStore.cs",
  "$root\AssetExcelExporter.cs",
  "$root\DiscoveryClient.cs",
  "$root\NativeDiskSerialReader.cs",
  "$root\HardwareCollector.cs",
  "$root\ApiClient.cs"
)

& $csc $compilerArgs

if ($LASTEXITCODE -ne 0) {
  throw "Client build failed with exit code $LASTEXITCODE."
}

Copy-Item "$root\AssetCollector.exe.config" ($exePath + '.config') -Force
Copy-Item "$root\start-xp-client.cmd" (Join-Path $bin 'start-xp-client.cmd') -Force
Copy-Item "$root\XP-README.txt" (Join-Path $bin 'XP-README.txt') -Force

$repoRoot = Split-Path -Parent (Split-Path -Parent $root)
$serverRoot = Join-Path $repoRoot 'server'
$updateDir = Join-Path $serverRoot 'client-updates'
$dataDir = Join-Path $serverRoot 'data'
New-Item -ItemType Directory -Force -Path $updateDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($exePath).FileVersion
$updateExeName = 'it-asset-client-xp-' + $version + '.exe'
$updateConfigName = $updateExeName + '.config'
$updateExePath = Join-Path $updateDir $updateExeName
$updateConfigPath = Join-Path $updateDir $updateConfigName
Copy-Item $exePath $updateExePath -Force
Copy-Item ($exePath + '.config') $updateConfigPath -Force

$manifest = [ordered]@{
  version = $version
  fileName = $updateExeName
  configFile = $updateConfigName
  sha256 = (Get-FileHash -Algorithm SHA256 $updateExePath).Hash.ToLowerInvariant()
  publishedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  notes = 'Auto-published XP client by build-client.ps1'
}
if ($env:ASSET_UPDATE_SIGNING_PRIVATE_KEY) {
  $env:ASSET_UPDATE_SIGNING_PAYLOAD = "$($manifest.version)`n$($manifest.fileName)`n$($manifest.sha256)"
  $signatureScript = "const crypto=require('crypto');const key=process.env.ASSET_UPDATE_SIGNING_PRIVATE_KEY.replace(/\\n/g,'\n');const payload=process.env.ASSET_UPDATE_SIGNING_PAYLOAD;const signer=crypto.createSign('RSA-SHA256');signer.update(payload,'utf8');signer.end();console.log(signer.sign(key,'base64'));"
  $signature = & node -e $signatureScript
  if ($LASTEXITCODE -ne 0 -or -not $signature) {
    throw 'Failed to sign XP client update manifest.'
  }
  $manifest.signature = $signature.Trim()
}
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $dataDir 'client-update-xp.json'), $manifestJson, (New-Object System.Text.UTF8Encoding($false)))

if (Select-String -Path $exePath -Pattern 'CurrentManagedThreadId' -SimpleMatch -Quiet) {
  throw 'XP build contains Environment.CurrentManagedThreadId. Remove iterator/yield-generated state machines or compile with a true .NET 4.0 toolchain.'
}

Write-Host "Built $exePath"
Write-Host "Published XP update manifest to $(Join-Path $dataDir 'client-update-xp.json')"

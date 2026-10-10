$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'com.noobatwork.voicemeeter.sdPlugin'
$plugins = Join-Path $env:APPDATA 'Elgato\StreamDeck\Plugins'
$dest = Join-Path $plugins 'com.noobatwork.voicemeeter.sdPlugin'
$backupRoot = Join-Path $env:APPDATA 'NoobatWork\VoicemeeterControl\Backups'
if (-not (Test-Path (Join-Path $src 'manifest.json'))) { throw "Plugin source not found. Extract the full ZIP first." }
if (Get-Process -Name 'StreamDeck' -ErrorAction SilentlyContinue) {
  throw "Close the Stream Deck desktop application completely (including system tray), then run INSTALL.bat again."
}
New-Item -ItemType Directory -Force -Path $plugins | Out-Null
$backup = $null
if (Test-Path -LiteralPath $dest) {
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
  $backup = Join-Path $backupRoot "com.noobatwork.voicemeeter.sdPlugin-$stamp"
  Move-Item -LiteralPath $dest -Destination $backup -ErrorAction Stop
  Write-Host "Previous version backed up to: $backup"
}
try {
  Copy-Item -LiteralPath $src -Destination $dest -Recurse -ErrorAction Stop
  Write-Host "Installed NoobatWork Voicemeeter Control v0.2.1-alpha"
  Write-Host "Restart Stream Deck."
} catch {
  if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Force -Recurse -ErrorAction SilentlyContinue }
  if ($backup -and (Test-Path -LiteralPath $backup)) { Move-Item -LiteralPath $backup -Destination $dest -ErrorAction SilentlyContinue }
  throw
}

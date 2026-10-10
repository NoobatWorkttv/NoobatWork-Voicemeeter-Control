$ErrorActionPreference='Stop'
$src=Join-Path $PSScriptRoot 'com.noobatwork.voicemeeter.sdPlugin'
$plugins=Join-Path $env:APPDATA 'Elgato\StreamDeck\Plugins'
$dest=Join-Path $plugins 'com.noobatwork.voicemeeter.sdPlugin'
if(Test-Path $dest){throw "Existing plugin installation: $dest"}
New-Item -ItemType Directory -Force -Path $plugins | Out-Null
Copy-Item -LiteralPath $src -Destination $dest -Recurse
Write-Host "Installed to $dest"

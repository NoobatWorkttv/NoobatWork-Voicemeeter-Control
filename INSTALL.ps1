$ErrorActionPreference='Stop'
$script=Join-Path $PSScriptRoot 'installer\Setup.ps1'
$plugin=Join-Path $PSScriptRoot 'com.noobatwork.voicemeeter.sdPlugin'
if(-not(Test-Path -LiteralPath $script)){throw 'Der automatische Installer fehlt. Bitte ZIP vollständig entpacken.'}
& $script -PluginPath $plugin
if($LASTEXITCODE -ne 0){throw 'Update fehlgeschlagen. Siehe %APPDATA%\NoobatWork\VoicemeeterControl\setup.log'}

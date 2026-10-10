param([Parameter(Mandatory=$true)][string]$PluginPath)
$ErrorActionPreference='Stop'
$dest=Join-Path $env:APPDATA 'Elgato\StreamDeck\Plugins\com.noobatwork.voicemeeter.sdPlugin'
$base=Join-Path $env:APPDATA 'NoobatWork\VoicemeeterControl'
$backupRoot=Join-Path $base 'Backups'
$log=Join-Path $base 'setup.log'
$previous=$null; $exe=$null; $installed=$false; $stopped=$false
New-Item -ItemType Directory -Force -Path $base | Out-Null
function Note([string]$message) {
  $line="$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
  Write-Host $line
  Add-Content -Path $log -Value $line -Encoding UTF8
}
function FindStreamDeck {
  $paths=@(
    (Join-Path $env:ProgramFiles 'Elgato\StreamDeck\StreamDeck.exe'),
    (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Elgato\StreamDeck\StreamDeck.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Elgato\StreamDeck\StreamDeck.exe')
  )
  foreach($path in $paths){if($path -and (Test-Path -LiteralPath $path)){return $path}}
  return $null
}
try {
  Note '=== NoobatWork Stream Deck Setup v0.5.1-alpha ==='
  $mf=Join-Path $PluginPath 'manifest.json'
  if(-not(Test-Path -LiteralPath $mf)){throw 'manifest.json fehlt.'}
  $v=(Get-Content -LiteralPath $mf -Raw | ConvertFrom-Json).Version
  if($v -ne '0.5.1.0'){throw "Falsche Plugin-Version: $v"}
  if(-not(Test-Path -LiteralPath (Join-Path $PluginPath 'plugin.js'))){throw 'plugin.js fehlt.'}
  if(-not(Test-Path -LiteralPath (Join-Path $PluginPath 'bin\NoobatWorkAudioSessions.exe'))){throw 'AudioSessions.exe fehlt.'}
  $exe=FindStreamDeck
  $procs=@(Get-Process -Name StreamDeck -ErrorAction SilentlyContinue)
  if($procs.Count -gt 0){
    foreach($p in $procs){
      try {if(-not $exe -and $p.Path){$exe=$p.Path}}catch{}
      try {[void]$p.CloseMainWindow()}catch{}
    }
    Note 'Stream Deck wird automatisch beendet.'
    Start-Sleep -Seconds 3
    foreach($p in @(Get-Process -Name StreamDeck -ErrorAction SilentlyContinue)){
      Stop-Process -Id $p.Id -Force -ErrorAction Stop
    }
    Start-Sleep -Milliseconds 500
    if(Get-Process -Name StreamDeck -ErrorAction SilentlyContinue){throw 'Stream Deck konnte nicht beendet werden.'}
  }
  $stopped=$true
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  if(Test-Path -LiteralPath $dest){
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $previous=Join-Path $backupRoot ('com.noobatwork.voicemeeter.sdPlugin-'+(Get-Date -Format 'yyyyMMdd-HHmmssfff'))
    Move-Item -LiteralPath $dest -Destination $previous -ErrorAction Stop
    Note "Alte Version gesichert: $previous"
  }
  Copy-Item -LiteralPath $PluginPath -Destination $dest -Recurse -ErrorAction Stop
  if(-not(Test-Path -LiteralPath (Join-Path $dest 'manifest.json'))){throw 'Kopierte Dateien konnten nicht geprüft werden.'}
  $installed=$true
  Note "Plugin installiert: $dest"
} catch {
  Note "FEHLER: $($_.Exception.Message)"
  if(-not $installed){
    if(Test-Path -LiteralPath $dest){Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue}
    if($previous -and (Test-Path -LiteralPath $previous)){
      try {Move-Item -LiteralPath $previous -Destination $dest -ErrorAction Stop; Note 'Backup wiederhergestellt.'}
      catch {Note "Backup liegt weiterhin unter $previous"}
    }
  }
} finally {
  if($stopped) {
    if(-not $exe){$exe=FindStreamDeck}
    if($exe -and (Test-Path -LiteralPath $exe)){
      try{Start-Process -FilePath $exe -ErrorAction Stop; Note 'Stream Deck automatisch gestartet.'}
      catch {Note "WARNUNG: Stream Deck manuell starten: $($_.Exception.Message)"}
    } else {Note 'WARNUNG: StreamDeck.exe nicht gefunden; bitte manuell starten.'}
  }
}
if(-not $installed){exit 1}
exit 0

#define AppVer "0.5.0-alpha"
[Setup]
AppId={{F4B923AF-8929-46BC-940D-27A014A75638}
AppName=NoobatWork Voicemeeter Control
AppVersion={#AppVer}
AppPublisher=NoobatWork
AppPublisherURL=https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control
DefaultDirName={localappdata}\NoobatWork\VoicemeeterControl
DisableDirPage=yes
CreateAppDir=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=NoobatWork-Voicemeeter-Control-v0.5.0-alpha-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no
Uninstallable=no

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Files]
Source: "com.noobatwork.voicemeeter.sdPlugin\*"; DestDir: "{tmp}\NoobatWork-Payload\com.noobatwork.voicemeeter.sdPlugin"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "installer\Setup.ps1"; DestDir: "{tmp}\NoobatWork-Payload"; Flags: ignoreversion

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  Code: Integer;
  Cmd: String;
  Ok: Boolean;
begin
  if CurStep = ssPostInstall then begin
    Cmd := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
      ExpandConstant('{tmp}\NoobatWork-Payload\Setup.ps1') + '" -PluginPath "' +
      ExpandConstant('{tmp}\NoobatWork-Payload\com.noobatwork.voicemeeter.sdPlugin') + '"';
    WizardForm.StatusLabel.Caption := 'Stream Deck wird beendet, aktualisiert und gestartet ...';
    Ok := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Cmd, '', SW_HIDE, ewWaitUntilTerminated, Code);
    if (not Ok) or (Code <> 0) then
      RaiseException('Installation fehlgeschlagen. Bitte Setup-Protokoll unter %APPDATA%\NoobatWork\VoicemeeterControl\setup.log prüfen.');
  end;
end;

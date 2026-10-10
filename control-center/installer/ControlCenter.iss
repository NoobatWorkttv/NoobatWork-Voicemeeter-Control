#define MyVersion "0.2.0"
[Setup]
AppId={{240AF10C-B25D-4B98-A743-21C17BE2F02F}
AppName=NoobatWork Mixer Control Center
AppVersion={#MyVersion}
AppPublisher=NoobatWork
DefaultDirName={localappdata}\Programs\NoobatWork\Mixer Control Center
DefaultGroupName=NoobatWork Mixer Control Center
PrivilegesRequired=lowest
SourceDir=..
OutputDir=dist
OutputBaseFilename=NoobatWork-Mixer-Control-Center-v0.2.0-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\NoobatWork-Mixer-Control-Center.exe
[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; Flags: unchecked
[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\NoobatWork Mixer Control Center"; Filename: "{app}\NoobatWork-Mixer-Control-Center.exe"
Name: "{autodesktop}\NoobatWork Mixer Control Center"; Filename: "{app}\NoobatWork-Mixer-Control-Center.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\NoobatWork-Mixer-Control-Center.exe"; Description: "Control Center starten"; Flags: nowait postinstall skipifsilent

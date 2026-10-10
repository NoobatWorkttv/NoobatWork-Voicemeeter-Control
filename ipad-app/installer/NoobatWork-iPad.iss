#define MyVersion "0.1.2-preview"
[Setup]
AppId={{7B3E38AD-D255-4294-BC23-2D3D2A1DD0E7}
AppName=NoobatWork Audio Mixer - iPad Edition
AppVersion={#MyVersion}
AppPublisher=NoobatWork
AppPublisherURL=https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control
DefaultDirName={localappdata}\Programs\NoobatWork\iPad Mixer
DefaultGroupName=NoobatWork
DisableDirPage=yes
PrivilegesRequired=lowest
SourceDir=..
OutputDir=dist
OutputBaseFilename=NoobatWork-iPad-Mixer-v0.1.2-preview-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\NoobatWork-iPad-Mixer.exe

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Tasks]
Name: "desktopicon"; Description: "Desktop-Verknüpfung erstellen"; GroupDescription: "Zusätzliche Optionen:"; Flags: unchecked

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\NoobatWork Audio Mixer - iPad Edition"; Filename: "{app}\NoobatWork-iPad-Mixer.exe"
Name: "{autodesktop}\NoobatWork Audio Mixer - iPad Edition"; Filename: "{app}\NoobatWork-iPad-Mixer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\NoobatWork-iPad-Mixer.exe"; Description: "NoobatWork iPad Mixer starten"; Flags: nowait postinstall skipifsilent

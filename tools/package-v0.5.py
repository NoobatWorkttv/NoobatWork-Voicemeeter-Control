from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path('com.noobatwork.voicemeeter.sdPlugin')
assert (root/'bin/NoobatWorkAudioSessions.exe').is_file()
name='NoobatWork-Voicemeeter-Control-v0.5.1-alpha.zip'
with ZipFile(name,'w',ZIP_DEFLATED) as z:
    for p in sorted(root.rglob('*')):
        if p.is_file():z.write(p)
    for p in [Path('INSTALL.ps1'),Path('INSTALL.bat'),Path('installer/Setup.ps1'),Path('README.md'),Path('LICENSE')]:
        z.write(p)
print(name)

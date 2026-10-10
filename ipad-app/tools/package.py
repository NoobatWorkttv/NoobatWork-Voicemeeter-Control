from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

folder = Path("ipad-app/publish")
assert (folder/"NoobatWork-iPad-Mixer.exe").is_file(), "Missing self-contained Windows host"
assert (folder/"bin/NoobatWorkAudioSessions.exe").is_file(), "Missing per-app Windows audio helper"
assert (folder/"bin/bridge.ps1").is_file(), "Missing known-good Voicemeeter bridge"
for p in ["wwwroot/index.html","wwwroot/style.css","wwwroot/app.js"]:
    assert (folder/p).is_file(), f"Missing static UI: {p}"

name=Path("NoobatWork-iPad-Mixer-v0.1.2-preview.zip")
with ZipFile(name,"w",ZIP_DEFLATED,compresslevel=7) as z:
    for p in sorted(folder.rglob("*")):
        if p.is_file():
            z.write(p,p.relative_to(folder))
    z.write("ipad-app/README.md","README.md")
print(f"Built {name} ({name.stat().st_size} bytes)")

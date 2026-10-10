# NoobatWork – Voicemeeter Control 🎛️

Windows-Plugin für **Stream Deck und Stream Deck Mobile (iPad)**. Steuert Voicemeeter Potato direkt und ab **v0.5.0-alpha** zusätzlich einzelne Windows-Audioanwendungen, auch wenn mehrere davon denselben Voicemeeter-VAIO3-Eingang verwenden.

> **Version v0.5.0-alpha ist experimentell.** Die Voicemeeter-Steuerung und der Kompakt-Mixer waren bis einschließlich v0.4.0 auf dem Zielsystem erfolgreich getestet. **Die automatische Windows-App-Erkennung und der neue Setup.exe-Installer müssen noch auf einem echten Benutzer-PC ausprobiert werden.**

## Download

- **[v0.5.0-alpha Setup.exe herunterladen](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.5.0-alpha/NoobatWork-Voicemeeter-Control-v0.5.0-alpha-Setup.exe)** – empfohlen: ein Klick, kein manuelles Beenden von Stream Deck mehr.
- **[v0.5.0-alpha ZIP herunterladen](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.5.0-alpha/NoobatWork-Voicemeeter-Control-v0.5.0-alpha.zip)** – alternative Installation über `INSTALL.bat`. Diese verwendet dieselbe automatische Installationsroutine.

Der Installer ist noch **nicht digital signiert**. Windows SmartScreen kann deshalb beim ersten Start eine Warnung anzeigen. Lade ihn nur aus dem oben verlinkten offiziellen Projekt-Release herunter. **Keine Administratorrechte erforderlich.**

## Automatisches Update mit Setup.exe

1. `NoobatWork-Voicemeeter-Control-v0.5.0-alpha-Setup.exe` starten.
2. Der Installer beendet bei Bedarf Stream Deck automatisch, auch wenn es noch im Windows-Infobereich läuft.
3. Die vorherige Plugin-Version wird unter `%APPDATA%\NoobatWork\VoicemeeterControl\Backups` gesichert; deine Stream-Deck-Profile liegen außerhalb dieses Plugin-Verzeichnisses und bleiben erhalten.
4. Die neue Version wird installiert. Bei einem Installationsfehler versucht der Installer, die vorherige Version aus dem Backup wiederherzustellen.
5. Stream Deck wird automatisch neu gestartet. Das Installationsprotokoll liegt unter `%APPDATA%\NoobatWork\VoicemeeterControl\setup.log`.

## NEU: App-Mixer – Discord, Opera GX und weitere Programme separat regeln

Die neue Aktion **App-Mixer** verwendet einen **separaten Windows-Core-Audio-Hilfsprozess** (NAudio/WASAPI), der laufende Playback-Audiositzungen über **alle aktiven Windows-Ausgabegeräte** findet, einschließlich virtueller Voicemeeter-Geräte.

1. In Stream Deck eine **App-Mixer**-Aktion auf eine freie Taste ziehen.
2. Die Taste im Stream-Deck-Desktopeditor anklicken und im unteren Einstellungsbereich **Windows-Audioanwendung** auswählen.
3. Falls eine App nicht auftaucht: die Anwendung starten, kurz Ton abspielen und **Anwendungen neu suchen** anklicken.
4. Weitere App-Mixer-Tasten für Discord, Opera GX, Firefox usw. anlegen und jeweils eine andere Anwendung auswählen.

**Bedienung auf dem iPad:** Kurz tippen = Anwendung lauter, gedrückt halten = leiser, doppelt tippen = Mute an/aus. Die Schrittweite steht bei der App-Mixer-Aktion in **Prozentpunkten** (z. B. 2 %). Auf der Taste erscheinen App-Name, tatsächlicher Windows-Audiositzungs-Lautstärkewert in % und Mute-Status.

**Wichtig:** Der App-Mixer regelt den Windows-Audiositzungs-Lautstärkewert, nicht den gesamten Voicemeeter-Strip. Apps, die denselben `Strip[7]` / VAIO3 verwenden, können getrennt geregelt werden. Wenn ein Programm mehrere Audiositzungen oder Instanzen unter **demselben EXE-Namen** hat, werden sie gemeinsam gesteuert. Unterschiedliche EXE-Namen erhalten separate Regler.

Wenn eine Anwendung keine aktive Audiositzung hat, wird auf der Taste `OFFLINE` angezeigt. Die bisherigen Voicemeeter-Kanäle bleiben dabei unabhängig erreichbar.

## Bestehende Funktionen bleiben erhalten

- **Live-Fader** mit dB-Anzeige, echtem Signalpegel und Mute.
- **Kompakt-Mixer** für ganze Strips oder Busse: eine Taste, Tippen + / Halten − / Doppeltippen Mute.
- **Lauter / Leiser** mit einstellbarer Schrittweite pro Taste.
- **Fünfstufiger Touch-Fader** mit konfigurierbarem Bereich.
- **Mute** als separate Aktion.
- **Strip 0–7 / Bus 0–7**, mit gespeicherter Auswahl je Taste.

`Strip[7]` ist **Virtual Input 3**, `Bus[0]` ist Ausgang A1. Es gibt keinen durchgehenden Slider per Finger-Drag innerhalb einer Stream-Deck-Mobile-Taste.

## Technik & Tests

- Das bestehende Voicemeeter-Gain-/Mute-System verwendet die funktionierende lokale PowerShell-Bridge mit `VoicemeeterRemote64.dll`. Die neue Anwendungserkennung verändert diese Bridge nicht.
- Der Windows-App-Helfer ist ein selbständiges **.NET-8-Windows-Programm**, in der ZIP und Setup.exe eingebettet, das über stdin/stdout mit dem Plugin spricht. Kein zusätzlicher Flask-Server, TCP-Port oder manuelle .NET-Installation nötig.
- Die Anwendungserkennung nutzt [NAudio](https://github.com/naudio/NAudio) (MIT-Lizenz) für die Windows-Core-Audio-API. Die Projekt-Lizenz ist [MIT](LICENSE).
- GitHub Actions kompiliert den Helfer unter Windows, überprüft die Windows-PowerShell-Installationsroutine, führt die Node-Tests aus, erstellt das ZIP und kompiliert das Setup mit Inno Setup.
- Durch erfolgreiche CI-Tests wird die Funktion auf deinem echten Windows-System nicht automatisch bestätigt. Das prüfen wir gemeinsam.

**Bewährte Rückfallversion:** [v0.4.0-alpha](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/tag/v0.4.0-alpha).

© 2026 NoobatWorkttv · [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/) · [Microsoft Core Audio](https://learn.microsoft.com/en-us/windows/win32/coreaudio/core-audio-apis)

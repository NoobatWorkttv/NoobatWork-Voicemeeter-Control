# NoobatWork – Voicemeeter Control 🎛️

Open-Source Stream Deck Plugin für **Voicemeeter Potato** unter Windows – ohne Flask-Server. Auch für **Stream Deck Mobile auf dem iPad**.

> **v0.4.0-alpha (experimentell):** Der bisherige Live-Fader, das Regeln per +/− und das Speichern der Kanalwahl wurden praktisch bestätigt. **Neu ist die Kompakt-Mixer-Taste mit Tippen/Halten/Doppeltippen. Sie ist automatisiert, aber noch nicht auf deinem iPad getestet. Die vorhandenen Aktionen bleiben unverändert.** Die erste Version v0.3.0-alpha war wegen eines defekten PowerShell-Bridge-Skripts komplett offline; diese Version repariert das Skript und enthält eine Windows-PowerShell-Syntaxprüfung vor dem Release.**

## Download

**[v0.4.0-alpha als ZIP herunterladen](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.4.0-alpha/NoobatWork-Voicemeeter-Control-v0.4.0-alpha.zip)**

## NEU: Kompakt-Mixer auf einer einzigen Taste

Statt fünf Segmenttasten kannst du pro Audiokanal jetzt **eine einzige Kachel** verwenden. Lege in Stream Deck die Aktion **Kompakt-Mixer** für Game, Discord, Mikrofon usw. jeweils einmal nebeneinander und wähle pro Taste den gewünschten Voicemeeter-Kanal.

- **Kurz tippen:** +2 dB (oder frei einstellbare Schrittweite).
- **Gedrückt halten:** nach ca. 520 ms −2 dB, solange gehalten etwa alle 280 ms erneut (begrenzt auf 12 Schritte pro Tastendruck).
- **Zweimal schnell tippen:** Mute ein/aus (zweiter Tipp innerhalb von 280 ms). Ein einzelner Tipp wird daher mit kurzer Verzögerung ausgeführt.
- **Auf der Kachel:** Kanalname, dB-Wert, Gain-Balken und echter Signalpegel; Mute färbt die Kachel rosa.

Die Gesten verwenden die offiziellen `keyDown`-/`keyUp`-Ereignisse. **Es ist kein frei ziehbarer Touch-Slider innerhalb einer Taste.** Bitte insbesondere das Loslassen/Halten auf Stream Deck Mobile prüfen.

Die bisherige v0.3.1-alpha ist weiterhin als getestete Rückfallversion verfügbar: [v0.3.1-alpha Release](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/tag/v0.3.1-alpha).

## Was ist neu?

- **Touch-Fader · Segment:** Fünf nebeneinanderliegende Tasten bilden einen anklickbaren Fader. Jede Taste legt einen Zielpegel fest und zeigt an, ob der aktuelle Fader darüber oder darunter liegt.
- **Echter Live-Audiopegel:** Der farbige Balken am Fuß jeder Aktion zeigt den tatsächlichen Signalpegel, er wird unabhängig von der Gain-Faderposition über die Voicemeeter Remote API (`VBVMR_GetLevel`) gelesen.
- **Mute:** Eigene Mute-Taste je Kanal; der Live-Fader kann nach wie vor per Tastendruck stummschalten.
- **Vorhandene Aktionen:** Live-Fader, Lauter, Leiser bleiben erhalten, inklusive pro Taste konfigurierbarem Strip/Bus, Namen und Schrittweite.

### Fünf-Tasten-Fader auf dem iPad einrichten

1. In Stream Deck Mobile (bzw. in der Desktop-Konfiguration) **fünf freie Tasten nebeneinander** verwenden.
2. Auf jede Taste die Aktion **Touch-Fader · Segment** ziehen.
3. Jede dieser fünf Tasten anklicken und **denselben Kanal** wählen, z. B. Virtual Input 1.
4. Unter **Fader-Segment / Position** für die fünf Tasten von links nach rechts **1 / 5, 2 / 5, 3 / 5, 4 / 5 und 5 / 5** einstellen.
5. Auf allen Tasten denselben Minimum- und Maximumwert einstellen, standardmäßig **−40 bis 0 dB**.
6. Wahlweise eine sechste Taste **Mute** hinzufügen und denselben Kanal zuweisen.

Mit dem Standardbereich wählen die Tasten **−40, −30, −20, −10 und 0 dB**. Das ist ein **diskreter Fader mit fünf Positionen**, kein kontinuierlicher Finger-Drag über das Display und auch kein Drag innerhalb einer einzelnen Taste. Er arbeitet auch auf einem regulären Stream Deck.

### So erkennst du den Unterschied

- Die **große Fläche** des Segmentes signalisiert den eingestellten Pegel (der Faderwert).
- Der **schmale Balken ganz unten** zeigt den aktuellen Audio-Signalpegel (dBFS). Wenn kein Ton läuft, bleibt dieser unten.
- Bei Mute fällt der Post-Mute-Pegel der Eingänge ab. Bei Bussen kommt das Meter aus dem Output-Level der Voicemeeter API.

## Hotfix v0.4.0-alpha

Das Build von v0.3.0-alpha enthielt durch einen fehlerhaften Code-Patch eine syntaktisch beschädigte `bridge.ps1`. Die erneuerte Bridge baut auf der funktionierenden v0.2.1 auf. Die Audio-Pegelmessung wird isoliert abgefragt und darf Gain/Mute nicht blockieren. GitHub Actions validiert die Skriptsyntax jetzt unter **Windows PowerShell 5.1** und führt erst bei Erfolg die Linux-/Node-Tests und die Paketveröffentlichung aus.

**Hinweis:** Die Windows-PowerShell-Prüfung erkennt Syntaxprobleme. Ob alle Audio-Pegel auf deinem Voicemeeter Potato korrekt ankommen, muss weiterhin am echten System geprüft werden.

## Installation und Update

1. Voicemeeter Potato und Stream Deck Desktop **7.1 oder neuer** starten und prüfen, ob sie funktionieren.
2. ZIP vollständig entpacken.
3. **Stream Deck vollständig beenden**, einschließlich Tray-Symbol.
4. `INSTALL.bat` ausführen. Alte Plugin-Dateien werden vor dem Kopieren automatisch gesichert unter `%APPDATA%\NoobatWork\VoicemeeterControl\Backups`.
5. Stream Deck erneut starten und Plugin-Aktionen auswählen.

### Kanalzuordnung (Voicemeeter Potato)

| Auswahl | Remote-API |
|---|---|
| Hardware Input 1–5 | Strip[0]–Strip[4] |
| Virtual Input 1–3 | Strip[5]–Strip[7] |
| Output A1–A5 | Bus[0]–Bus[4] |
| Output B1–B3 | Bus[5]–Bus[7] |

Hinweis: **Hardware Input 1 ist Strip[0], nicht Bus A1.**

## Technische Details

- Node.js-Plugin mit lokaler PowerShell/C#-Bridge zu `VoicemeeterRemote64.dll`; keine Webdienste, Portfreigaben oder NPM-Pakete nötig.
- `VBVMR_GetLevel`: Strip-Pegeltyp 2 (post mute), Bus-Pegeltyp 3 (output). Potato-Kanäle: Hardware-Strips jeweils 2 Audiokanäle, virtuelle Strips und Busse jeweils 8; der maximale lineare Wert wird zu dBFS umgerechnet.
- Gemeinsame Abfrage der sichtbaren Kanäle, dynamische Stream-Deck-Tastenbilder mit 350-ms-Polling und Bild-Deduplizierung.
- Bestehende Einstellungen bleiben durch gleiche Plugin- und Aktions-IDs erhalten.
- Bei Problemen `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck0.log` ansehen.

**Bekannte Grenze:** Das Stream Deck Keypad SDK meldet Tastendrücke, kein kontinuierliches Verschieben innerhalb einer Taste. Echte Touch-Gesten sind auf dem Stream Deck+ Touch Strip eine andere API. Mehr als fünf feste Pegelstufen und weitere Fader-Bedienkonzepte können später ergänzt werden.

## Automatisierte Tests und Build

`node --test tests/*.test.cjs` prüft die Segment-Pegel, Potato-Channel-Offsets, Manifest-Aktionen und die Speicherung pro Taste. GitHub Actions baut und veröffentlicht das ZIP als Alpha-Release. Der CI-Test ersetzt keine Hardwareprüfung unter Windows oder auf dem iPad.

## Quellen

- [VB-Audio Voicemeeter Remote SDK](https://github.com/vburel2018/Voicemeeter-SDK)
- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/)

MIT-Lizenz · © 2026 NoobatWorkttv

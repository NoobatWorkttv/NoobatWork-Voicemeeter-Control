# NoobatWork – Voicemeeter Control 🎛️

**Windows Stream Deck / Stream Deck Mobile** Plugin für direkte Steuerung von **Voicemeeter Potato**, ohne Flask oder weiteren Webserver.

> **v0.2.0-alpha – experimenteller Testbuild.** Echtzeit-Steuerung und Darstellung von Strip 0 wurden durch einen Nutzer bereits praktisch bestätigt. Die neue Kanalauswahl ist noch nicht am konkreten Windows-/iPad-System getestet.

## Download

**[v0.2.0-alpha ZIP herunterladen](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.2.0-alpha/NoobatWork-Voicemeeter-Control-v0.2.0-alpha.zip)**

## Funktionen

- Live-Fader: zeigt aktuellen Gain (dB), Mute-Status und Faderposition; Tippen schaltet Mute.
- Lauter und Leiser: drücken verändert Gain um die eingestellte Schrittweite.
- **Pro Taste frei wählbarer Kanal:** Hardware Input 1–5 (Strip 0–4), Virtual Input 1–3 (Strip 5–7), Output A1–A5 (Bus 0–4) oder Output B1–B3 (Bus 5–7).
- **Pro Taste eigener Titel** und **Schrittweite 0,1–12,0 dB** für +/−.
- Werte werden über die Voicemeeter Remote API live aktualisiert. Bei Änderungen in Voicemeeter folgt die Anzeige.

## Installation / Update

1. Stream Deck Desktop **7.1+** und Voicemeeter Potato müssen installiert sein.
2. ZIP herunterladen und **vollständig entpacken**.
3. Stream Deck vollständig beenden, auch im Infobereich.
4. `INSTALL.bat` ausführen. Ein vorhandenes Plugin wird unter `%APPDATA%\NoobatWork\VoicemeeterControl\Backups` gesichert; bei Kopierfehlern wird das Backup wiederhergestellt.
5. Stream Deck starten, Aktion **Live-Fader**, **Lauter** oder **Leiser** hinzufügen.
6. **Taste anklicken:** Im unteren Eigenschaftenbereich erscheinen die Dropdown-Kanalauswahl, Beschriftung und bei +/− die Schrittweite. Änderungen werden automatisch gespeichert.

**Wichtig:** `Strip[0]` ist Hardware Input 1, **nicht** Ausgang A1. A1 entspricht `Bus[0]`.

## Technik & Einschränkungen

- Windows-Plugin mit Node.js und lokaler PowerShell/C#-Bridge zur Voicemeeter Remote API (`VoicemeeterRemote64.dll`).
- Keine zusätzlichen NPM-Pakete oder externen Netzwerkserver.
- Nur Voicemeeter Potato mit acht Strips und acht Bussen ist für diese Oberfläche vorgesehen.
- Ein frei mit dem Finger ziehbarer Slider innerhalb einer einzelnen Stream Deck Mobile Taste und Stream Deck+ Encoder sind noch **nicht** implementiert. Die Anzeige aktualisiert sich jedoch beim Bewegen des Reglers in Voicemeeter.
- Beta-Test: Bei Problemen bitte `%APPDATA%\Elgato\StreamDeck\logs\StreamDeck0.log` prüfen.

## Build / CI

GitHub Actions überprüft `plugin.js`, `settings.js`, das Manifest und die erforderlichen Icon-Dateien und erstellt das ZIP als **Pre-Release**. Der erfolgreiche Build ersetzt keinen Praxistest in Stream Deck und Voicemeeter.

## Referenzen

- [VB-Audio Voicemeeter SDK](https://github.com/vburel2018/Voicemeeter-SDK)
- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/)

Lizenz: [MIT](LICENSE) · © 2026 NoobatWorkttv

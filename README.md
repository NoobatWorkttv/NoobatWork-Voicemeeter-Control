# NoobatWork – Voicemeeter Control 🎛️

Open-Source Stream-Deck-Plugin für die direkte Steuerung von **Voicemeeter Potato** unter Windows. Ziel: konfigurierbare Kanal-Fader auf Stream Deck und Stream Deck Mobile (iPad), ohne separaten Flask-Server.

> **Status: v0.1.0-alpha – ungetesteter Entwicklungsstand.** Die eigentliche Windows-Voicemeeter- und iPad-Verbindung muss noch praktisch getestet werden. Dies ist noch keine fertige Stream-Deck-Marketplace-Erweiterung.

## Geplante und prototypisch implementierte Aktionen

- **Live-Fader:** Zeigt Gain in dB und Mute-Status, Tippen schaltet Mute um
- **Lauter / Leiser:** Pegel in frei wählbaren dB-Schritten ändern
- **Mute:** Kanal stummschalten oder wieder aktivieren
- **Fader-Segment:** Fünf nebeneinanderliegende Tasten setzen feste Pegelstufen
- **Stream Deck+:** Drehregler mit Anzeige und Pegeländerung

### Technischer Ansatz

Das Plugin verwendet die offizielle `VoicemeeterRemote64.dll` über eine lokale PowerShell-/C#-Bridge (stdin/stdout), ohne Webserver. Einstellungen wählen einen Strip oder Bus 0–7; die Pegel sollen bidirektional aktualisiert werden. Stream Deck Mobile nutzt die bestehende Verbindung zur Desktop-App.

**Achtung:** Der kontinuierliche Finger-Drag innerhalb *einer* Stream-Deck-Mobile-Taste ist nicht implementiert. Der 5-Tasten-Fader ist ein separater Ansatz.

## Installation

Dieser Stand erfordert eine manuelle Installation unter **Windows 10/11**, **Voicemeeter** und **Stream Deck Desktop 7.1+**:

1. Projekt als ZIP herunterladen (**Code → Download ZIP**) und entpacken.
2. Stream Deck vollständig beenden.
3. `INSTALL.bat` starten.
4. Stream Deck erneut öffnen, unter „NoobatWork Voicemeeter“ eine Aktion hinzufügen und Kanal einstellen.

Die Installation darf bestehende Plugin-Dateien nicht automatisch überschreiben.

## Tests

`node --test tests/*.test.js`

## Referenzen

- [VB-Audio Voicemeeter Remote API](https://github.com/vburel2018/Voicemeeter-SDK)
- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/)

Lizenz: [MIT](LICENSE) · © 2026 NoobatWorkttv

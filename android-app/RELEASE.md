First signed Android preview of **NoobatWork Mixer**, based on the existing
Mixer Control Center interface. This is the audio-control tablet app.

- Saved Windows PC address and persistent pairing/device profile.
- Fullscreen mixer, portrait/landscape and optional keep-screen-on.
- Automatic retry when the PC cannot be reached; existing WebSocket reconnection.
- Compatible with Control Center v0.2.0+; v0.2.1 includes late-app discovery fixes.

Install the APK on your Android tablet and enter the **LAN address shown on the
Windows Control Center**, then the six-digit pairing code. Both devices must be
on the same network. Android Back leaves fullscreen. The PC still runs Voicemeeter.

Android 15 emulator tests cover pairing, a late EFT session, WebSocket mute,
saved identity and rotation. Physical Peaq touch accuracy, standby/resume and
Wi-Fi behavior still require testing. No Stream Deck functionality is included
in this audio app. Existing Windows, iPad and Stream Deck releases are preserved.

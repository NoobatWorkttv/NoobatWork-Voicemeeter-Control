Separate Windows x64 **NoobatWork Mixer Control Center v0.2.0** preview.

- Native Windows GUI with system tray, server start/stop, pairing code and LAN URLs.
- Windows Audio / Voicemeeter status, connected devices and bounded logs.
- Editable per-device profiles: order, display name, visibility, color and layout.
- Unified compact Split-Screen faders; iPad, Android and Windows touch browser clients.
- Existing v0.1.1 audio command coalescing and fast helper acknowledgements retained.

Uses port **8877**, its own installer identity, install folder and settings folder.
The Stream Deck v0.6.0-alpha and iPad Mixer v0.1.2-preview releases remain untouched.

Windows CI builds the GUI/helper, runs regression and HTTP/pairing/three-client
WebSocket tests, compiles Setup.exe and tests the installed package before release.
`SHA256SUMS.txt` accompanies the installer. This is an unsigned preview.

Physical iPad/Android/Windows touch, real Wi-Fi latency and audible quality still
need acceptance testing. See `control-center/README.md` for exact steps and limits.

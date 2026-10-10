# NoobatWork Audio Mixer – iPad Edition (v0.1.0 Preview)

A new, **separate** local iPad mixer—not a replacement for the tested Stream Deck plugin.

The goal is the **first approved dark seven-channel mockup**: proper touch-draggable vertical faders, names/icons, real audio activity meters, per-app mute, a hardware view, and a master output section. Everything is adaptable based on tests on the actual iPad.

## Windows setup (Windows 10/11 x64)

1. Download **NoobatWork-iPad-Mixer-v0.1.0-preview-Setup.exe** from the official GitHub release.
2. Run Setup.exe. It installs under your Windows user account. No .NET SDK or Node installation required.
3. Start **NoobatWork Audio Mixer – iPad Edition** from the Windows Start menu (or launch it at the end of Setup).
4. **Leave the console window open.** It prints a LAN address (such as `http://192.168.1.85:8876/`) and a *fresh six-digit pairing code*.
5. If Windows Firewall prompts you, allow **private networks only**. Never allow public networks or router port forwarding.
6. Connect your iPad to the same private Wi-Fi/LAN, open the printed URL in Safari, and enter the six-digit code shown on the Windows PC.
7. The iPad remembers its long random authentication token locally, allowing it to reconnect after a restart.
8. Optional: Safari → Share → **Add to Home Screen** for a convenient shortcut. LAN HTTP does not support HTTPS-required offline Service Workers; this preview is not an App Store or fully offline PWA.

**Security warning:** This first LAN preview uses **unencrypted HTTP and WebSocket**. Pairing and every audio-control command are authenticated, but network traffic (including the pairing token) is not encrypted. Use it *only on a trusted private network*. The companion binds to TCP **8876**, restricts connections to RFC1918/private LAN IPs or loopback, requires a same-origin browser connection, and never contacts cloud services or external fonts. Proper HTTPS/WSS is a production requirement for later.

## Controls

The iPad interface adapts to landscape 4:3 screens, matching the first dark seven-channel design.

- **Alle:** Active audio apps first, then Voicemeeter virtual inputs, outputs and hardware inputs.
- **Apps:** Each Windows application (Discord, Firefox, Opera GX, etc.) with an active Windows audio session. Multiple sessions of the same executable are grouped.
- **Hardware:** Voicemeeter Potato `Strip[0..7]` and `Bus[0..7]` including A1 / B1.
- **Drag:** Touch and drag a fader up/down for immediate live volume changes. Apps = **0–100%**; Voicemeeter = **−60 to +12 dB**.
- **MUTE:** Each app/channel has a separate mute button with visible status.
- **Live meters:** The bar next to the fader displays measured audio peaks, not the configured volume.
- **Master Output:** The bottom row shows A1 (Voicemeeter Bus 0) with a working master mute button.
- **Swipe:** Swipe sideways to access more than seven channels.

The companion reuses the working NAudio Windows-audio helper and a separate *copy* of the already-tested Voicemeeter PowerShell bridge. The separate Stream Deck plugin is left alone.

## ZIP alternative

Download the GitHub ZIP, extract **every file** and run `NoobatWork-iPad-Mixer.exe`. Never launch directly inside the ZIP: both `wwwroot/` and `bin/` must stay beside the EXE.

## Troubleshooting

- **No URL/code:** Start the Windows program normally and leave the terminal window visible.
- **iPad page unavailable:** Both devices must be on the same trusted private WLAN/LAN; check Windows Firewall, guest Wi-Fi/client isolation, VPNs, and the printed IP address.
- **Wrong pairing code:** Code changes on every launch. See the latest Windows console. Rate limiting prevents unlimited guesses.
- **Application missing:** Start it and let it play audio briefly; Windows must first create a playback session.
- **Voicemeeter offline:** Start Voicemeeter Potato. The app mixer works separately.
- **Controller not updating:** If the connection drops briefly, it should reconnect automatically.
- **Device lost/uncoupled:** Click the sign-out symbol and pair again. The companion stores a device token at `%APPDATA%\NoobatWork\iPadMixer\pair-token.txt`.

**MVP / preview status:** Real working server and UI compiled and testable on Windows, but not yet tested on your physical iPad. Current release supports volume, mute, master A1 and live meters; configurable routing, rearrangeable channel presets, tray auto-start and HTTPS are planned improvements.

The tested [Stream Deck v0.6.0-alpha release](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/tag/v0.6.0-alpha) remains unchanged.

## Development

On Windows from the repository root:

```powershell
dotnet publish windows-audio/NoobatWorkAudioSessions.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ipad-app/publish/bin
dotnet publish ipad-app/NoobatWork.iPad.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o ipad-app/publish
Copy-Item com.noobatwork.voicemeeter.sdPlugin/bridge.ps1 ipad-app/publish/bin/bridge.ps1
ipad-app/publish/NoobatWork-iPad-Mixer.exe
```

GitHub Actions builds both executables, validates HTTP pairing and an authenticated WebSocket, checks the published assets, and packages an installer.

© NoobatWork – MIT

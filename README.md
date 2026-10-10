# NoobatWork Voicemeeter Control

**Stream Deck / Stream Deck Mobile mixer for Windows and Voicemeeter Potato.** 
The plugin supports individual Windows app audio sessions and Voicemeeter channels, with a one-click auto-updater.

## v0.6.0-alpha — Hybrid UI redesign

The original iPad mixer mockup inspired the design; this release upgrades **actual Stream Deck key images** (144x144 px) rather than pretending Stream Deck Mobile has full-size draggable touch faders.

- Unified premium dark key backgrounds with rounded corners, clear gain / percent numbers and subtler borders.
- Per-app accent colors: Discord purple/blue, Opera GX red, Firefox orange, game violet, microphones mint/green, Voicemeeter buses cyan.
- Extracted **real app icons** from Windows executable files where Windows permits it. Falls back to an app-name monogram if icon access is unavailable; never downloads icons from the internet.
- True live Windows session peak meter for applications and existing genuine Voicemeeter meter for hardware/virtual channels. The **volume bar** and **actual audio activity meter** remain distinct.
- Clear red muted state and an explicit OFFLINE state.
- Per-key **Design**: Hybrid (default), Neon Streamer, Clean Pro; selectable accent override.
- Existing per-key **Mute-Bedienung** preserved: classic double tap or tap-then-hold mode. The audio commands, channels, installer backup logic and keys from v0.5.1-alpha are not intentionally changed.

> **v0.6.0-alpha is a preview** until tested on actual Stream Deck Mobile / iPad hardware. App icons may be missing for protected applications, and nested PNGs in dynamic SVG keys require validation on your specific Stream Deck version. Roll back using the proven v0.5.1-alpha installer if needed.

### Downloads

- **[Download v0.6.0-alpha Setup.exe](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.6.0-alpha/NoobatWork-Voicemeeter-Control-v0.6.0-alpha-Setup.exe)**
- **[Alternative: v0.6.0-alpha ZIP](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/download/v0.6.0-alpha/NoobatWork-Voicemeeter-Control-v0.6.0-alpha.zip)**
- **[Last tested reference: v0.5.1-alpha](https://github.com/NoobatWorkttv/NoobatWork-Voicemeeter-Control/releases/tag/v0.5.1-alpha)**

### Installation and upgrade

Run Setup.exe while Stream Deck is still open. Setup automatically closes it, backs up the installed plugin to
\`%APPDATA%\NoobatWork\VoicemeeterControl\Backups\`, installs the new version, and restarts Stream Deck. It works without administrator rights. Existing Stream Deck profiles are stored outside the plugin folder, so the installer does not replace them. If installation fails, it tries to restore the backup. For diagnostics, see \`%APPDATA%\NoobatWork\VoicemeeterControl\setup.log\`.

The unsigned setup may trigger a Windows SmartScreen warning. Only use files downloaded from this official GitHub repository's release.

### Mixer controls

All settings belong to each Stream Deck key. The new design controls appear inside that key's Property Inspector.

| Action | Function |
|---|---|
| App-Mixer | Windows application-session volume in percent, separate Mute, live meter and application icon |
| Kompakt-Mixer | Hardware or virtual input/output gain in dB, mute and live Voicemeeter signal peak |
| Live-Fader | Existing Voicemeeter channel display / mute |
| Lauter / Leiser | Increment or decrement the selected channel by a configured amount |
| Mute | Toggle the whole configured Voicemeeter strip or bus |
| Touch-Fader Segment | One of five programmable gain positions |

The plugin detects Windows audio sessions across active output devices (including VAIO3) using a separate bundled NAudio helper. Apps using the same \`.exe\` are grouped together; apps with different executable names are individually controllable. The helper talks to the plugin only over local stdin/stdout—**no Flask server or extra TCP port**.

For **App-Mixer** and **Kompakt-Mixer**, selectable per-key gestures:
- **Classic default:** tap +, hold −, double-tap mute.
- **Tap + Hold:** each short tap immediately increases volume—even during rapid sequences; hold the second touch for 350 ms within 280 ms of the prior short tap to toggle mute; a normal single long press decreases volume.

**Stream Deck keypad events do not support actual continuous finger dragging within a single key.** The future iPad UI will be a separate, full-width interface that really supports sliders.

### Planned next: dedicated iPad interface

Our next project phase after v0.6 is validated: an actual iPad-oriented, touch-first mixer UI inspired by the dark, seven-channel mockup with full-height vertical faders, app icons, adjustable audio routing, true meters, mute indicators, and configurable layouts. The Stream Deck plugin remains an independent, installable fallback. See [the iPad product roadmap](docs/IPAD_APP_ROADMAP.md).

### Development and test

Source code is open in this repository. CI uses Windows to compile the self-contained .NET 8 audio helper, test IPC, run unit tests, validate Windows PowerShell installer syntax, smoke-test backups, and build Inno Setup.exe.

© NoobatWork 2026 · MIT License · [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck/sdk/) · [NAudio](https://github.com/naudio/NAudio)

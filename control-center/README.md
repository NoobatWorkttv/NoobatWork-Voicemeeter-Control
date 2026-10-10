# NoobatWork Mixer Control Center v0.2.0

Separate Windows x64 WinForms GUI built on the existing iPad Mixer server,
browser faders and **unchanged linked AudioEngine.cs**. No rewrite of the audio
bridge. The helper uses the existing `IPAD_MIXER` fast-ack build configuration.

## Installation / use

Install `NoobatWork-Mixer-Control-Center-v0.2.0-Setup.exe` from the separate
`v0.2.0-control-center` release. Start it from the Start menu. No console window.
The GUI shows server, Windows Audio and Voicemeeter status, LAN URLs and the
six-digit pairing code. In Safari, Chrome, Edge or another current browser,
open the LAN URL on port **8877** and pair. Windows touch PCs use the same client.
Use a trusted private LAN. HTTP traffic is not encrypted; no Internet exposure.
Allow the app through Windows Firewall on private networks if prompted.

Closing the GUI hides it in the system tray. Double-click the tray icon to
restore. Tray > Beenden stops the server and its helper processes.
Start/stop is available both in the GUI and tray menu. Restart generates a new
pairing code; previously paired browsers retain their access token.

## Profile editor

In **Mixer & Profile**, select Standard or a connected device. Edit the display
name, visibility checkbox and #RRGGBB color; use the color picker and up/down
buttons to reorder rows. The profile name and auto/split/full layout are editable.
Save writes atomically and updates connected browsers. Unknown/new channels
remain visible after configured channels. **Laden / Verwerfen** reloads the
profile and discovers newly started audio applications, discarding unsaved edits.
Device profiles inherit Standard until first saved. Saved device entries remain
selectable after a server restart. Each browser installation has a separate ID.

Data lives in `%APPDATA%\NoobatWork\MixerControlCenter` (`profiles.json` and the
pairing token), separate from `%APPDATA%\NoobatWork\iPadMixer`.
Logs retain the most recent 500 lines in memory, without logging pairing tokens.
There is one saved profile per browser plus Standard, not a preset library.

## Preservation

Only `control-center/**` and `.github/workflows/build-control-center.yml` are
added. Stream Deck v0.6.0-alpha, iPad v0.1.2-preview and v0.1.1 source, tags,
installers and workflows are not changed. Separate installer AppId, folder,
data directory and port allow side-by-side installation. Simultaneous audio
changes by old and new apps still act on the same Windows mixer.

## Validation

`node --test tests/*.test.cjs ipad-app/tests/favorites.test.cjs control-center/tests/*.test.cjs`
checks existing regressions plus profile ordering, visibility, naming and colors.
Publish the .NET app and the existing helper with `DefineConstants=IPAD_MIXER`;
copy `bridge.ps1` into `publish/bin`. Set `NAW_DATA_DIR` to a disposable directory
and `NAW_TEST_RESULT` to a JSON output path, then run the EXE with `--self-test`.
Close any running Control Center first. Integration tests use port 18877 and test
HTTP, pairing/origin/auth failures, three concurrent WebSockets, invalid commands,
live isolated device profiles, atomic persistence, validation and native form
construction. The workflow also installs and tests the packaged app.

### Physical acceptance steps

1. Start Voicemeeter and an application playing audio. Check both audio statuses.
2. Pair an iPad, Android browser and Windows touch PC with the displayed URL/code.
   All three must appear under Geräte and receive live audio values.
3. Lower a noncritical application's fader, check the Windows mixer and all clients,
   then restore the original value. Repeat mute/unmute. Never raise gain blindly.
4. Select only the iPad profile, choose split, rename/recolor/reorder a channel and
   hide another. Save. Check that only that device changes; reload and restart
   the Control Center and check persistence. Test at 375, 600 and 1024px widths.
5. Close the GUI: clients must remain connected. Restore from tray. Stop server:
   clients go offline. Start: clients reconnect. Exit from tray: helper processes stop.
6. Check the existing iPad app on port 8876 and existing Stream Deck keys still work.

Not claimed by automated tests: real iPadOS Safari touch/pointer-capture behavior,
physical Android/Windows touch hardware, Wi-Fi latency/loss and audible quality.
Installer is unsigned; Windows may show a publisher/SmartScreen warning.
Pairing currently shares one token across browsers; per-device token revocation,
HTTPS, autostart, named preset libraries and durable log export are not included.

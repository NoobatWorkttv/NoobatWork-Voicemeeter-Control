# NoobatWork Mixer for Android

Installable Android client for the existing Windows Mixer Control Center, using
its existing web mixer and WebSocket protocol. Android 8+; Android 15 is the first
emulator test target. No audio is streamed to the tablet: it controls the PC.

## On the tablet

1. Install the APK from the separate Android preview release. Allow installation
   from the browser or file manager when Android asks.
2. Start Mixer Control Center v0.2.0 or newer on Windows (v0.2.1 recommended).
3. Enter its LAN address in the Android app, e.g. `192.168.1.20:8877`.
4. Enter the PC's six-digit pairing code. The app stores the pairing and device
   identity in its own WebView storage, separately from Chrome and other tablets.
5. Use Vollbild; Android Back reveals controls again. PC / Einstellungen changes
   the address or keep-screen-on preference. Portrait and landscape both work.

The PC must remain running and reachable over the local network. An initial
connection failure retries every three seconds; an established mixer uses its
existing WebSocket reconnect logic. Settings and pairing survive app restarts.
Changing the host/IP means a different web origin and requires pairing again.
No cloud account, microphone, storage permission, JavaScript/native bridge or
background service is used. LAN HTTP is supported because the existing server
uses it. Use a trusted local network.

## Build and tests

Java 17, Android SDK 35 and Gradle 8.11.1:
`gradle -p android-app testDebugUnitTest lintDebug assembleDebug`

GitHub Actions also runs the actual Control Center HTML/JS in an Android 15
WebView against a deterministic audio fixture. It checks pairing, late EFT
discovery, a mute command received by the fixture, device identity persistence
after Activity recreation and both orientations. This is not a physical Peaq
or real Wi-Fi latency test. Confirm drag accuracy and reconnect after sleep on
the tablet. The separate Windows CI covers the real Windows backend protocol.

Release signing uses repository secrets `ANDROID_MIXER_KEYSTORE` (base64 JKS)
and `ANDROID_MIXER_KEY_PASSWORD`, alias `noobatwork-mixer`. The private key is
never committed. Keep this key for future updates; changing it requires removing
the installed app and loses its private pairing storage. APKs are distributed
directly, not through Google Play.

WebView configuration follows the Android guide:
https://developer.android.com/develop/ui/views/layout/webapps/webview

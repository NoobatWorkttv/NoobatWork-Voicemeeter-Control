# Next phase: NoobatWork iPad Audio Mixer

## Goal
Build a dedicated iPad mixer inspired by the approved 7-channel dark UI mockup.
**Do not simulate draggable sliders inside Stream Deck buttons.** This is a separate touch-first app (likely a LAN-served Progressive Web App first; native iOS wrapper optional later).

## Baseline preserved
The tested Stream Deck plugin (v0.5.1-alpha and visually redesigned v0.6.x) remains independently usable and maintains its own installer. Reuse tested Voicemeeter commands and Windows app session identification rather than rebuilding audio control from scratch.

## Screen
- Landscape iPad 9th gen, comfortable 1024x768 touch UI with responsive panels.
- Dark graphite + cyan/blue accent, per-app branded colors, subtle glow.
- Automatic app icons/name and grouping of Windows audio sessions.
- Independent real *vertical draggable faders* with touch gestures and tap/hold mute buttons.
- Separate channel gain/volume faders and meaningful real-time level meters.
- Per-app and system master controls, configurable presets/layouts.
- Separate hardware buses and virtual inputs; routing controls only where the backend supports them.
- Accessible contrast and large, thumb-friendly hit targets.

## Architecture under consideration
- Windows service/helper hosts local HTTP/WebSocket UI and audio control on the gaming/streaming PC, bound to LAN only when enabled.
- Reuse existing NAudio Windows session helper, Voicemeeter DLL bridge, and existing safe gesture/settings model.
- Browser-based PWA on iPad home screen first: full-screen, offline assets, no App Store or Apple developer certificate.
- Security: local pairing code or stored device token; CORS/origin validation; no unauthenticated network audio commands; optional HTTPS setup. LAN service must not be exposed to the public internet.
- Controller updates through WebSocket push with rate limiting and reconnect handling.
- Desktop companion tray/installer and optional auto-start, plus stable rollback.
- Native iPad app evaluated only after the PWA ergonomics are tested. No App Store claims until packaging and signing are actually implemented.

## Order
1. Finish Stream Deck visual redesign v0.6 and test on actual iPad mobile keys.
2. Lock down common control protocol and settings persistence.
3. Build local companion + responsive iPad PWA based on the agreed mockup.
4. Test on iPad 9th gen for tactile dragging, orientation, disconnects and latency.
5. Consider an iOS-native shell only if the PWA has meaningful limitations.

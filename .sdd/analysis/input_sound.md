---
request_slug: input_sound
date: 2026-11-19
type: evolution
size: narrow
reference: .sdd/analysis/session_notifications.md
---

# Analysis — Sound when a session needs input

## Request

> implementa una notifica sonora quando l'AI mi chiede un input / conferma manuale

## Reference

[session_notifications.md](session_notifications.md) → the desktop app shows system notifications and a tray signal when a hosted or external session needs input, ends a turn, or ends by itself. It left custom sounds out of scope (line 115). The settings popup comes from [settings_dialog.md](settings_dialog.md).

Changes (human decisions of 2026-11-19):
- The desktop app plays a sound when a session starts to need input, also while its window has the focus.
- The settings popup gets an on/off switch for the sound, on by default.
- Every other requirement of the reference stays true.

## Summary

The desktop app plays a short sound when a hosted or external session starts to need input. A switch in the settings popup turns the sound on or off.

## Requirements

### Functional

- The desktop app must play a sound when a hosted or external session enters "needs input".
- The sound must play when the window has the focus, is in the background, is minimized, or is closed to the tray. The human decided this.
- Several sessions that enter "needs input" within 5 seconds of the first one must play the sound once.
- The sound must not repeat while a session keeps needing input.
- A session that leaves "needs input" and enters it again must play the sound again.
- State changes that happened before the desktop app started must not play the sound.
- A turn end and a session end must not play the sound.
- The settings popup must have an on/off switch for the sound, on by default. The human decided this.
- The switch must apply at once, and the desktop app must remember it across restarts.
- With the switch off, no sound must play, and the notifications and the tray must work as before.
- The settings must not offer a choice of sound or a volume. The human decided this.
- Every new text must be in English, like the rest of the UI.

### Non-functional

- The sound must play within 5 seconds of the state change, like the notification.
- The sound must be short, at most 2 seconds, and must not block the UI.

## Assumptions

- This is an evolution, not a fix. The reference put sounds out of scope on purpose ([session_notifications.md](session_notifications.md), line 115). The gatekeeper decided this.
- Only the desktop app plays the sound. The client open in a browser plays none, as only the desktop app notifies ([session_notifications.md](session_notifications.md), line 93). The gatekeeper decided this.
- "Needs input" covers a permission prompt and a question from Claude, as in the reference.
- The 5-second window is the grouping window of the notifications ([session_notifications.md](session_notifications.md), line 61).
- The switch appears only in the desktop app, because a switch with no effect in the browser would confuse the user.
- The app switch is the only control. The app does not read the "do not disturb" state of the desktop.

## Risks

- The notification server may play its own sound for the urgent notification. The user then hears two sounds.
- The `notify.sh` hook, while still installed, can add a third alert.
- The sound also plays when the user sits at that session and answers at once. The switch is the only way to silence it.

## Scope

In scope:
- One sound on entering "needs input", for hosted and external sessions, in the desktop app.
- The on/off switch in the settings popup, remembered across restarts.

Out of scope:
- Sounds for turn end or session end.
- A choice of sound, a volume, or a sound per session.
- Sound in the client open in a browser.
- Repeated sounds for a session that keeps waiting.
- Any change to the notifications, the tray or the snackbar.

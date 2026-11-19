---
slug: input_sound
date: 2026-11-19
spec: .sdd/analysis/input_sound.md
status: validated
---

# Requirements — Sound when a session needs input

"The desktop app" is the desktop application of `plan-desktop_app`, with its window and its tray icon. "Has the focus" means that the window has the keyboard focus. "The sound" is the one short sound of this plan. "The switch" is the on/off switch for the sound in the settings popup of `plan-settings_dialog`.

## Feature: Needs-input sound

| ID | Requirement |
|----|-------------|
| REQ-1 | The desktop app plays the sound when a hosted or external session enters "needs input". |
| REQ-2 | The sound plays while the window has the focus, is in the background, is minimized, or is closed to the tray. |
| REQ-3 | The sound plays within 5 seconds of the state change. |
| REQ-4 | Several sessions that enter "needs input" within 5 seconds of the first one play the sound once. |
| REQ-5 | The sound does not repeat while a session keeps needing input. |
| REQ-6 | A session that leaves "needs input" and enters it again plays the sound again. |
| REQ-7 | State changes that happened before the desktop app started do not play the sound. |
| REQ-8 | A turn end and a session end do not play the sound. |
| REQ-9 | The sound lasts at most 2 seconds, and the UI stays responsive while it plays. |

## Feature: Sound switch

| ID | Requirement |
|----|-------------|
| REQ-10 | The settings popup of the desktop app has an on/off switch for the sound, on by default. |
| REQ-11 | A change of the switch applies at once, with no reload. |
| REQ-12 | The desktop app remembers the switch across restarts. |
| REQ-13 | With the switch off, no sound plays. |
| REQ-14 | With the switch off, the notifications and the tray work as before. |

## Assumptions

The first three assumptions are gatekeeper decisions of 2026-11-19. They are not human decisions.

- **REQ-4 and REQ-6 together.** The 5-second window counts every entry into "needs input", of any session. A session that leaves and enters "needs input" again within 5 seconds of the sound plays no second sound. After the 5 seconds it plays again (REQ-6). Reason: the analysis reuses the grouping window of the notifications (`session_notifications.md`, line 61).
- **Switch turned on late.** Turning the switch on while a session already needs input plays no sound. Only a later entry into "needs input" plays it (REQ-5). Reason: REQ-1 ties the sound to the entry into "needs input".
- **Place of the switch.** The switch lives in a new "Sound" section of the settings popup, after the existing sections. Reason: the existing sections do not change.
- **Where the switch is remembered.** The desktop app remembers it like the other settings of the popup.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Only the desktop app plays the sound and shows the switch. The client open in a browser plays no sound and shows no switch.
- The settings offer no choice of sound and no volume.
- Every new text is in English, like the rest of the UI.
- The notifications, the tray and the snackbar do not change.
- Every requirement of the earlier plans of this client stays true, `plan-session_notifications` and `plan-settings_dialog` included.

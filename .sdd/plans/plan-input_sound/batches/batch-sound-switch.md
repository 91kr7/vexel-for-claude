---
batch: sound-switch
feature: Sound switch
closed_req: REQ-10, REQ-11, REQ-12, REQ-13, REQ-14
depends: needs-input-sound
---

# Batch — Sound switch

A "Sound" menu in the settings popup of the desktop app holds an on/off switch for the needs-input sound. The switch is on by default, applies at once and survives a restart.

## What this batch builds

- **Sound switch store** (web frontend, settings area) → keeps the on/off choice of the sound.
- **Sound section** (web frontend, settings area) → the body of the "Sound" menu, with the switch.

## Decisions

- **Place.** A new menu item "Sound" after "Processes", in the settings popup (`requirements.md`, assumption "Place of the switch"). The panel has the title "Sound".
- **Control.** One switch (`role="switch"`) labelled "Play a sound when a session needs input". It works with the mouse and with Space, with a visible focus, like the other controls of the popup.
- **Desktop only.** SettingsDialog shows the "Sound" menu only when `isDesktopWindow()` of useDesktopBridge is `true`. In a browser the menu list stays as today.
- **Storage.** The choice lives in `localStorage`, like the theme, the look and the shortcuts. Nothing saved means on. The desktop window keeps its `localStorage` across restarts, as it does for the theme.
- **The page checks the switch.** The sound player of batch needs-input-sound reads the store at each sound request. The desktop app keeps sending requests, and its notifications and tray never read the switch. So REQ-14 holds by construction.
- **Late switch-on.** Turning the switch on plays nothing. Only a later request plays (`requirements.md`, assumption "Switch turned on late").
- **Tests.** Vitest for the store (default on, set, subscribe, saved value), for the section, for the player with the switch off, and for the menu of SettingsDialog with and without the desktop bridge. The check that the switch survives a restart of the desktop app goes in the Electron e2e group (knowledge base `electron-e2e-separate`). The default browser e2e run checks that the browser settings have no "Sound" menu.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | web frontend, settings area | Sound switch store: on or off in `localStorage`, on when nothing is saved. Set, read and subscribe; a change reaches the subscribers at once. | REQ-10, REQ-11, REQ-12 | — |
| INT-2 | create | web frontend, settings area | Sound section: the switch of decision "Control". It shows the store value and sets it. | REQ-10, REQ-11 | INT-1 |
| INT-3 | modify | `src/web/settings/SettingsDialog.tsx` | Add the menu item "Sound" after "Processes", with the Sound section as its panel, only in the desktop window. Arrow keys and Tab include it. | REQ-10 | INT-2 |
| INT-4 | modify | sound player (batch needs-input-sound, INT-6) | At each sound request, read the store. Off → no play. | REQ-11, REQ-13, REQ-14 | INT-1 |

The developer updates the specs of SettingsDialog and of the sound player. They write the specs of the sound switch store and the Sound section, and update the indexes.

## Human acceptance

### Scenario: The user turns the sound off

- REQ → REQ-10, REQ-11
- Given → the desktop app runs for the first time with this version, and the "Sound" menu of the settings shows the switch on
- When → the user turns the switch off
- Then → the switch shows off at once, with no reload

### Scenario: No sound with the switch off

- REQ → REQ-11, REQ-13, REQ-14
- Given → the user has just turned the switch off, and the window is in the background
- When → the user sends a prompt in a terminal that makes Claude ask for a permission
- Then → no sound plays
- And → the needs-input notification and the tray badge show as before

### Scenario: The switch stays off after a restart

- REQ → REQ-12
- Given → the user turned the switch off
- When → the user quits the desktop app and starts it again
- Then → the "Sound" menu of the settings shows the switch off

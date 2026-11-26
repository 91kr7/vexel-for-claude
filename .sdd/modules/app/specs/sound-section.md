---
module: app
component: SoundSection
type: UI component
---

# SoundSection

**Purpose** → the on/off switch of the needs-input sound, first in the "Notifications" menu of the settings popup.

## Contract

Props:
- `store` → optional SoundSwitchStore. Default: the page store (`pageSoundSwitchStore()`).

Shows:
- one card with a switch (`role="switch"`) named "Play a sound when a session needs input". The text is on the left, the track on the right.
- `aria-checked` and the track follow the store: on → the track is filled with the accent and the knob is on the right; off → a neutral track with the knob on the left.

Actions:
- click on the switch, or Space while it has the focus → `store.set(!on)` once. The switch shows the new value at once, with no reload.

Keyboard:
- the switch is one Tab stop and shows the focus ring of the page.

## Rules and invariants

- turning the switch on plays no sound: only a later sound request plays (`useNeedsInputSound`).

## Dependencies

- SoundSwitchStore (`useSoundSwitch`)

## Requirements served

- `plan-input_sound/REQ-10`, `plan-input_sound/REQ-11`

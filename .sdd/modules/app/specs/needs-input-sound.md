---
module: app
component: useNeedsInputSound
type: frontend hook
---

# useNeedsInputSound

**Purpose** → plays the NeedsInputChime in the page of the desktop window on each sound request of the desktop app, when the sound switch is on.

## Contract

- `playNeedsInputSound()` → starts one play of the NeedsInputChime, as a new audio element, and returns at once. It does not wait for the end of the sound. A play that fails, by a throw or a rejected promise, is ignored: no error reaches the caller or the console.
- `useNeedsInputSound(store = pageSoundSwitchStore())`:
  - while the component is mounted → each sound request of the bridge (`onSoundRequest` of useDesktopBridge) reads the store at that moment:
    - on → calls `playNeedsInputSound()` once.
    - off → nothing plays.
  - on unmount → it stops listening.
  - no bridge (a browser) → no request, so nothing plays.

## Rules and invariants

- The page never blocks on the sound: no wait and no error from it.
- The switch only gates the play in the page. The desktop app keeps sending its requests, and its notifications and tray never read the switch.
- A switch turned on plays nothing by itself: only a later request plays.

## Dependencies

- useDesktopBridge, NeedsInputChime, SoundSwitchStore

## Requirements served

- `plan-input_sound/REQ-1`, `plan-input_sound/REQ-2`, `plan-input_sound/REQ-9`, `plan-input_sound/REQ-11`, `plan-input_sound/REQ-13`, `plan-input_sound/REQ-14`

---
module: app
component: SoundSwitchStore
type: frontend service
---

# SoundSwitchStore

**Purpose** → holds the on/off choice of the needs-input sound, saved in the page storage.

## Contract

- `SOUND_SWITCH_KEY` → `'ai-client.needs-input-sound'`, the storage key.
- `new SoundSwitchStore(storage?)` → reads the saved value once, at creation.
  - saved `'off'` → off.
  - nothing saved, any other value, no `storage`, or `getItem` throws → on.
- `getSnapshot()` → `true` when on, `false` when off.
- `set(on)`:
  - a new value → saves `'on'` or `'off'` under `SOUND_SWITCH_KEY`, then calls the `subscribe` listeners.
  - the current value → nothing: no save, no listener call.
  - `storage` missing, or `setItem` throws → the value still applies on the page and the listeners are called.
- `subscribe(listener) → unsubscribe` → `listener()` after each change, at once.
- `pageSoundSwitchStore()` → the one store of the page, created at the first call, with `localStorage`. `localStorage` not reachable → the store works without saving.
- `useSoundSwitch(store = pageSoundSwitchStore())` → React hook: `{ on, setOn }`; the component re-renders after each change.

## Rules and invariants

- Each browser profile, and the desktop window, keeps its own choice. The backend and the desktop app store nothing.

## Requirements served

- `plan-input_sound/REQ-10`, `plan-input_sound/REQ-11`, `plan-input_sound/REQ-12`

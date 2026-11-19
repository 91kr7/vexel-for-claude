---
module: desktop
component: SoundRule
type: backend service
---

# SoundRule

**Purpose** → decides which attention events play the needs-input sound.

## Contract

- `new SoundRule({ now? })` → `now()` gives the current time in milliseconds, default `Date.now`. At start no sound has played.
- `receiveEvent(event) → boolean` → `true` means "play the sound now":

  ```
  event.kind is not needs_input             → false
  else event.id received before             → false
  else a sound played at most 5000 ms ago   → false   (the id now counts as received)
  else                                      → true    (the sound counts as played at now())
  ```

## Rules and invariants

- One 5000 ms window over the events of every session. Only a played sound starts it.
- The same event id never gives a second `true`.
- It does not know the window focus: a focused window gets the same answers.
- Time comes only from `now()`. No timer runs.
- It uses no Electron API.

## Dependencies

- AttentionClient (the `AttentionEvent` shape)

## Requirements served

- `plan-input_sound/REQ-1`, `plan-input_sound/REQ-4`, `plan-input_sound/REQ-5`, `plan-input_sound/REQ-6`, `plan-input_sound/REQ-7`, `plan-input_sound/REQ-8`

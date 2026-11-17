---
module: app
component: ExitPresence
type: UI component
---

# ExitPresence

**Purpose** → keeps a closed element on screen while its exit effect plays, then removes it.

## Contract

- `<ExitPresence>{open && <X />}</ExitPresence>` → the owner mounts an element through it, with a condition.
- `useLeaving()` → `true` inside an element that is closed and plays its exit effect; `false` while it is open and outside any ExitPresence.

Behaviour:
- condition true → the element is shown, with `useLeaving()` `false`.
- condition turns false → the last shown element stays mounted, with its state, and `useLeaving()` turns `true`. After `--motion-duration-exit` (MotionTokens) it is removed.
- exit duration 0 (reduced motion) or not set (no style sheet) → the element is removed at once, with no leaving phase.
- condition turns true again during the exit → the leaving element is removed at once and a new one opens, with fresh state. The UI ends in the state of the last action.
- nested → an element inside a leaving element is leaving too.
- the owner unmounts → the element goes with it, with no exit.
- a portal as the element works the same: the leaving state reaches it.

## Dependencies

- MotionTokens (`--motion-duration-exit`)

## Requirements served

- `plan-ui_transitions/REQ-2`, `plan-ui_transitions/REQ-25`, `plan-ui_transitions/REQ-28`

---
module: app
component: ShortcutChannel
type: frontend service
---

# ShortcutChannel

**Purpose** → takes a session command of a shortcut to the component that owns the action, while that component is on the page.

## Contract

- a session command → `stop`, `dismiss`, `resume` or `rename`.
- `useSessionCommand(command, run, enabled = true)` → while the calling component is mounted and `enabled` is `true`, it subscribes to `command`. `run` is the latest function passed.
  - `enabled` becomes `false`, or unmount → the subscription goes.
- `sendSessionCommand(command)` → calls `run` of the subscriber of `command`, once, in the same call.
  - no subscriber → nothing happens.
  - more than one subscriber → only the latest one gets it.
  - a subscriber of another command → is not called.

## Rules and invariants

- the channel holds no command: a command sent with no subscriber is lost, and a later subscriber does not get it.

## Requirements served

- `plan-keyboard_shortcuts/REQ-14`, `plan-keyboard_shortcuts/REQ-16`, `plan-keyboard_shortcuts/REQ-17`, `plan-keyboard_shortcuts/REQ-18`, `plan-keyboard_shortcuts/REQ-19`, `plan-keyboard_shortcuts/REQ-43`

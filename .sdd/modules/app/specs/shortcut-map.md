---
module: app
component: ShortcutMap
type: configuration
---

# ShortcutMap

**Purpose** → the one list of the client shortcuts. The key handler and the terminal read it, so a key cannot work without its row.

## Contract

- `SHORTCUTS` → the rows, in this order. Each row is `{ area, action, keys }`.
  - `area` → `navigation`, `sessions`, `terminal` or `general`.
  - `action` → the action text in English.
  - `keys` → one or more keys. Each key is `{ code, modifiers, command }`: `code` is the physical key (`KeyboardEvent.code`), `modifiers` is a list of `Ctrl`, `Alt`, `Shift`.

  | Area | Action | Keys | Command |
  |------|--------|------|---------|
  | navigation | "Focus the list" | Alt + `KeyL` | `focus-list` |
  | navigation | "Focus the main view" | Alt + `KeyC` | `focus-main-view` |
  | navigation | "Previous / next session" | Alt + `ArrowUp`, Alt + `ArrowDown` | `open-session` with target `previous`, `next` |
  | navigation | "Session at position 1 to 9" | Alt + `Digit1` … Alt + `Digit9` | `open-session` with target `position` 1 … 9 |
  | navigation | "Next session that needs input" | Alt + `KeyI` | `open-session` with target `next-needs-input` |

- a command → `{ kind: 'focus-list' }`, `{ kind: 'focus-main-view' }` or `{ kind: 'open-session', target }`, where `target` is a `NavigationTarget` of sessionToOpen.
- `shortcutCommandOf(event) → command | null` → the command of the key that matches a keyboard event, else `null`. An event matches a key when:
  - its `code` equals the key's `code` (the physical key: Alt+L is `KeyL` on the Italian and on the US layout);
  - Ctrl, Alt and Shift are pressed exactly as the key lists them: no missing one, no extra one;
  - Meta is not pressed;
  - AltGr is not pressed (`getModifierState('AltGraph')`).
- the event type does not matter: a `keyup` of a map key also matches.

## Rules and invariants

- every key has Ctrl or Alt; no key is a single character key.
- no key uses the letters B, D, F, O, P, T, Y, M or V.
- no two keys have the same `code` and the same modifiers.

## Dependencies

- sessionToOpen `NavigationTarget` (module sessions)

## Requirements served

- `plan-keyboard_shortcuts/REQ-1`, `plan-keyboard_shortcuts/REQ-3`, `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`
- `plan-keyboard_shortcuts/REQ-34`, `plan-keyboard_shortcuts/REQ-35`, `plan-keyboard_shortcuts/REQ-36`, `plan-keyboard_shortcuts/REQ-37`, `plan-keyboard_shortcuts/REQ-39`, `plan-keyboard_shortcuts/REQ-45`

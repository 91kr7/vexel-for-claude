---
module: app
component: ShortcutMap
type: configuration
---

# ShortcutMap

**Purpose** → the one list of the client shortcuts. The key handler, the terminal and the ShortcutsPanel read it, so a key cannot work without its row, and a row cannot show without its key.

## Contract

- `SHORTCUTS` → the rows, in this order. Each row is `{ area, action, keys }`.
  - `area` → `navigation`, `sessions`, `terminal` or `general`.
  - `action` → the action text in English.
  - `keys` → one or more keys. Each key is `{ code, modifiers, command }`: `code` is the physical key (`KeyboardEvent.code`), `modifiers` is a list of `Ctrl`, `Alt`, `Shift`.
  - a terminal key → `command` is `{ kind: 'terminal' }`, and `code` is the typed character (`KeyboardEvent.key`, lower case), because SessionView matches the character. SessionView runs it; the key handler never does.

  | Area | Action | Keys | Command |
  |------|--------|------|---------|
  | navigation | "Focus the list" | Alt + `KeyL` | `focus-list` |
  | navigation | "Focus the main view" | Alt + `KeyC` | `focus-main-view` |
  | navigation | "Previous / next session" | Alt + `ArrowUp`, Alt + `ArrowDown` | `open-session` with target `previous`, `next` |
  | navigation | "Session at position 1 to 9" | Alt + `Digit1` … Alt + `Digit9` | `open-session` with target `position` 1 … 9 |
  | navigation | "Next session that needs input" | Alt + `KeyI` | `open-session` with target `next-needs-input` |
  | sessions | "New session dialog" | Alt + `KeyN` | `new-session` |
  | sessions | "Resume history dialog" | Alt + `KeyH` | `resume-history` |
  | sessions | "Rename the open session" | Alt + `KeyE` | `session-command` `rename` |
  | sessions | `"Resume" or "Resume Here" on the open session` | Alt + `KeyR` | `session-command` `resume` |
  | sessions | "Stop the open hosted session" | Alt + Shift + `KeyQ` | `session-command` `stop` |
  | sessions | "Dismiss the open ended session" | Alt + Shift + `KeyW` | `session-command` `dismiss` |
  | terminal | "Search" | Ctrl + Shift + `f` | `terminal` |
  | terminal | "Larger / smaller / default text" | Ctrl + `=`, Ctrl + `+`, Ctrl + `-`, Ctrl + `0` | `terminal` |
  | terminal | "Focus the list" | Ctrl + Shift + `l` | `terminal` |
  | general | "Light/Dark theme" | Alt + `KeyA` | `toggle-theme` |
  | general | "Shortcuts panel" | Alt + `KeyS` | `toggle-shortcuts-panel` |

- a command → `{ kind: 'focus-list' }`, `{ kind: 'focus-main-view' }`, `{ kind: 'open-session', target }`, `{ kind: 'new-session' }`, `{ kind: 'resume-history' }`, `{ kind: 'session-command', command }`, `{ kind: 'toggle-theme' }` or `{ kind: 'toggle-shortcuts-panel' }`. `target` is a `NavigationTarget` of sessionToOpen. `command` is a session command of ShortcutChannel.
- `shortcutCommandOf(event) → command | null` → the command of the key that matches a keyboard event, else `null`. A terminal key never gives a command. An event matches a key when:
  - its `code` equals the key's `code` (the physical key: Alt+L is `KeyL` on the Italian and on the US layout);
  - Ctrl, Alt and Shift are pressed exactly as the key lists them: no missing one, no extra one;
  - Meta is not pressed;
  - AltGr is not pressed (`getModifierState('AltGraph')`).
- the event type does not matter: a `keyup` of a map key also matches.

## Rules and invariants

- every key has Ctrl or Alt; no key is a single character key.
- the keys that stop or dismiss a session also need Shift.
- no key other than a terminal key uses the letters B, D, F, O, P, T, Y, M or V. The terminal keys are the keys of earlier plans, unchanged.
- no two keys have the same `code` and the same modifiers.
- rows of the same area are next to each other, in the order navigation, sessions, terminal, general.

## Dependencies

- sessionToOpen `NavigationTarget` (module sessions)
- ShortcutChannel (`SessionCommand`)

## Requirements served

- `plan-keyboard_shortcuts/REQ-1`, `plan-keyboard_shortcuts/REQ-3`, `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`
- `plan-keyboard_shortcuts/REQ-12`, `plan-keyboard_shortcuts/REQ-13`, `plan-keyboard_shortcuts/REQ-14`, `plan-keyboard_shortcuts/REQ-16`, `plan-keyboard_shortcuts/REQ-17`, `plan-keyboard_shortcuts/REQ-18`, `plan-keyboard_shortcuts/REQ-19`, `plan-keyboard_shortcuts/REQ-21`
- `plan-keyboard_shortcuts/REQ-25`, `plan-keyboard_shortcuts/REQ-26`, `plan-keyboard_shortcuts/REQ-28`
- `plan-keyboard_shortcuts/REQ-34`, `plan-keyboard_shortcuts/REQ-35`, `plan-keyboard_shortcuts/REQ-36`, `plan-keyboard_shortcuts/REQ-37`, `plan-keyboard_shortcuts/REQ-39`, `plan-keyboard_shortcuts/REQ-40`, `plan-keyboard_shortcuts/REQ-44`, `plan-keyboard_shortcuts/REQ-45`

---
module: app
component: ShortcutMap
type: configuration
---

# ShortcutMap

**Purpose** → the one list of the client shortcuts. The key handler, the terminal, the ShortcutsSection and the SettingsButton read it, so a key cannot work without its row, and a row cannot show without its key. The keys that work are the active keys: the user's keys, else the defaults.

## Contract

- `SHORTCUTS` → the rows with their default keys, in this order. Each row is `{ id, area, action, keys }`. One row per action.
  - `id` → the stable id of the row (`ShortcutId`). User keys are saved under it.
  - `area` → `navigation`, `sessions`, `terminal` or `general`.
  - `action` → the action text in English.
  - `keys` → one or more keys. Each key is `{ code, modifiers, command }`: `code` is the physical key (`KeyboardEvent.code`), `modifiers` is a list of `Ctrl`, `Alt`, `Shift`. All keys of a row have the same command.
  - a default terminal key → `command` is `{ kind: 'terminal' }`, `byCharacter` is true and `code` is the typed character (`KeyboardEvent.key`, lower case), because the terminal matches the character. SessionView runs it; the key handler never does.

  | Id | Area | Action | Default keys | Command |
  |----|------|--------|--------------|---------|
  | `focus-list` | navigation | "Focus the list" | Alt + `KeyL` | `focus-list` |
  | `focus-main-view` | navigation | "Focus the main view" | Alt + `KeyC` | `focus-main-view` |
  | `previous-session` | navigation | "Previous session" | Alt + `ArrowUp` | `open-session` target `previous` |
  | `next-session` | navigation | "Next session" | Alt + `ArrowDown` | `open-session` target `next` |
  | `session-at-1` … `session-at-9` | navigation | "Session at position 1" … "Session at position 9" | Alt + `Digit1` … Alt + `Digit9` | `open-session` target `position` 1 … 9 |
  | `next-needs-input` | navigation | "Next session that needs input" | Alt + `KeyI` | `open-session` target `next-needs-input` |
  | `new-session` | sessions | "New session dialog" | Alt + `KeyN` | `new-session` |
  | `resume-history` | sessions | "Resume history dialog" | Alt + `KeyH` | `resume-history` |
  | `rename-session` | sessions | "Rename the open session" | Alt + `KeyE` | `session-command` `rename` |
  | `resume-session` | sessions | `"Resume" or "Resume Here" on the open session` | Alt + `KeyR` | `session-command` `resume` |
  | `stop-session` | sessions | "Stop the open hosted session" | Alt + Shift + `KeyQ` | `session-command` `stop` |
  | `dismiss-session` | sessions | "Dismiss the open ended session" | Alt + Shift + `KeyW` | `session-command` `dismiss` |
  | `terminal-search` | terminal | "Search" | Ctrl + Shift + `f` | `terminal` |
  | `terminal-larger-text` | terminal | "Larger text" | Ctrl + `=`, Ctrl + `+` | `terminal` |
  | `terminal-smaller-text` | terminal | "Smaller text" | Ctrl + `-` | `terminal` |
  | `terminal-default-text` | terminal | "Default text size" | Ctrl + `0` | `terminal` |
  | `terminal-focus-list` | terminal | "Focus the list" | Ctrl + Shift + `l` | `terminal` |
  | `toggle-theme` | general | "Light/Dark theme" | Alt + `KeyA` | `toggle-theme` |
  | `shortcut-settings` | general | "Shortcut settings" | Alt + `KeyS` | `open-shortcut-settings` |

- a command → `{ kind: 'focus-list' }`, `{ kind: 'focus-main-view' }`, `{ kind: 'open-session', target }`, `{ kind: 'new-session' }`, `{ kind: 'resume-history' }`, `{ kind: 'session-command', command }`, `{ kind: 'toggle-theme' }` or `{ kind: 'open-shortcut-settings' }`. `target` is a `NavigationTarget` of sessionToOpen. `command` is a session command of ShortcutChannel.
- Active keys. Every function below takes an optional `store` (default: the page UserShortcutKeys).
  - `activeKeys(id, store?)` → the row has a user key in `store` → that one key, with the command of the row, matched by physical key (`byCharacter` false, `character` kept). Else → the default keys.
  - `shortcutRows(store?)` → `SHORTCUTS` with the active keys of each row.
  - `defaultKeys(id)` → the default keys of the row.
  - `hasDefaultKeys(id, store?)` → true when the active keys show the same texts as the default keys, in the same order.
- `shortcutCommandOf(event, store?) → command | null` → the command of the active key that matches a keyboard event, else `null`. A terminal key never gives a command.
- `terminalShortcutOf(event, store?) → id | null` → the id of the terminal row whose active key matches the event, else `null`.
- `pressOf(event)` → the press of a keyboard event: `code`, `key`, Ctrl, Alt, Shift, Meta and AltGr.
- `keyMatches(key, press)` → whether a key runs for a press:
  - a physical key → the press has the key's `code`; Ctrl, Alt and Shift are pressed exactly as the key lists them; Meta is not pressed; AltGr is not pressed (`getModifierState('AltGraph')`). Alt+L is `KeyL` on the Italian and on the US layout.
  - a default terminal key (`byCharacter`) → Ctrl pressed, Alt and Meta not pressed, Shift pressed when the key lists it (else Shift does not matter), and the typed character, in lower case, equals `code`.
- the event type does not matter: a `keyup` of a map key also matches.
- `keyText(key) → text` → the display text of a key, without modifiers:

  | Key | Text |
  |-----|------|
  | `KeyA` … `KeyZ` | the letter, `A` … `Z` |
  | `Digit0` … `Digit9` | the digit |
  | `F1` … `F24`, `Enter`, `Space`, `Tab`, `Home`, `End`, `Backspace` | the same name |
  | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` | `Up`, `Down`, `Left`, `Right` |
  | `Escape`, `Delete`, `Insert`, `PageUp`, `PageDown`, `NumpadEnter` | `Esc`, `Del`, `Ins`, `Page Up`, `Page Down`, `Enter` |
  | `Minus`, `Equal`, `BracketLeft`, `BracketRight`, `Backslash`, `IntlBackslash`, `Semicolon`, `Quote`, `Backquote`, `Comma`, `Period`, `Slash` | `-`, `=`, `[`, `]`, `\`, `<`, `;`, `'`, `` ` ``, `,`, `.`, `/` |
  | `Numpad0` … `Numpad9` | `Num 0` … `Num 9` |
  | a default terminal key | its character in upper case, e.g. `F`, `=`, `+` |
  | any other code | the code itself |

- `keysText(key)` → the modifiers, then `keyText`, joined by "+", e.g. "Alt+S".
- `rowKeysText(id, store?)` → the `keysText` of the row's active keys, joined by " / ", e.g. "Ctrl+= / Ctrl++". For tooltips.
- `commandKeysText(kind, store?) → texts` → the `keysText` of every active key whose command has that `kind`, in map order. E.g. `open-shortcut-settings` → `["Alt+S"]`. No key → `[]`.

## Rules and invariants

- the default keys: every key has Ctrl or Alt; the keys that stop or dismiss a session also need Shift; no key other than a terminal key uses the letters B, D, F, O, P, T, Y, M or V; no two keys have the same `code` and the same modifiers. The terminal keys are the keys of earlier plans, unchanged.
- a user key always went through the ShortcutKeyCheck, so the active keys keep these rules too.
- a row with user keys has exactly one key. A row without them has its default keys, and its matching does not change.
- Enter and Esc of the dialogs are not rows.
- rows of the same area are next to each other, in the order navigation, sessions, terminal, general.

## Dependencies

- sessionToOpen `NavigationTarget` (module sessions)
- ShortcutChannel (`SessionCommand`)
- UserShortcutKeys

## Requirements served

- `plan-keyboard_shortcuts/REQ-1`, `plan-keyboard_shortcuts/REQ-3`, `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`
- `plan-keyboard_shortcuts/REQ-12`, `plan-keyboard_shortcuts/REQ-13`, `plan-keyboard_shortcuts/REQ-14`, `plan-keyboard_shortcuts/REQ-16`, `plan-keyboard_shortcuts/REQ-17`, `plan-keyboard_shortcuts/REQ-18`, `plan-keyboard_shortcuts/REQ-19`, `plan-keyboard_shortcuts/REQ-21`
- `plan-keyboard_shortcuts/REQ-25`, `plan-keyboard_shortcuts/REQ-26`, `plan-keyboard_shortcuts/REQ-28`
- `plan-keyboard_shortcuts/REQ-34`, `plan-keyboard_shortcuts/REQ-35`, `plan-keyboard_shortcuts/REQ-36`, `plan-keyboard_shortcuts/REQ-37`, `plan-keyboard_shortcuts/REQ-39`, `plan-keyboard_shortcuts/REQ-40`, `plan-keyboard_shortcuts/REQ-44`, `plan-keyboard_shortcuts/REQ-45`
- `plan-settings_dialog/REQ-3`, `plan-settings_dialog/REQ-22`, `plan-settings_dialog/REQ-23`, `plan-settings_dialog/REQ-25`, `plan-settings_dialog/REQ-26`, `plan-settings_dialog/REQ-27`, `plan-settings_dialog/REQ-37`, `plan-settings_dialog/REQ-38`

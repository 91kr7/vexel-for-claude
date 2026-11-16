---
module: app
component: ShortcutKeyCheck
type: frontend service
---

# ShortcutKeyCheck

**Purpose** → decides whether a combination can become the keys of a row, or why not.

## Contract

- a result → `{ accepted: true }` or `{ accepted: false, message }`.
- `checkPress(id, press, store?)` → the check of a pressed combination for row `id`.
- `checkDefaultKeys(id, store?)` → the same check for every default key of row `id` ("Restore Default").
- the checks run in this order; the first that fails gives the message:
  1. no Ctrl and no Alt, or AltGr pressed → "Use Ctrl or Alt in the shortcut".
  2. ReservedKeys has an owner → "Used by Claude Code", "Used by the desktop" or "Used by the browser".
  3. another row has an active key that conflicts → "Already used by <action of that row>". The first such row in map order is named.
  4. else → accepted.
- a conflict with another row's key, any of:
  - that key runs for the press (`keyMatches`). A default terminal key conflicts when the terminal would run it for the same key press, e.g. Ctrl+Shift+F conflicts with "Search".
  - the candidate key runs for that key's press: same physical key and same modifiers. For a user key of a terminal row, its saved character counts too.
- the row's own keys never conflict: they are replaced.
- `modifiersOfPress(press)` → the `Ctrl`, `Alt`, `Shift` of a press, in this order.
- `store` → default: the page UserShortcutKeys. The check changes nothing.

## Rules and invariants

- a Meta press with Ctrl or Alt is rejected as used by the desktop; without Ctrl or Alt, by rule 1.
- Enter and Esc without Ctrl or Alt are rejected by rule 1.

## Dependencies

- ShortcutMap, ReservedKeys, UserShortcutKeys

## Requirements served

- `plan-settings_dialog/REQ-28`, `plan-settings_dialog/REQ-29`, `plan-settings_dialog/REQ-30`, `plan-settings_dialog/REQ-31`, `plan-settings_dialog/REQ-32`, `plan-settings_dialog/REQ-34`

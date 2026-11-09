---
module: app
component: ShortcutsPanel
type: UI component
---

# ShortcutsPanel

**Purpose** → the dialog that lists every client shortcut by area. Its rows come from the ShortcutMap, so it shows exactly the keys that work.

## Contract

Props:
- `onClose()` → called by "Close", "[Esc]" and the Esc key.

Description:
- a Dialog titled "Keyboard Shortcuts", with no primary action: the footer has only "Close". The frame has the class `shortcuts-panel`, which the key handler reads.

Shows:
- the region "Shortcut List" → it scrolls when the groups do not fit, and takes the focus with Tab, so the arrow keys scroll it.
- four groups, in this order, each with its heading: "Navigation", "Sessions", "Terminal", "General". Each group lists the `SHORTCUTS` rows of its area, in map order.
- one row per map row → its keys, then its action text.
- a key → one `.kbd-badge` per modifier and one for the key, joined by "+", e.g. `[Alt]+[L]`, `[Alt]+[Shift]+[Q]`, `[Ctrl]+[Shift]+[F]`.
- the keys of a row → joined by " / ". A row with more than four keys shows its first and its last key, joined by " … ", e.g. `[Alt]+[1] … [Alt]+[9]`.
- key text:

  | Key | Text |
  |-----|------|
  | `KeyA` … `KeyZ` | the letter, `A` … `Z` |
  | `Digit0` … `Digit9` | the digit |
  | `ArrowUp`, `ArrowDown` | `Up`, `Down` |
  | a terminal key | its character in upper case, e.g. `F`, `=`, `+` |

- the colours follow the active theme, as every Dialog.

Keyboard:
- on open → the focus is on "Close", with the visible focus ring when the panel opened from the keyboard.
- Tab and Shift+Tab → "[Esc]", the region "Shortcut List" and "Close", inside the dialog only.
- Esc → `onClose()`. Enter on "Close" → `onClose()`.

## Rules and invariants

- every row of the ShortcutMap shows, and nothing else: no key is written in the panel itself.
- the panel sends nothing to the server and changes no session.

## Dependencies

- Dialog, ShortcutMap, useShortcutKeys (the `shortcuts-panel` class), ThemeTokens, WebEntry (`.kbd-badge`, `.section-label`)

## Requirements served

- `plan-keyboard_shortcuts/REQ-26`, `plan-keyboard_shortcuts/REQ-27`, `plan-keyboard_shortcuts/REQ-28`, `plan-keyboard_shortcuts/REQ-29`, `plan-keyboard_shortcuts/REQ-32`, `plan-keyboard_shortcuts/REQ-33`

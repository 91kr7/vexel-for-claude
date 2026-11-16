---
module: app
component: ShortcutsSection
type: UI component
---

# ShortcutsSection

**Purpose** → the "Shortcuts" section of the SettingsDialog: it lists every client shortcut by area. Its rows come from the ShortcutMap, so it shows exactly the keys that work.

## Contract

Props: none.

Description:
- the content of a tab panel, not a dialog: no frame, no title, no "Close" and no `shortcuts-panel` class.

Shows:
- the region "Shortcut List" → it scrolls when the groups do not fit in the popup, and takes the focus with Tab, so the arrow keys scroll it.
- four groups, in this order, each with its heading: "Navigation", "Sessions", "Terminal", "General". Each group lists the `SHORTCUTS` rows of its area, in map order.
- one row per map row → its keys, then its action text.
- a key → one `.kbd-badge` per modifier and one for the key, joined by "+", e.g. `[Alt]+[L]`, `[Alt]+[Shift]+[Q]`, `[Ctrl]+[Shift]+[F]`.
- the keys of a row → joined by " / ". A row with more than four keys shows its first and its last key, joined by " … ", e.g. `[Alt]+[1] … [Alt]+[9]`.
- key text → `keyText` of the ShortcutMap.
- the colours follow the active theme, as the rest of the popup.

## Rules and invariants

- every row of the ShortcutMap shows, and nothing else: no key is written in the section itself.
- the section sends nothing to the server and changes no session.

## Dependencies

- ShortcutMap, SettingsDialog (its tab panel), ThemeTokens, WebEntry (`.kbd-badge`, `.section-label`)

## Requirements served

- `plan-keyboard_shortcuts/REQ-26`, `plan-keyboard_shortcuts/REQ-27`, `plan-keyboard_shortcuts/REQ-28`, `plan-keyboard_shortcuts/REQ-32`, `plan-keyboard_shortcuts/REQ-33`
- `plan-settings_dialog/REQ-22`, `plan-settings_dialog/REQ-23`

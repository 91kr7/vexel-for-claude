---
module: app
component: ShortcutsSection
type: UI component
---

# ShortcutsSection

**Purpose** → the "Shortcuts" section of the SettingsDialog: it lists every client shortcut by area, and lets the user change and restore their keys. Its rows come from the ShortcutMap, so it shows exactly the keys that work.

## Contract

Props:
- `store` → optional UserShortcutKeys store. Default: the page store.

Description:
- the right part of the "Shortcuts" menu of the SettingsDialog, not a dialog: its header with the title "Shortcuts" and "Restore All", and its body that scrolls. No frame, no "Close" and no `shortcuts-panel` class.

Shows:
- "Restore All" → a button on the right of the header, outside the region that scrolls.
- the region "Shortcut List" → the body under the header. It scrolls when the groups do not fit in the popup, and takes the focus with Tab, so the arrow keys scroll it.
- four groups, in this order, each with its heading: "Navigation", "Sessions", "Terminal", "General". Each group lists the rows of its area, in map order, with their active keys.
- one row per map row, on one line at a 1440 × 900 window → its action text on the left, then on the right its keys and the icon buttons "Change Keys" (pencil) and "Restore Default" (rotate-ccw). Each icon button has a tooltip (`title`) with its short name, "Change Keys" or "Restore Default".
- a key → one `.kbd-badge` per modifier and one for the key, joined by "+", e.g. `[Alt]+[L]`, `[Alt]+[Shift]+[Q]`, `[Ctrl]+[Shift]+[F]`. Key text → `keyText` of the ShortcutMap.
- the keys of a row → joined by " / ". A row with more than four keys shows its first and its last key, joined by " … ".
- "Change Keys" → accessible name "Change Keys: <action>".
- "Restore Default" → accessible name "Restore Default: <action>". Enabled only when the row's active keys differ from its defaults (`hasDefaultKeys` false).
- each row → a dense row of ListStyles (`.list-row`) with its hover, its text aligned with the group heading. No separator lines between rows.
- a row in editing → "Press new keys, Esc to cancel" in place of its keys.
- a rejected key → its message inside the row, under the action (`role="alert"`), e.g. "Already used by Focus the list". "Change Keys" of that row is described by it.
- the colours follow the active theme, as the rest of the popup.

Actions:
- "Change Keys" → the row goes in editing; any other row leaves editing. The row's message goes.
- in editing, every `keydown` and `keyup` on the page is cancelled (`preventDefault`) and stopped before any other listener, so no key reaches the Dialog, the shortcuts or the terminal. Then, on `keydown`:
  - Ctrl, Alt, Shift, Meta or AltGr alone → nothing; the row stays in editing.
  - Esc → the row leaves editing with its old keys, the message goes, the focus goes back to its "Change Keys". The popup stays open.
  - any other key → `checkPress` of the ShortcutKeyCheck.
    - accepted → the row gets this one key (`set` of UserShortcutKeys, with the physical key, the modifiers and the typed character), leaves editing, and the focus goes back to its "Change Keys".
    - rejected → the row stays in editing, with the message under it. The keys do not change.
- "Restore Default" → the row leaves editing, then `checkDefaultKeys`:
  - accepted → the row gets its default keys back, the message goes, and the focus moves to its "Change Keys".
  - rejected → nothing changes; the message shows under the row.
- "Restore All" → the editing ends and a WarningDialog (amber, `accent="attn"`) opens over the popup: title "Restore All Shortcuts", text "Every shortcut goes back to its default keys.", primary "Restore All", focus on "Cancel".
  - "Restore All" → every row gets its default keys, every message goes, the dialog closes.
  - "Cancel" or Esc → nothing changes, the dialog closes; the settings popup stays open.
- a change shows at once in every row and everywhere the ShortcutMap is read.

Keyboard:
- every button is reached with Tab and activated with Enter or Space, with the focus ring of the page.

## Rules and invariants

- every row of the ShortcutMap shows, and nothing else: no key is written in the section itself. Enter and Esc of the dialogs have no row.
- a key is saved only after the ShortcutKeyCheck accepts it.
- the section sends nothing to the server and changes no session.

## Dependencies

- ShortcutMap, ShortcutKeyCheck, UserShortcutKeys, WarningDialog, SettingsDialog (its menu pane), IconSet (`PencilIcon`, `RotateCcwIcon`), ThemeTokens, ListStyles, WebEntry (`.kbd-badge`, `.button-neutral`)

## Requirements served

- `plan-keyboard_shortcuts/REQ-26`, `plan-keyboard_shortcuts/REQ-27`, `plan-keyboard_shortcuts/REQ-28`, `plan-keyboard_shortcuts/REQ-32`, `plan-keyboard_shortcuts/REQ-33`
- `plan-settings_dialog/REQ-22`, `plan-settings_dialog/REQ-23`, `plan-settings_dialog/REQ-26`, `plan-settings_dialog/REQ-31`, `plan-settings_dialog/REQ-32`, `plan-settings_dialog/REQ-33`, `plan-settings_dialog/REQ-34`, `plan-settings_dialog/REQ-35`, `plan-settings_dialog/REQ-36`, `plan-settings_dialog/REQ-39`, `plan-settings_dialog/REQ-41`, `plan-settings_dialog/REQ-42`, `plan-settings_dialog/REQ-58`, `plan-settings_dialog/REQ-59`
- `plan-dark_blue_theme/REQ-47`

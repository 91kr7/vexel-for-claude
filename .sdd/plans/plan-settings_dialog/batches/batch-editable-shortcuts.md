---
batch: editable-shortcuts
feature: Editable shortcuts
closed_req: [REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42]
depends: [shortcuts-section]
---

# Batch editable-shortcuts — Editable shortcuts

Requirements → `.sdd/plans/plan-settings_dialog/requirements.md`. Batch shortcuts-section made the "Shortcuts" tab of the settings popup. This batch lets the user change the keys there.

## What this batch builds

- **User shortcut keys** → the keys the user chose for each shortcut, saved in the page storage and applied over the defaults.
- **Reserved keys** → the combinations that Claude Code, the desktop and the browser use, each with its owner.
- **Key check** → the rule that accepts a new combination for a shortcut, or rejects it with the reason.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/shortcut-map.ts` | One row per action: split "Previous / next session", "Session at position 1 to 9" and "Larger / smaller / default text". Give each row a stable id. The default keys stay as today. | REQ-22, REQ-27 | — |
| INT-2 | create | frontend, app area | User shortcut keys: the keys per row id, saved in `localStorage` under `ai-client.shortcuts`. Set one row, restore one row, restore all, subscribe. Active keys = the user keys, else the defaults. | REQ-26, REQ-34, REQ-35, REQ-37, REQ-40 | INT-1 |
| INT-3 | modify | `src/web/shortcut-map.ts` | `shortcutCommandOf` and the rows give the active keys of INT-2. Add the plain text of a row's keys for tooltips, e.g. "Alt+S". | REQ-37, REQ-38 | INT-2 |
| INT-4 | create | frontend, app area | Reserved keys: the list of section "Reserved keys" below, each with its owner. | REQ-29 | — |
| INT-5 | create | frontend, app area | Key check of a combination for one row: accepted, or rejected because it has no Ctrl or Alt, is reserved (with its owner), or is a key of another row (with its action). | REQ-28, REQ-29, REQ-30, REQ-32 | INT-3, INT-4 |
| INT-6 | modify | `src/web/ShortcutsPanel.tsx` | Each row gets "Change Keys". It puts the row in editing: the next key that is not a modifier is checked by INT-5 and, when accepted, saved in INT-2. Every key during editing is cancelled and stopped. | REQ-26, REQ-41, REQ-42 | INT-2, INT-5 |
| INT-7 | modify | `src/web/ShortcutsPanel.tsx` | A rejected key leaves the row in editing and shows the message of section "Texts" under the row. Esc in editing cancels and keeps the old keys; it does not close the popup. | REQ-31, REQ-32, REQ-33, REQ-39 | INT-6 |
| INT-8 | modify | `src/web/ShortcutsPanel.tsx` | Key text for any physical key a user can choose: letters, digits, F-keys, arrows, Enter, Space and punctuation. | REQ-23, REQ-26 | INT-1 |
| INT-9 | modify | `src/web/ShortcutsPanel.tsx` | Each row gets "Restore Default", enabled only when its keys differ from the default. The default keys go through INT-5 like a new key; a conflict is rejected with the same message. | REQ-34, REQ-42 | INT-5, INT-7 |
| INT-10 | modify | `src/web/ShortcutsPanel.tsx` | "Restore All" at the top of the section opens a WarningDialog (amber) over the popup. Its primary action puts every row back to its defaults; "Cancel" changes nothing. | REQ-35, REQ-36, REQ-42 | INT-2 |
| INT-11 | modify | `src/web/sessions/SessionView.tsx` | Terminal keys (search, zoom, focus the list) come from the active keys. Default keys keep today's match by character; a user key matches by physical key. The "Search" tooltip shows the active keys. | REQ-27, REQ-37, REQ-38 | INT-3 |
| INT-12 | modify | `src/web/sessions/TerminalZoomControls.tsx` | The three tooltips show the active keys of their rows, and change at once after a save. | REQ-38 | INT-3 |
| INT-13 | modify | settings button (app area, built by batch settings-popup) | The tooltip changes at once when the keys of "Shortcut settings" change. | REQ-38 | INT-3 |

Notes for the implementer:

- A row with more than one key, such as "Larger text" (Ctrl+= or Ctrl++): a change sets one key and replaces all of them. "Restore Default" puts back all of them.
- "Another row" in INT-5 includes the terminal rows. A combination conflicts with a default terminal key when the terminal would run that key for the same key press.
- During editing the settings popup is open, so useShortcutKeys runs no shortcut and the terminal has no focus. The row must still cancel and stop every key, so Enter and Esc never reach the Dialog (REQ-41).
- Enter and Esc of the dialogs are not rows of the map, and stay so (REQ-39). Esc in editing cancels. Enter has no Ctrl or Alt, so it is rejected.
- A Meta key press is reserved by the desktop.
- An unreadable or invalid stored value for a row gives its defaults.
- Matching stays as today: physical key, Ctrl, Alt and Shift exactly, no Meta, no AltGr.

## Reserved keys

The owners are checked in this order; the first that has the combination is named. Sources → `.sdd/analysis/keyboard_shortcuts.md`, lines 95-97.

| Owner | Combinations |
|-------|--------------|
| Claude Code | Ctrl + any letter, alone. Alt + B, D, F, O, P, T, Y, M or V, alone. Ctrl+Enter. Ctrl+Shift+- |
| The desktop | Any combination with Meta (Super). Alt+Tab, Alt+Shift+Tab, Alt+F1, Alt+F2, Alt+F4, Alt+F7, Alt+F8, Alt+F10, Alt+Space. Ctrl+Alt + any arrow, also with Shift. Ctrl+Alt+T, Ctrl+Alt+Delete |
| The browser | Ctrl+Shift+T, Ctrl+Shift+N, Ctrl+Shift+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PageUp, Ctrl+PageDown |

Ctrl+T, Ctrl+W and Ctrl+N are also browser keys. Claude Code owns them first, by the order above.

## Texts

| Where | Text |
|-------|------|
| Row button | "Change Keys" (accessible name "Change Keys: <action>") |
| Row in editing | "Press new keys, Esc to cancel" |
| No Ctrl or Alt | "Use Ctrl or Alt in the shortcut" |
| Reserved | "Used by Claude Code", "Used by the desktop", "Used by the browser" |
| Another row | "Already used by <action>" |
| Row restore | "Restore Default" (accessible name "Restore Default: <action>") |
| Section restore | "Restore All" |
| Confirmation | title "Restore All Shortcuts", text "Every shortcut goes back to its default keys.", primary "Restore All" |

## Human acceptance

### Scenario: The user gives a shortcut new keys and uses them at once

- REQ → REQ-26, REQ-27, REQ-37, REQ-38, REQ-40, REQ-41, REQ-42
- Given → a hosted session is open, and the settings popup shows the "Shortcuts" tab
- When → the user chooses "Change Keys" on the terminal row "Search" with the keyboard, presses Alt+K, closes the popup and reloads the page
- Then → the row shows Alt+K, the "Search" tooltip reads "Search (Alt+K)", and Alt+K in the terminal opens the search box
- And → no "k" was typed into the Claude Code prompt

### Scenario: The client rejects a key that is already taken

- REQ → REQ-28, REQ-29, REQ-30, REQ-31, REQ-32
- Given → the row "New session dialog" is in editing
- When → the user presses Alt+L
- Then → the row shows "Already used by Focus the list" and keeps Alt+N
- And → Shift+K shows "Use Ctrl or Alt in the shortcut", and Alt+B shows "Used by Claude Code"

### Scenario: The user cancels an edit with Esc

- REQ → REQ-33, REQ-39
- Given → the row "Rename the open session" is in editing
- When → the user presses Esc
- Then → the row leaves editing with Alt+E, and the popup stays open with no row for Enter or Esc

### Scenario: The user restores the default keys

- REQ → REQ-34, REQ-35, REQ-36
- Given → "Focus the list" uses Alt+K and "Resume history dialog" uses Alt+J
- When → the user chooses "Restore Default" on "Focus the list", then "Restore All" and confirms
- Then → "Focus the list" shows Alt+L after the first action, and every row shows its default keys after the confirmation

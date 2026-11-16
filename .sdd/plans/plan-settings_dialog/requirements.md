---
slug: settings_dialog
date: 2026-11-16
spec: .sdd/analysis/settings_dialog.md
status: validated
---

# Requirements — Settings popup with editable shortcuts

Words used below:

- "Sidebar" → the column of the session list.
- "Navigation rail" → the vertical icon bar with "Sessions", "Projects" and "Resume", left of the sidebar.
- "Settings button" → the new button at the bottom of the navigation rail.
- "Popup" → the settings popup that the settings button opens.
- "Look" → the macOS look or the Windows 11 look of `wsl_support.md`.
- "Shortcut" → a client shortcut, as listed today in the shortcuts panel of `keyboard_shortcuts.md`.
- "Settings shortcut" → the shortcut that opens the shortcuts panel today (Alt+S by default).
- "Theme shortcut" → the shortcut that switches the theme today (Alt+A by default).
- "Row" → one shortcut in the shortcuts section of the popup.
- "Reserved key" → a combination that Claude Code, the GNOME desktop or the browser uses, from the lists of `keyboard_shortcuts.md`, lines 95-97.

## Feature: Settings popup

| ID | Requirement |
|----|-------------|
| REQ-1 | The navigation rail shows the settings button at its bottom, below its other buttons, and the sidebar does not show it. |
| REQ-2 | The settings button stays visible at every window height and every sidebar width. |
| REQ-3 | The settings button has an accessible name and a tooltip that shows the settings shortcut. |
| REQ-4 | A click on the settings button opens the popup on its first section. |
| REQ-5 | The popup is a modal dialog in the style of the other dialogs of the client. |
| REQ-6 | The popup has a theme section and a look section, in this order. |
| REQ-7 | Esc and a close button close the popup. |
| REQ-8 | When the popup closes, the focus goes back where it was before the popup opened. |
| REQ-9 | Opening or closing the popup does not interrupt any session, and keeps the open session and its scroll position. |
| REQ-10 | The popup follows the active theme and the active look. |
| REQ-11 | The popup and every control in it work with the keyboard, with a visible focus. |
| REQ-12 | The theme section lets the user choose Light or Dark, with the behaviour of `light_theme.md`, lines 45-48. |
| REQ-13 | The look section lets the user choose the macOS look or the Windows 11 look, with the behaviour of `wsl_support.md`, lines 50-52. |
| REQ-14 | The theme section and the look section each show the active choice. |
| REQ-15 | A change of theme or look applies to the whole client at once, while the popup stays open. |
| REQ-16 | The top bar no longer shows the theme switch or the look switch. |
| REQ-17 | The top bar keeps an empty area to drag the window at every width. |
| REQ-18 | The theme shortcut keeps switching the theme. |
| REQ-19 | While the popup is open, the shortcuts do nothing. |
| REQ-20 | The settings button and the popup work the same in the desktop app and in the browser, with both theme and both look choices in both. |

## Feature: Shortcuts in the settings

| ID | Requirement |
|----|-------------|
| REQ-21 | The popup has a shortcuts section, after the look section. |
| REQ-22 | The shortcuts section lists every shortcut, grouped by area as the shortcuts panel does today. |
| REQ-23 | Each row shows the action and its current keys. |
| REQ-24 | The top bar no longer shows the shortcuts button, and the shortcuts panel no longer exists. |
| REQ-25 | The settings shortcut opens the popup on the shortcuts section. |

## Feature: Editable shortcuts

| ID | Requirement |
|----|-------------|
| REQ-26 | The user can start editing a row, press a new combination, and the client saves it as the keys of that row. |
| REQ-27 | Every shortcut is editable, terminal search and terminal zoom included. |
| REQ-28 | The client rejects a combination without Ctrl or Alt, and does not save it. |
| REQ-29 | The client rejects a reserved key, and does not save it. |
| REQ-30 | The client rejects a combination that another shortcut already uses, and does not save it. |
| REQ-31 | A rejected combination shows a message that says why it was rejected. |
| REQ-32 | When another shortcut already uses the rejected combination, the message names its action. |
| REQ-33 | Esc while editing a row cancels the edit and keeps the old keys. |
| REQ-34 | Each row has a "restore default" action that puts back the default keys of that row. |
| REQ-35 | The shortcuts section has a "restore all" action that puts every shortcut back to its default keys. |
| REQ-36 | "Restore all" asks for a confirmation before it changes anything. |
| REQ-37 | A saved change applies at once, everywhere in the client, with no reload. |
| REQ-38 | Every tooltip that shows a shortcut shows its current keys. |
| REQ-39 | Enter and Esc in dialogs keep their keys and do not appear as editable. |
| REQ-40 | The client remembers the changed shortcuts across reloads and restarts. |
| REQ-41 | A key press during editing does not reach Claude Code and does not start another shortcut. |
| REQ-42 | Editing a row, "restore default" and "restore all" work with the keyboard, with a visible focus. |

## Assumptions

- **Place of the settings button (REQ-1, REQ-2).** Human decision (2026-11-16): the button sits at the bottom of the navigation rail, not in the sidebar. The spec carries this decision.
- **First section (REQ-4, REQ-25).** The settings button opens the popup on the theme section. Only the settings shortcut opens it on the shortcuts section (spec, "Assumptions").
- **No Save button (REQ-15, REQ-26).** Every change applies at once. The popup has no "Save" or "Cancel" button (spec, "Assumptions").
- **Tooltip of the settings button (REQ-3).** Gatekeeper decision, not a human decision (2026-11-16). Accessible name "Settings". The tooltip shows the current keys of the settings shortcut, for example "Settings (Alt+S)". Those keys open the popup on the shortcuts section, not on the first section; this is accepted.
- **Shortcuts in the popup (REQ-19).** The settings shortcut does nothing while the popup is open, like every other shortcut. The popup closes with Esc or its close button only.
- **Where the client remembers (REQ-40).** The client remembers the shortcuts where the user changed them, like the theme. The desktop app and each browser can keep different shortcuts (spec, "Assumptions").
- **Rows with more than one key (REQ-26, REQ-34).** Gatekeeper decision, not a human decision (2026-11-16). One row can have more than one default key, for example the terminal zoom "larger text" (Ctrl+= or Ctrl++). An edit sets one combination for the row and replaces all its keys. "Restore default" puts back all the default keys.
- **Session at position 1 to 9 (REQ-27).** Gatekeeper decision, not a human decision (2026-11-16). These are nine shortcuts, so nine rows. Each one is edited on its own.
- **One row per action (REQ-22, REQ-27).** Gatekeeper decision, not a human decision (2026-11-16). Today the panel joins some actions in one row: "Previous / next session", "Session at position 1 to 9", "Larger / smaller / default text". The shortcuts section shows one row per action, so each action gets its own keys. The areas and their order stay as today. This follows from the two decisions above.
- **Editing waits for a full combination (REQ-26, REQ-28).** A press of Ctrl, Alt, Shift or Meta alone does not end the edit. The edit ends at the first key that is not a modifier.
- **Name in the message (REQ-32).** Gatekeeper decision, not a human decision (2026-11-16). Only a conflict with another client shortcut names an action. A reserved key is rejected with a message that names its owner: Claude Code, the desktop or the browser.
- **Restore default in conflict (REQ-30, REQ-34).** Gatekeeper decision, not a human decision (2026-11-16). If the default keys of a row are now used by another shortcut, "restore default" is rejected like an edit, with the same message. The two keys are not swapped.
- **Layout (REQ-26).** The AltGr rule of `keyboard_shortcuts.md`, line 80, binds the defaults only. A user's own key works on the user's own layout (spec, "Assumptions").

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text is in English, like the rest of the client.
- The shortcuts that the user did not change keep their keys and behaviour (`keyboard_shortcuts.md` REQs).
- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/settings_dialog.md`, "Scope").
- Every requirement of the earlier plans stays true, except the top bar switches and the shortcuts panel that this plan removes.

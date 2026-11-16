---
module: app
component: SettingsDialog
type: UI component
---

# SettingsDialog

**Purpose** → the modal "Settings" popup. A vertical menu on the left chooses one of three menus, "Appearance", "Shortcuts" and "Updates"; the chosen menu shows on the right.

## Contract

Props:
- `initialTab` → `appearance` (default), `shortcuts` or `updates`: the menu shown on open.
- `onClose()` → called by "Close", "[Esc]" and the Esc key.
- `themeStore`, `lookStore` → optional stores passed to the sections. Default: the page stores.
- `onNewerVersion(version)` → optional, passed to UpdatesSection: called when the user's check finds a newer version.

Description:
- a Dialog titled "Settings", with no primary action: the footer has "Close" only. The frame has the class `settings-dialog`.
- the frame is 760 × 540 px; each side is at most the window minus 32 px. The size does not change with the menu.

Shows:
- on the left, a vertical tab list named "Settings sections" (`aria-orientation="vertical"`) with the items "Appearance", "Shortcuts" and "Updates", in this order. Each item is a dense row of ListStyles (`.list-row`) with its hover. The chosen item has `aria-selected="true"`, the active look of ListStyles (`.list-active`) and bold text. The menu column is on `--role-list`.
- on the right, one tab panel, labelled by its item. It has a header with the menu title and an optional action, and a body that scrolls on its own when the content does not fit. A control that Tab scrolls to the edge of the body shows its whole focus ring; the focused body shows its ring inside its own edge. The popup itself never scrolls.
  - "Appearance" → title "Appearance"; the body holds ThemeSection, then LookSection.
  - "Shortcuts" → ShortcutsSection: title "Shortcuts" and the action "Restore All" in the header, the "Shortcut List" region as body.
  - "Updates" → title "Updates"; the body holds UpdatesSection.
- the other panels are hidden.
- UpdatesSection stays mounted while the popup is open, also behind another menu: its result and a running check survive a menu change. A new opening starts with no result.
- the colours and the look follow the active theme and look, as every Dialog. A change made in a section restyles the popup at once.

Actions:
- click on a menu item → that menu shows.

Keyboard:
- on open → the focus is on the chosen menu item.
- the menu is one Tab stop: the chosen item. Down and Up arrows → the next or previous item, wrapping; Home and End → the first or last item. The new menu shows and its item takes the focus.
- Tab and Shift+Tab → "[Esc]", the chosen menu item, the focusable items of the menu (the checked card of each group; "Restore All", the "Shortcut List" region and the row buttons; or "Check for Updates" and "View Release") and "Close", inside the dialog only (Dialog).
- Esc → `onClose()`. Enter adds nothing (no primary action).
- on close → the focus goes back where it was before the popup opened (Dialog).

## Rules and invariants

- the popup has `aria-modal="true"`, so useShortcutKeys runs no shortcut while it is open, Alt+S included.
- the popup changes no session. Its only server call is the update check of UpdatesSection, on the user's request.
- the popup stays open after an update check, whatever the result.
- every change applies at once: there is no "Save" and no "Cancel".

## Dependencies

- Dialog, ThemeSection, LookSection, ShortcutsSection, UpdatesSection, ThemeStore, LookStore, useShortcutKeys (reads `aria-modal`), ThemeTokens, Windows11Look, ListStyles

## Requirements served

- `plan-settings_dialog/REQ-5`, `plan-settings_dialog/REQ-6`, `plan-settings_dialog/REQ-7`, `plan-settings_dialog/REQ-8`, `plan-settings_dialog/REQ-10`, `plan-settings_dialog/REQ-11`, `plan-settings_dialog/REQ-19`, `plan-settings_dialog/REQ-20`, `plan-settings_dialog/REQ-21`, `plan-settings_dialog/REQ-43`, `plan-settings_dialog/REQ-51`, `plan-settings_dialog/REQ-53`, `plan-settings_dialog/REQ-54`, `plan-settings_dialog/REQ-55`, `plan-settings_dialog/REQ-56`, `plan-settings_dialog/REQ-59`
- `plan-dark_blue_theme/REQ-3`, `plan-dark_blue_theme/REQ-4`, `plan-dark_blue_theme/REQ-47`

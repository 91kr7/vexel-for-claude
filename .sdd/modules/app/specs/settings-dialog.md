---
module: app
component: SettingsDialog
type: UI component
---

# SettingsDialog

**Purpose** → the modal "Settings" popup. A tab list shows one section at a time: "Theme", "Window Look", then "Shortcuts".

## Contract

Props:
- `initialTab` → `theme` (default), `look` or `shortcuts`: the tab shown on open.
- `onClose()` → called by "Close", "[Esc]" and the Esc key.
- `themeStore`, `lookStore` → optional stores passed to the sections. Default: the page stores.

Description:
- a Dialog titled "Settings", with no primary action: the footer has "Close" only. The frame has the class `settings-dialog`.

Shows:
- a tab list named "Settings sections" with the tabs "Theme", "Window Look" and "Shortcuts", in this order. The shown tab has `aria-selected="true"`, an accent line under it and bold text.
- under it, one tab panel, labelled by its tab: ThemeSection for "Theme", LookSection for "Window Look", ShortcutsSection for "Shortcuts". The other panels are hidden.
- the colours and the look follow the active theme and look, as every Dialog. A change made in a section restyles the popup at once.

Actions:
- click on a tab → that tab and its section show.

Keyboard:
- on open → the focus is on the shown tab.
- the tab list is one Tab stop: the shown tab. Right and Left arrows → the next or previous tab, wrapping; Home and End → the first or last tab. The new tab shows and takes the focus.
- Tab and Shift+Tab → "[Esc]", the shown tab, the focusable items of the section (the checked radio; or "Restore All", the "Shortcut List" region and the row buttons) and "Close", inside the dialog only (Dialog).
- Esc → `onClose()`. Enter adds nothing (no primary action).
- on close → the focus goes back where it was before the popup opened (Dialog).

## Rules and invariants

- the popup has `aria-modal="true"`, so useShortcutKeys runs no shortcut while it is open, Alt+S included.
- the popup sends nothing to the server and changes no session.
- every change applies at once: there is no "Save" and no "Cancel".

## Dependencies

- Dialog, ThemeSection, LookSection, ShortcutsSection, ThemeStore, LookStore, useShortcutKeys (reads `aria-modal`), ThemeTokens, Windows11Look

## Requirements served

- `plan-settings_dialog/REQ-5`, `plan-settings_dialog/REQ-6`, `plan-settings_dialog/REQ-7`, `plan-settings_dialog/REQ-8`, `plan-settings_dialog/REQ-10`, `plan-settings_dialog/REQ-11`, `plan-settings_dialog/REQ-19`, `plan-settings_dialog/REQ-20`, `plan-settings_dialog/REQ-21`

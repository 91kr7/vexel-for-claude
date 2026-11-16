---
module: app
component: SettingsButton
type: UI component
---

# SettingsButton

**Purpose** → the gear icon button at the bottom of the NavigationRail that opens the settings popup.

## Contract

Props:
- `onOpen()` → called by a click, Enter or Space.

Shows:
- one button with the look of the rail buttons (`.vx-rail-btn`), as "Resume": 34 × 34 px, 8 px radius, the gear icon at 17 px in `--text-secondary`, never the active style. Hover → `--bg-surface-3` and `--text-primary`.
- accessible name "Settings", `aria-haspopup="dialog"`.
- the rail tooltip "Settings" on hover, as the other rail buttons. Hidden from assistive technology. No shortcut yet.
- keyboard focus → the focus ring of the page.

## Rules and invariants

- The icon and the tooltip are decorative: they add nothing to the accessible name.
- The button keeps the focus after a click, so a dialog that closes can give it back.

## Dependencies

- IconSet (`SettingsIcon`), NavigationRail (rail button and tooltip look), ThemeTokens, WebEntry, Windows11Look

## Requirements served

- `plan-settings_dialog/REQ-1`, `plan-settings_dialog/REQ-3`, `plan-settings_dialog/REQ-4`

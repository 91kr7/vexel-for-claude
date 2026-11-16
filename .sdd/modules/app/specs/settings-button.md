---
module: app
component: SettingsButton
type: UI component
---

# SettingsButton

**Purpose** → the gear icon button at the bottom left of the list panel that opens the settings popup.

## Contract

Props:
- `onOpen()` → called by a click, Enter or Space.

Shows:
- one button with the look of the other icon buttons of the page: 32 × 32 px, 8 px radius, `.vx-surface-1`, the gear icon at 16 px in `--text-secondary`. Hover → `--bg-surface-3`, `--border-strong` border, `--text-primary` icon.
- accessible name "Settings", tooltip (`title`) "Settings", `aria-haspopup="dialog"`.
- keyboard focus → the focus ring of the page.

## Rules and invariants

- The icon is decorative: it adds nothing to the accessible name.
- The button keeps the focus after a click, so a dialog that closes can give it back.

## Dependencies

- IconSet (`SettingsIcon`), ThemeTokens, WebEntry, Windows11Look

## Requirements served

- `plan-settings_dialog/REQ-1`, `plan-settings_dialog/REQ-3`, `plan-settings_dialog/REQ-4`

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
- the rail tooltip on hover, as the other rail buttons: "Settings" and, in brackets, the keys of the ShortcutMap row "Shortcut settings" (`commandKeysText('open-shortcut-settings')`, joined by " / "), e.g. "Settings (Alt+S)". It follows the active keys: a change of them shows at once. Hidden from assistive technology.
- keyboard focus → the focus ring of the page.

## Rules and invariants

- The icon and the tooltip are decorative: they add nothing to the accessible name.
- No key is written in the button itself: the tooltip keys come from the ShortcutMap.
- The button keeps the focus after a click, so a dialog that closes can give it back.

## Dependencies

- IconSet (`SettingsIcon`), ShortcutMap, UserShortcutKeys, NavigationRail (rail button and tooltip look), ThemeTokens, WebEntry, Windows11Look

## Requirements served

- `plan-settings_dialog/REQ-1`, `plan-settings_dialog/REQ-3`, `plan-settings_dialog/REQ-4`, `plan-settings_dialog/REQ-38`

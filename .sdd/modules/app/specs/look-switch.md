---
module: app
component: LookSwitch
type: UI component
---

# LookSwitch

**Purpose** → the top-bar icon button that shows the active look and toggles between the current look and the Windows 11 look.

## Contract

Props:
- `store` → optional LookStore. Default: the page store (`pageLookStore()`).

Shows:
- one button with the look of the ThemeSwitch: 32 × 32 px, `.vx-surface-1`, the icon at 16 px in `--text-secondary`, hover on surface 3.
- current look → a window with three dots (`MacWindowIcon`). Windows 11 look → four squares (`WindowsLogoIcon`).
- accessible name and tooltip "Windows 11 look". `aria-pressed="true"` in the Windows 11 look, `"false"` in the current look.

Actions:
- click, Enter or Space → `store.toggle()`. The icon and `aria-pressed` follow the new look.

Keyboard:
- a button in the Tab order. Focus from the keyboard shows the focus ring of the page.

## Rules and invariants

- The icons are decorative. The name stays "Windows 11 look" in both looks.

## Dependencies

- LookStore (`useLook`), IconSet (`MacWindowIcon`, `WindowsLogoIcon`), ThemeSwitch (shared button class)

## Requirements served

- `plan-wsl_support/REQ-18`, `plan-wsl_support/REQ-19`, `plan-wsl_support/REQ-39`

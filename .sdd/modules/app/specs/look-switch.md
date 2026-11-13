---
module: app
component: LookSwitch
type: UI component
---

# LookSwitch

**Purpose** → the icon button of the top bar that toggles between the Vexel look and the Windows 11 look.

## Contract

Props:
- `store` → optional LookStore. Default: the page store (`pageLookStore()`).

Shows:
- one button with the same look as the ThemeSwitch: 32 × 32 px, `.vx-surface-1`, the icon at 16 px in `--text-secondary`, hover on surface 3.
- Vexel look → a window with three dots (`MacWindowIcon`). Windows 11 look → four squares (`WindowsLogoIcon`).
- accessible name and tooltip "Windows 11 look", with `aria-pressed="true"` in the Windows 11 look and `"false"` in the Vexel look.

Actions:
- click, Enter or Space → `store.toggle()`. The icon and `aria-pressed` follow the new look.

## Rules and invariants

- The icons are decorative. The name stays "Windows 11 look" in both looks.

## Dependencies

- LookStore (`useLook`), IconSet (`MacWindowIcon`, `WindowsLogoIcon`), ThemeSwitch (shared button class)

## Requirements served

- None: added outside the spec-driven workflow (branch `feature/wsl-support`), with no analysis or plan.

---
module: app
component: PlanUsageButton
type: UI component
---

# PlanUsageButton

**Purpose** → the gauge icon button of the top bar that opens and closes the PlanUsagePopover. It has the shared look of the top-bar icon buttons (class `theme-switch`).

## Contract

Props:
- `open` → the PlanUsagePopover is open.
- `onToggle()` → called by a press.

Shows:
- one button with the gauge icon, 32 × 32 px, 8 px radius, `.vx-surface-1`, the icon at 16 px in `--text-secondary`; hover on `--bg-surface-3` with `--border-strong` and `--text-primary`; the focus ring of the page, drawn inside the button edge so the 38 px top bar never cuts it.
- accessible name "Plan Usage", tooltip (`title`) "Plan Usage".
- `aria-haspopup="dialog"`, and `aria-expanded` is `open`.
- desktop window → `no-drag`, as every control of the TopBar.

Actions:
- click, Enter or Space → `onToggle()`.
- Esc while `open` → `onToggle()`, which closes the popover.
- a mouse press does not take the focus: the focus stays where it was, the terminal included.

## Rules and invariants

- The icon is decorative: the name stays "Plan Usage".
- It has no keyboard shortcut: the spec asks for none.

## Dependencies

- IconSet (`GaugeIcon`), ThemeTokens

## Requirements served

- `plan-usage_limits/REQ-1`, `plan-usage_limits/REQ-2`, `plan-usage_limits/REQ-15`, `plan-usage_limits/REQ-16`
- `plan-dark_blue_theme/REQ-4`

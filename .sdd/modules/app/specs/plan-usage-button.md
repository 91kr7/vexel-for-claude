---
module: app
component: PlanUsageButton
type: UI component
---

# PlanUsageButton

**Purpose** → the gauge icon button of the top bar that opens and closes the PlanUsagePopover. It has the look of the ThemeSwitch.

## Contract

Props:
- `open` → the PlanUsagePopover is open.
- `onToggle()` → called by a press.

Shows:
- one button with the gauge icon, with the size, look, hover and focus ring of the ThemeSwitch.
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

- IconSet (`GaugeIcon`), ThemeSwitch (look), ThemeTokens

## Requirements served

- `plan-usage_limits/REQ-1`, `plan-usage_limits/REQ-2`, `plan-usage_limits/REQ-15`, `plan-usage_limits/REQ-16`

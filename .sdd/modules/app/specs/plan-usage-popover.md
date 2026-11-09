---
module: app
component: PlanUsagePopover
type: UI component
---

# PlanUsagePopover

**Purpose** → the plan usage view: a panel under the PlanUsageButton with the plan limits or the reason they are missing. It is not a modal dialog.

## Contract

Props:
- `state` → the PlanUsageState.
- `onClose()` → called by the close button and by Esc.

Description:
- a `role="dialog"` panel named "Plan Usage", without `aria-modal`, in the `.vx-surface-1` look, fixed under the top bar at the right (320 px wide), above the page and below the backdrop of any dialog. A header with the title "Plan Usage" and a close button "Close" (X icon).
- it has no mock: it follows the look of the existing panels.

Shows, by `state`:
- `loading` → the ProgressIndicator "Loading…".
- `ready` → one PlanLimitRow per limit, in the given order.
- `unavailable` → "Plan usage is not available", no row and no "0%".
- `stale` → "Could not refresh the plan usage" and "Last read at HH:MM", no figures.

Actions:
- close button → `onClose()`.
- Esc with the focus inside the panel → `onClose()`.

## Rules and invariants

- Opening it takes no focus and moves no scroll.
- It does not trap the focus, and a click outside does not close it: a click in the terminal keeps working.
- It is not `aria-modal`, so the shortcuts of the page keep working while it is open.
- Every text is English.

## Dependencies

- PlanLimitRow, reset time format, ProgressIndicator, IconSet (`XIcon`), PlanUsageStore (state type)

## Requirements served

- `plan-usage_limits/REQ-3`, `plan-usage_limits/REQ-4`, `plan-usage_limits/REQ-5`, `plan-usage_limits/REQ-6`, `plan-usage_limits/REQ-7`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-14`, `plan-usage_limits/REQ-15`, `plan-usage_limits/REQ-16`, `plan-usage_limits/REQ-17`

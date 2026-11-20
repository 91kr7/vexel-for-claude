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
- a `role="dialog"` panel named "Plan Usage", without `aria-modal`, on the popup glass (`.vx-popup-glass` of WebEntry), with a 1 px `--role-border-strong` border, `--radius-frame` corners, the top line and `--shadow-frame`, fixed under the top bar at the right (320 px wide), above the page and below the backdrop of any dialog. A header with the title "Plan Usage" and a close button "Close" (X icon).
- it has no mock: it follows the look of the existing panels.

Shows, by `state`:
- `loading` → the ProgressIndicator "Loading…".
- `ready` → one PlanLimitRow per limit, in the given order.
- `unavailable` → "Plan usage is not available", no row and no "0%".

Actions:
- close button → `onClose()`.
- Esc with the focus inside the panel → `onClose()`.

Motion (MotionTokens):
- on open → it hangs under its title-bar button, so it drops a few pixels from that corner and grows from 96 % on the spring curve while it fades in. The close button and Esc work from the first frame of the effect.
- leaving (`useLeaving()` of ExitPresence is `true`) → the reverse: it lifts back toward its button while it fades out. The leaving panel:
  - takes no pointer input: clicks reach the page below;
  - ignores Esc and its close button does nothing;
  - is hidden from assistive technologies (`aria-hidden`).
- reduced motion → no slide and no fade: it appears and goes at once.

## Rules and invariants

- Opening it takes no focus and moves no scroll.
- It does not trap the focus, and a click outside does not close it: a click in the terminal keeps working.
- It is not `aria-modal`, so the shortcuts of the page keep working while it is open.
- Every text is English.

## Dependencies

- PlanLimitRow, reset time format, ProgressIndicator, IconSet (`XIcon`), PlanUsageStore (state type)
- MotionTokens, ExitPresence (`useLeaving`)

## Requirements served

- `plan-usage_limits/REQ-3`, `plan-usage_limits/REQ-4`, `plan-usage_limits/REQ-5`, `plan-usage_limits/REQ-6`, `plan-usage_limits/REQ-7`, `plan-usage_limits/REQ-13`, `plan-usage_limits/REQ-15`, `plan-usage_limits/REQ-16`, `plan-usage_limits/REQ-17`
- `plan-dark_blue_theme/REQ-3`
- `plan-ui_transitions/REQ-3`, `plan-ui_transitions/REQ-4`, `plan-ui_transitions/REQ-26`, `plan-ui_transitions/REQ-27`
- `plan-popup_glass/REQ-1`, `plan-popup_glass/REQ-2`, `plan-popup_glass/REQ-10`

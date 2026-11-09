---
module: app
component: PlanLimitRow
type: UI component
---

# PlanLimitRow

**Purpose** → one plan limit in the view: label, percentage as a number and as a bar, reset time.

## Contract

Props:
- `limit` → `{ label, percent, resetsAt }`.
- `nowMs` → the time the remaining time is counted from (the time of the read).

Shows:
- an `li` with, from top:
  - the label on the left, the whole percentage on the right as a number, e.g. "75%".
  - a bar, `role="progressbar"` named by the label, `aria-valuemin` 0, `aria-valuemax` 100, `aria-valuenow` the percentage cut to 0..100. The fill is as wide as that value.
  - "Resets in <remaining> · <date and time>", e.g. "Resets in 2h 15m · Mon 14 Nov, 18:30" (reset time format). No line when `resetsAt` is `null` or not a date.
- the level is `usageLevelOf(percent)` (module sessions): normal, warning from 70, error from 90. Number and fill take the normal colour, the amber of warning, the rose of error. The levels apply to the rounded value.
- readable in the light and in the dark theme: the colours are theme tokens.

## Rules and invariants

- A percentage above 100 shows as it is, with a full bar.

## Dependencies

- reset time format, usageLevelOf (module sessions), ThemeTokens

## Requirements served

- `plan-usage_limits/REQ-5`, `plan-usage_limits/REQ-6`, `plan-usage_limits/REQ-7`, `plan-usage_limits/REQ-8`, `plan-usage_limits/REQ-9`, `plan-usage_limits/REQ-10`, `plan-usage_limits/REQ-15`, `plan-usage_limits/REQ-16`

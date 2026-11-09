---
module: app
component: reset-time format
type: frontend function
---

# Reset time format

**Purpose** → the texts of a reset time in the plan usage view.

## Contract

- `remainingText(resetsAt, nowMs) → string`, the time until `resetsAt` (ISO text), cut down to the unit:
  - under 1 minute, in the past, or not a date → "<1m"
  - under 1 hour → "45m"
  - under 1 day → "2h 15m"
  - 1 day or more → "3d 4h"
- `resetDateText(resetsAt) → string` → local weekday, day and month, then the 24-hour time, e.g. "Mon 14 Nov, 18:30".
- `lastReadText(readAtMs) → string` → local 24-hour time "HH:MM".
- `isValidResetTime(resetsAt) → boolean` → `true` when the text is a date.

## Rules and invariants

- English names of days and months, whatever the browser language.

## Requirements served

- `plan-usage_limits/REQ-9`, `plan-usage_limits/REQ-14`

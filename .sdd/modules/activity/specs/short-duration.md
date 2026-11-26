---
module: activity
component: shortDuration
type: frontend function
---

# shortDuration

**Purpose** → the short text of a duration, used by every duration of the live activity.

## Contract

- `shortDuration(ms) → string`

```
ms negative or not a finite number → counts as 0
s = whole seconds, rounded down
s < 60          → "<s> s"                     e.g. "0 s", "42 s"
minutes < 60    → "<minutes> min"             e.g. "3 min", "59 min"
else            → "<hours> h <MM> min"        MM = the minutes left, on two digits, e.g. "1 h 05 min", "16 h 00 min"
```

## Requirements served

- `plan-session_activity/REQ-15`

---
module: activity
component: ElapsedTime
type: UI component
---

# ElapsedTime

**Purpose** → the time since a moment, in the short form, counting up.

## Contract

Props:
- `since` → an ISO-8601 time.
- `className` → optional classes for the element.

Shows:
- a `<time>` element with `dateTime` = `since` and the text `shortDuration(now - since)`.
- `since` not a valid time → nothing.

## Rules and invariants

- One timer of the page refreshes every shown ElapsedTime once per second, all at the same moment. It runs only while one is shown.
- A time after now shows "0 s".
- A new `since` shows its new text at once.

## Dependencies

- shortDuration

## Requirements served

- `plan-session_activity/REQ-8`, `plan-session_activity/REQ-9`

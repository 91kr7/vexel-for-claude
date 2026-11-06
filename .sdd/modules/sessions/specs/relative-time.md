---
module: sessions
component: RelativeTime
type: UI component
---

# RelativeTime

**Purpose** → the time of the last activity of a session, as short English text relative to now.

## Contract

Props:
- `iso` → an ISO-8601 time.
- `className` → optional classes for the element.

Shows:
- a `<time>` element with `dateTime` = `iso` and the text `formatRelativeTime(iso, now)`.

Function:
- `formatRelativeTime(iso, now) → string`:

  ```
  iso not a valid time            → ""
  now - iso < 60 s (future too)   → "Just now"
  now - iso < 60 min              → "Nm ago"     N = whole minutes elapsed, 1..59
  same local day as now           → "HH:MM"      local time, 24 h, two digits each
  earlier day                     → "DD/MM/YYYY" local date, two digits for day and month
  ```

## Rules and invariants

- The text refreshes every 30 s while the element is shown, with no new data.
- A new `iso` shows its new text at once.

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-19`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-7`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-8`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-13`

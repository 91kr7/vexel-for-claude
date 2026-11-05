---
module: sessions
component: ProgressBar
type: UI component
---

# ProgressBar

**Purpose** → the thin indeterminate bar that shows a session at work.

## Contract

Props: none.

Shows:
- a decorative element (`aria-hidden="true"`) with the class `progress-bar`: a track 4 px high, full width, radius 2 px, in emerald-500 at 15 %.
- inside it, an indicator 45 % wide, 4 px high, radius 2 px, in emerald-400, that slides across the track again and again.
- with "reduce motion" set in the system, the indicator stays still at the start of the track.

## Rules and invariants

- It does not carry the state: the state text next to it does.

## Dependencies

- ThemeTokens (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-21`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-28`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-26`

---
module: activity
component: TurnPanelButton
type: UI component
---

# TurnPanelButton

**Purpose** → the session header icon button that opens and closes the Subagents panel (TurnPanel).

## Contract

Props:
- `open` → whether the Subagents panel is open.
- `onToggle()` → called on each click.

Shows:
- always, for every session → a 26 px icon button with the `list-tree` icon, as GitExplorerButton: accessible name "Subagents", tooltip "Subagents", the global focus ring on keyboard focus.
- `aria-expanded` follows `open`. While open, the button has the surface 3 background and the accent colour.

Actions:
- click, or Enter or Space on the focused button → `onToggle()`.

## Dependencies

- IconSet (module app)

## Requirements served

- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-47`
- `plan-subagent_panel/REQ-21`

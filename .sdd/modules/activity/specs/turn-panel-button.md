---
module: activity
component: TurnPanelButton
type: UI component
---

# TurnPanelButton

**Purpose** → the session header icon button that opens and closes the turn panel.

## Contract

Props:
- `open` → whether the turn panel is open.
- `onToggle()` → called on each click.

Shows:
- always, for every session → a 26 px icon button with the `list-tree` icon, as GitExplorerButton: accessible name "Turn Panel", tooltip "Turn Panel", the global focus ring on keyboard focus.
- `aria-expanded` follows `open`. While open, the button has the surface 3 background and the accent colour.

Actions:
- click, or Enter or Space on the focused button → `onToggle()`.

## Dependencies

- IconSet (module app)

## Requirements served

- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-47`

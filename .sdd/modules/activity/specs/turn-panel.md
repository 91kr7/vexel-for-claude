---
module: activity
component: TurnPanel
type: UI component
---

# TurnPanel

**Purpose** → the turn panel of a session: a panel at the right of the session content with the tree of the current turn.

## Contract

Description:
- a region named "Turn Panel" (`section` with `aria-label`), with the look, size and place of the GitExplorerPanel: `--role-list`, a 1 px `--role-border-subtle` left border, 50 % of the width of the session content and at least 360 px, the full height between the session header and the footer.

Props:
- `sessionId` → the hosted or external session. The panel reads its tree with `useTurn(sessionId)`.

Shows:
- a 40 px header → the title "Current Turn" (12/16 px, weight 600); after it, while a turn exists, the status chip: "Running" (emerald, with the pulsing dot) for status `running`, "Ended" (grey) for `ended`.
- below the header, filling the rest of the height:
  - `loading` → a compact AreaState `loading` "Loading…".
  - `unavailable` → a compact AreaState `error` "Turn not available.".
  - a tree with status `none` → a compact AreaState `empty` "No turn yet.".
  - else → the TurnTreeView of the tree. A tree with another `number` (a new turn) starts a new TurnTreeView.

Motion (MotionTokens), as the GitExplorerPanel:
- on open → it slides in from the right edge of the session content, which shrinks with it.
- leaving (`useLeaving()` of ExitPresence is `true`) → it slides out to the right edge. The leaving panel takes no pointer input and is hidden from assistive technologies (`aria-hidden`).
- reduced motion → no slide.

## Rules and invariants

- Each mount opens a new socket: nothing is kept from a previous opening of the panel.
- It works the same in the browser page and in the desktop window.

## Dependencies

- useTurn, TurnTreeView
- StateBadge (module sessions)
- AreaState, ExitPresence (`useLeaving`), MotionTokens, ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-28`, `plan-session_activity/REQ-40`, `plan-session_activity/REQ-41`, `plan-session_activity/REQ-47`, `plan-session_activity/REQ-48`

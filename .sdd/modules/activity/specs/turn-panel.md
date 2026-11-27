---
module: activity
component: TurnPanel
type: UI component
---

# TurnPanel

**Purpose** → the turn panel of a session: a panel at the right of the session content with the tree of the current turn, and the conversation of one subagent in place of the tree.

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

Subagent conversation:
- a card of the tree opens (SubagentCard `onOpen`) → the SubagentConversation of that subagent covers the area below the header. The tree stays in the page, hidden: its scroll place and its follow state are kept. The header stays.
- the bar of the conversation shows the subagent as it is in the current tree. When the subagent leaves the tree (a new turn), the bar keeps the last values seen.
- the conversation stays open when its subagent ends or a new turn starts.
- "Back" or Esc → the conversation closes and the tree shows again, at the same scroll place. The focus goes to the button of the card that opened it. When that button is no longer in the page, the focus goes to the tree area.

Motion (MotionTokens), as the GitExplorerPanel:
- on open → it slides in from the right edge of the session content, which shrinks with it.
- leaving (`useLeaving()` of ExitPresence is `true`) → it slides out to the right edge. The leaving panel takes no pointer input and is hidden from assistive technologies (`aria-hidden`).
- reduced motion → no slide.

## Rules and invariants

- Each mount opens a new socket: nothing is kept from a previous opening of the panel. A new mount shows the tree, with no conversation open.
- The session view around the panel does not change when a conversation opens or closes.
- It works the same in the browser page and in the desktop window.

## Dependencies

- useTurn, TurnTreeView, SubagentConversation
- StateBadge (module sessions)
- AreaState, ExitPresence (`useLeaving`), MotionTokens, ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-27`, `plan-session_activity/REQ-28`, `plan-session_activity/REQ-40`, `plan-session_activity/REQ-41`, `plan-session_activity/REQ-47`, `plan-session_activity/REQ-48`
- `plan-session_activity/REQ-49`, `plan-session_activity/REQ-53`, `plan-session_activity/REQ-54`, `plan-session_activity/REQ-55`
- `plan-subagent_panel/REQ-6`, `plan-subagent_panel/REQ-7`

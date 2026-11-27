---
module: activity
component: useTurn
type: frontend hook
---

# useTurn

**Purpose** → the page side of TurnRoute: the tree of the running subagents of the open session, kept current.

## Contract

- `useTurn(sessionId) → TurnState`
  - `TurnState` → `{ status: "loading" }`, `{ status: "unavailable" }` or `{ status: "loaded", turn }`.
  - `turn` → the `TurnTree` of TurnRoute: `{ number, groups, subagents }`. `groups` is a list of groups. A group is `{ subagents }`.
- mount, or a new `sessionId` → `loading`, and one socket to `/api/sessions/<id>/turn` (id URL-encoded, `ws:` or `wss:` as the page).
- a frame `{ type: "turn" }` → `loaded` with that tree. It replaces the tree, also on a new socket.
- a frame `{ type: "update" }` after the first frame of its socket → the tree with the update applied:
  - `groups` → replaces its value.
  - each subagent of `subagents` → replaces the subagent with the same id, or is added.
  - then a subagent that no group reaches, from `groups` down through the `groups` of the subagents, leaves `subagents`. So `subagents` holds only the subagents of the tree.
- an `update` before the first frame of its socket, or a frame that is not valid JSON or of another type → ignored.

Reconnection (as ConversationView):
- the socket closes before any frame of the hook → `unavailable`, and no new socket.
- the socket closes after a first frame, not by unmount → a new socket 2 s later, and again every 2 s while the attempts fail. The tree stays shown meanwhile.
- an attempt closed with `4404` → no more attempts.

## Rules and invariants

- One socket open at a time. Unmount closes it and ends the attempts.
- It sends nothing on the socket.

## Dependencies

- TurnRoute

## Requirements served

- `plan-session_activity/REQ-43`
- `plan-subagent_panel/REQ-1`, `plan-subagent_panel/REQ-10`
- `plan-subagent_panel/REQ-15`, `plan-subagent_panel/REQ-16`, `plan-subagent_panel/REQ-22`

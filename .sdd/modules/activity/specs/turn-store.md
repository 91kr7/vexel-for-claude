---
module: activity
component: useTurn
type: frontend hook
---

# useTurn

**Purpose** → the page side of TurnRoute: the turn tree of the open session, kept current.

## Contract

- `useTurn(sessionId) → TurnState`
  - `TurnState` → `{ status: "loading" }`, `{ status: "unavailable" }` or `{ status: "loaded", turn }`.
  - `turn` → the `TurnTree` of TurnRoute: `{ number, status, steps, groups, earlier, subagents }`.
- mount, or a new `sessionId` → `loading`, and one socket to `/api/sessions/<id>/turn` (id URL-encoded, `ws:` or `wss:` as the page).
- a frame `{ type: "turn" }` → `loaded` with that tree. It replaces the tree, also on a new socket.
- a frame `{ type: "update" }` after the first frame of its socket → the tree with the update applied:
  - `status`, `groups`, `earlier` → replace their value.
  - each `{ index, step }` of `steps` → the step at that index, new or replaced.
  - each subagent of `subagents` → replaces the subagent with the same id, or is added.
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

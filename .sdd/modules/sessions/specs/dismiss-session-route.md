---
module: sessions
component: DismissSessionRoute
type: REST endpoint
---

# DismissSessionRoute

**Purpose** → removes an ended hosted session from the session list.

## Contract

- `registerDismissSessionRoute(app, tracker)` → `tracker` is the SessionStateTracker.
- `POST /api/sessions/:id/dismiss` → no body.
  - `204` → the session was ended and SessionStateTracker `dismiss(id)` removed it. Empty body.
  - `404` → the tracker has no session `:id`. Body: `{ error: "session_not_found" }`.
  - `409` → the session has not ended. Body: `{ error: "not_ended" }`.

## Rules and invariants

- On `404` and `409` nothing changes.
- After `204`, `GET /api/sessions` no longer lists the session, also after a page reload. SessionEventsRoute sends `{ "type": "session-removed", "id" }`.
- It touches no Claude Code file: the session stays in SessionHistory and can be resumed from there.

## Dependencies

- SessionStateTracker

## Requirements served

- `plan-session_list_improvements/REQ-3`, `plan-session_list_improvements/REQ-4`, `plan-session_list_improvements/REQ-5`, `plan-session_list_improvements/REQ-6`

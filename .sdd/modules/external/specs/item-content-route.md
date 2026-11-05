---
module: external
component: ItemContentRoute
type: REST endpoint
---

# ItemContentRoute

**Purpose** → gives the page the full content of one tool call or tool result of an external session, when the user expands it.

## Contract

- `registerItemContentRoute(app, deps)`
  - `deps.scanner` → ExternalSessionScanner (`get`).
  - `deps.reader` → TranscriptReader (`locate`, `readItem`).
- `GET /api/external-sessions/:id/items?offset=<n>&block=<n>` → the full content of the item with the reference `{ offset, block }` (see TranscriptReader).
  - `offset` or `block` missing, repeated, or not a non-negative integer → `400`, body `{ error: "invalid_reference" }`.
  - no transcript for `:id` → `404`, body `{ error: "session_not_found" }`.
  - the reference does not point to a tool call or a tool result → `404`, body `{ error: "item_not_found" }`.
  - otherwise → `200`, body `{ text }` with the text of TranscriptReader `readItem`.
- the transcript is searched with the folder of the scanner entry `:id`. When the entry is gone (the session ended), it is searched in any project folder.

## Rules and invariants

- Read-only: it writes nothing to the session, its process or its files.
- LocalAccessGuard covers it, like every route of the Server.

## Dependencies

- ExternalSessionScanner, TranscriptReader

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-21`

---
module: activity
component: SubagentItemContentRoute
type: REST endpoint
---

# SubagentItemContentRoute

**Purpose** → gives the page the full content of one tool call or tool result of a subagent, when the user opens its tool card.

## Contract

- `registerSubagentItemContentRoute(app, deps)`
  - `deps.tracker`, `deps.scanner` → as locateSubagentFile.
  - `deps.reader` → TranscriptReader (`locate`, `readItem`).
- `GET /api/sessions/:id/subagents/:agentId/items?offset=<n>&block=<n>` → the full content of the item of the subagent file with the reference `{ offset, block }`.
  - `offset` or `block` missing, repeated, or not a non-negative integer → `400`, body `{ error: "invalid_reference" }`.
  - locateSubagentFile gives no file → `404`, body `{ error: "session_not_found" }`.
  - the reference does not point to a tool call or a tool result → `404`, body `{ error: "item_not_found" }`.
  - otherwise → `200`, body `{ text }` with the text of TranscriptReader `readItem` with the option `sidechain: true`.

## Rules and invariants

- Read-only: it writes nothing to the session, its process or its files.
- LocalAccessGuard covers it, as every route.

## Dependencies

- locateSubagentFile
- TranscriptReader (module external)

## Requirements served

- `plan-session_activity/REQ-50`

---
module: activity
component: SubagentConversationRoute
type: REST endpoint (WebSocket)
---

# SubagentConversationRoute

**Purpose** → streams the conversation of one subagent to the page, live and read-only.

## Contract

- `registerSubagentConversationRoute(app, deps)`
  - `deps.tracker`, `deps.scanner` → as locateSubagentFile.
  - `deps.reader` → TranscriptReader (`locate`, `readFrom`).
  - `deps.pollIntervalMs` → time between two checks of the subagent file. Default: 1000.
- `GET /api/sessions/:id/subagents/:agentId/conversation` → WebSocket.
  - `:id` → a hosted or an external session id. `:agentId` → the subagent id of the turn tree.
  - locateSubagentFile gives no file → the server closes the socket with code `4404` (reason `subagent_not_found`). It sends nothing.
  - otherwise, first frame: `{ "type": "items", "items": [...] }` with every item of the subagent file at connect time, by TranscriptReader `readFrom` with the option `sidechain: true`. So the task of the subagent is the first user item.
  - then, every `pollIntervalMs`: when the file grew, one frame `{ "type": "items", "items": [...] }` with the items of the new complete lines only. No frame when nothing new has items.
  - each `tool_call` and `tool_result` item carries its `ref` in the subagent file.
  - client → server: frames are ignored.

## Rules and invariants

- Each item reaches the page once, in file order.
- The checks go on after the subagent or its session ends, until the socket closes. Closing the socket stops them.
- It opens files read-only. It writes nothing to the session, its process or its files.
- LocalAccessGuard covers it, as every route.

## Dependencies

- locateSubagentFile
- TranscriptReader (module external)

## Requirements served

- `plan-session_activity/REQ-49`, `plan-session_activity/REQ-51`, `plan-session_activity/REQ-52`

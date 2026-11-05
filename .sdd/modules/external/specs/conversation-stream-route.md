---
module: external
component: ConversationStreamRoute
type: REST endpoint (WebSocket)
---

# ConversationStreamRoute

**Purpose** → streams the conversation of an external session to the page, live and read-only.

## Contract

- `registerConversationStreamRoute(app, deps)`
  - `deps.scanner` → ExternalSessionScanner (`get`).
  - `deps.reader` → TranscriptReader.
  - `deps.pollIntervalMs` → time between two checks of the transcript. Default: 1000.
- `GET /api/external-sessions/:id/conversation` → WebSocket.
  - `:id` is not a current entry of the scanner → the server closes the socket with code `4404`. It sends nothing.
  - otherwise, first frame: `{ "type": "items", "items": [...] }` with every item of the transcript at connect time. The array is empty when there is no transcript yet.
  - then, every `pollIntervalMs`: when the transcript grew, one frame `{ "type": "items", "items": [...] }` with the items of the new complete lines only. No frame when nothing new has items.
  - the transcript is looked up again at each check until it exists (a new session writes it at its first message).
  - client → server: frames are ignored.

## Rules and invariants

- Each item reaches the page once, in transcript order.
- The checks go on after the external session ends, until the socket closes. Closing the socket stops them.
- It writes nothing to the session, its process or its files.

## Dependencies

- ExternalSessionScanner, TranscriptReader

## Requirements served

- `plan-claude_sessions_client/REQ-33`, `plan-claude_sessions_client/REQ-34`, `plan-claude_sessions_client/REQ-36`

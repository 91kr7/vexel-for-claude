---
module: desktop
component: RemoteRule
type: backend service
---

# RemoteRule

**Purpose** → counts 60 seconds for each session that enters "needs input", and says when to send its remote notification.

## Contract

- `REMOTE_DELAY_MS` → 60,000.
- `RemoteSend` → `{ event, receivedAt }`: the `needs_input` AttentionEvent and the `now()` time when the rule got it.
- `new RemoteRule({ onSend, now?, setTimer?, clearTimer? })`
  - `onSend(send)` → called on "send".
  - `now()` → the current time in milliseconds. Default `Date.now`.
  - `setTimer(callback, ms) → timer`, `clearTimer(timer)` → default `setTimeout` and `clearTimeout`.
- `receiveEvent(event)`:

  ```
  event.kind is not needs_input  → nothing
  event.id received before       → nothing
  else → stop the count of event.sessionId, if any
         start a new REMOTE_DELAY_MS count for that session, with this event
  ```

- `receiveNeedsInput(sessions)` → stops the count of each session that is not in `sessions`.
- end of a count → `onSend({ event, receivedAt })` once, and the count is gone.

## Rules and invariants

- At most one count per session. Each session has its own count.
- A count gives at most one "send". The session sends again only after a new `needs_input` event.
- `turn_end` and `session_end` events start and stop nothing.
- A needs-input list alone never starts a count: a session already waiting at start sends nothing.
- It does not know the window focus or the remote settings.
- It uses no Electron API.

## Dependencies

- AttentionClient (the `AttentionEvent` and `AttentionSession` shapes)

## Requirements served

- `plan-remote_notifications/REQ-19`, `plan-remote_notifications/REQ-21`, `plan-remote_notifications/REQ-22`, `plan-remote_notifications/REQ-23`, `plan-remote_notifications/REQ-24`, `plan-remote_notifications/REQ-25`, `plan-remote_notifications/REQ-27`, `plan-remote_notifications/REQ-28`

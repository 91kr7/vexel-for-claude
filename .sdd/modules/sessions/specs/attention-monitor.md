---
module: sessions
component: AttentionMonitor
type: backend service
---

# AttentionMonitor

**Purpose** → follows the hosted and external sessions. It gives each event that notifies, and the list of the sessions that need input.

## Contract

- `new AttentionMonitor({ tracker, scanner })` → `tracker` is the SessionStateTracker, `scanner` the ExternalSessionScanner. The sessions they list at that moment count as seen. Then it follows their changes.
- `needsInput() → AttentionSession[]` → the hosted and external sessions in `needs_input`, a copy, in the order they entered that state.
- `onEvent(listener) → unsubscribe` → `listener(event)` for each event.
- `onNeedsInputChange(listener) → unsubscribe` → `listener(sessions)` with the new list, after each change of the list.

`AttentionSession` → `{ sessionId, folder, label }`.

`AttentionEvent` → `{ id, sessionId, kind, folder, label, waitingTool? }`:

- `id` → a new random UUID for each event.
- `kind` → `"needs_input"`.
- `folder`, `label` → those of the session at the time of the event.
- `waitingTool` → the `waitingTool` of the tracker summary, only when present. External sessions have none.

When a change of a session gives an event:

```
previous = the last state seen for that session (none at first sight)
state is needs_input, and previous is known and is not needs_input → one event
any other case → no event
```

## Rules and invariants

- First sight is not a transition. A session that the tracker starts to track, or that a scan adds, gives no event, also when it is in `needs_input`.
- A change that keeps `needs_input` gives no event. The tracker notifies also when the state does not change.
- A session enters the list when its state is `needs_input`, also at first sight. It leaves the list when its state becomes another one (`ended` included) or when the scanner removes it.
- The list changes when a session enters or leaves it, or when the folder or the label of a session in it changes. Nothing else calls the list listeners.
- When one change of a session changes the list and gives an event, the list listeners are called first.
- A session that the scanner removes is forgotten. If it comes back, that is a first sight.
- It keeps no history of events.

## Dependencies

- SessionStateTracker
- ExternalSessionScanner (module external)

## Requirements served

- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-2`, `plan-session_notifications/REQ-5`, `plan-session_notifications/REQ-6`, `plan-session_notifications/REQ-7`, `plan-session_notifications/REQ-8`, `plan-session_notifications/REQ-11`

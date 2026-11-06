---
module: sessions
component: AttentionMonitor
type: backend service
---

# AttentionMonitor

**Purpose** → follows the hosted and external sessions. It gives each event that notifies, and the list of the sessions that need input.

## Contract

- `new AttentionMonitor({ tracker, scanner, turns?, registry? })` → `tracker` is the SessionStateTracker, `scanner` the ExternalSessionScanner. The sessions they list at that moment count as seen. Then it follows their changes.
  - `turns` → the TurnReader. Default: a TurnReader with its defaults.
  - `registry` → the SessionRegistry. It tells how the process of a hosted session ended. Default: none, and then no session-end event.
- `needsInput() → AttentionSession[]` → the hosted and external sessions in `needs_input`, a copy, in the order they entered that state.
- `onEvent(listener) → unsubscribe` → `listener(event)` for each event.
- `onNeedsInputChange(listener) → unsubscribe` → `listener(sessions)` with the new list, after each change of the list.

`AttentionSession` → `{ sessionId, folder, label }`.

`AttentionEvent` → `{ id, sessionId, kind, folder, label, waitingTool?, excerpt?, error? }`:

- `id` → a new random UUID for each event.
- `kind` → `"needs_input"`, `"turn_end"` or `"session_end"`.
- `folder`, `label` → those of the session at the time of the state change.
- `waitingTool` → `needs_input` only. The `waitingTool` of the tracker summary, only when present. External sessions have none.
- `excerpt` → `turn_end` only. `plainExcerpt` of the final response of the turn, only when the turn has one and the excerpt is not empty.
- `error` → `session_end` only, always present. `true` when the session ended with an error, else `false`.

When a change of a session gives an event:

```
previous = the last state seen for that session (none at first sight)
state is needs_input, and previous is known and is not needs_input  → one needs_input event, at once
previous is working, state is idle:
    hosted session, and the change cause is the hook "Stop"          → turn-end check
    external session                                                 → turn-end check
hosted session, previous is known, the change cause is "exit"        → session-end check
any other case → no event
```

Turn-end check:

```
transcript = turns.lastTurn(folder, id)
    hosted: id = tracker.claudeSessionId(session id); no id known → no read, the turn has no final response
    external: id = the session id
the read fails                                       → the turn has no final response
the session changed state or was removed meanwhile   → no event
interrupted                                          → no event
else                                                 → one turn_end event
```

Session-end check, at once, on the Session of the registry with that id:

```
no registry, or no such Session                   → no event
stopRequested (Terminate, quit, server shutdown)  → no event
signal is set                                     → one session_end event, error false
exitCode is not 0                                 → one session_end event, error true
exitCode is 0 (the user's exit command)           → no event
```

## Rules and invariants

- First sight is not a transition. A session that the tracker starts to track, or that a scan adds, gives no event, also when it is in `needs_input`.
- A change that keeps `needs_input` gives no event. The tracker notifies also when the state does not change.
- A hosted session that becomes idle by user input (Esc, Ctrl+C) or by the `idle_prompt` notification gives no event.
- A turn-end event comes after the transcript read, so later than the change.
- External sessions never give a session-end event.
- A session enters the list when its state is `needs_input`, also at first sight. It leaves the list when its state becomes another one (`ended` included) or when the scanner removes it.
- The list changes when a session enters or leaves it, or when the folder or the label of a session in it changes. Nothing else calls the list listeners.
- When one change of a session changes the list and gives a `needs_input` or `session_end` event, the list listeners are called first.
- A session that the scanner removes is forgotten. If it comes back, that is a first sight.
- It keeps no history of events.

## Dependencies

- SessionStateTracker, TurnReader, plainExcerpt, SessionRegistry
- ExternalSessionScanner (module external)

## Requirements served

- `plan-session_notifications/REQ-1`, `plan-session_notifications/REQ-2`, `plan-session_notifications/REQ-5`, `plan-session_notifications/REQ-6`, `plan-session_notifications/REQ-7`, `plan-session_notifications/REQ-8`, `plan-session_notifications/REQ-11`
- `plan-session_notifications/REQ-14`, `plan-session_notifications/REQ-15`, `plan-session_notifications/REQ-16`, `plan-session_notifications/REQ-17`
- `plan-session_notifications/REQ-21`, `plan-session_notifications/REQ-22`, `plan-session_notifications/REQ-23`

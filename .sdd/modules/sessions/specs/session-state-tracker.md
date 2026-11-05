---
module: sessions
component: SessionStateTracker
type: backend service
---

# SessionStateTracker

**Purpose** → keeps state, label and last activity of every hosted session, and tells its listeners about each change.

## Contract

- `new SessionStateTracker(options?)` → `options.now` gives the current time. Default: the system clock.
- `track(session)` → `session` is `{ id, cwd, onExit(listener) }` (a registry Session fits).
  - adds the session: state `idle`, label = last segment of `cwd`, last activity = now.
  - notifies the new summary.
  - when the session process exits → state `ended`, last activity = now, notified.
- `applyHookEvent(id, event) → boolean` → `false` when the id is unknown, `true` otherwise (also when the event changes nothing).
- `applyUserInput(id, data)` → user input typed in the session (see rules).
- `get(id) → SessionSummary | undefined`.
- `list() → SessionSummary[]` → every tracked session, in start order, ended ones included.
- `onChange(listener) → unsubscribe` → `listener(summary)` after every change.

`SessionSummary` → `{ id, folder, label, state, lastActivity }`.

- `folder` → the session `cwd`.
- `state` → `working` | `needs_input` | `idle` | `ended`.
- `lastActivity` → ISO-8601 UTC string.

Hook event → state (`event.hook_event_name`):

```
UserPromptSubmit                                  → working
PreToolUse,  tool_name = "AskUserQuestion"         → needs_input
PreToolUse,  any other tool_name                   → working
PostToolUse                                       → working
PermissionRequest                                 → needs_input
Notification, notification_type permission_prompt → needs_input
Notification, notification_type elicitation_dialog → needs_input
Notification, notification_type idle_prompt       → idle
Stop                                              → idle
any other event or notification_type              → no change at all
```

## Rules and invariants

- An event that maps to a state sets that state and last activity = now, and notifies. This holds also when the state does not change.
- `idle_prompt` is only a correction. It does not touch last activity. When the session is already idle, it changes nothing and notifies nothing.
- Label: the first `UserPromptSubmit` with a non-empty `prompt` sets it. Whitespace runs become one space, the ends are trimmed, and the first 80 characters are kept. After that the label never changes.
- User input → last activity = now, notified. When `data` is exactly `\x1b` (Esc) or `\x03` (Ctrl+C) and the state is `working` or `needs_input`, the state becomes `idle`. Longer input that starts with `\x1b` (an arrow key) is not an interrupt.
- `ended` is final: later hook events and input change nothing and notify nothing.
- Sessions stay in the list until the server stops.

## Requirements served

- `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-13`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-20`

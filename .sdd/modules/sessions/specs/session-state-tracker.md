---
module: sessions
component: SessionStateTracker
type: backend service
---

# SessionStateTracker

**Purpose** → keeps state, label and last activity of every hosted session, and tells its listeners about each change and each removal.

## Contract

- `new SessionStateTracker(options?)` → `options.now` gives the current time. Default: the system clock.
- `track(session)` → `session` is `{ id, cwd, onExit(listener), resumedFrom? }` (a registry Session fits).
  - adds the session: state `idle`, label = last segment of `cwd`, last activity = now.
  - `resumedFrom` given → Claude Code session id = `resumedFrom.sessionId`. When `resumedFrom.firstUserMessage` gives a non-empty label (label rule below), that is the label and it is final.
  - notifies the new summary.
  - when the session process exits → state `ended`, last activity = now, notified.
- `applyHookEvent(id, event) → boolean` → `false` when the id is unknown, `true` otherwise (also when the event changes nothing).
- `applyUserInput(id, data)` → user input typed in the session (see rules).
- `get(id) → SessionSummary | undefined`.
- `claudeSessionId(id) → string | undefined` → the Claude Code session id of the session (rule below). `undefined` when the id is unknown or no Claude Code session id is known yet.
- `liveClaudeSessionIds() → Set<string>` → the Claude Code session ids of the tracked sessions that have not ended. A session with no known id adds nothing.
- `list() → SessionSummary[]` → every tracked session, in start order, ended ones included.
- `dismiss(id) → boolean` → removes an ended session.
  - `true` → the session was `ended`. It leaves `get`, `list` and `claudeSessionId`, and each removal listener gets its id.
  - `false` → unknown id, or a session that has not ended. Nothing changes and no listener is called.
  - it notifies no change listener. It reads and writes no Claude Code file.
- `onChange(listener) → unsubscribe` → `listener(summary, cause)` after every change.
- `onRemove(listener) → unsubscribe` → `listener(id)` after every `dismiss` that removes a session.

`ChangeCause` → what caused the change:

- `{ type: "track" }` → `track(session)`.
- `{ type: "hook", hookEventName }` → `applyHookEvent`, with the `hook_event_name` of the event.
- `{ type: "input" }` → `applyUserInput`.
- `{ type: "exit" }` → the session process exited.

`SessionSummary` → `{ id, folder, label, state, lastActivity, waitingTool?, resumable? }`.

- `folder` → the session `cwd`.
- `state` → `working` | `needs_input` | `idle` | `ended`.
- `lastActivity` → ISO-8601 UTC string.
- `waitingTool` → the tool that waits for permission. Present only in `needs_input`, and only when known (rule below).
- `resumable` → `true` when the session has a saved conversation: it was tracked with `resumedFrom.sessionId`, or it got a `UserPromptSubmit` before it ended. Otherwise the field is absent. Once set, it stays.

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
- Claude Code session id: each hook event with a non-empty string `session_id` sets it, the last one wins. This holds for every event, also one that changes no state. It notifies nothing.
- Waiting tool:

  ```
  PreToolUse with a non-empty tool_name             → remembered as the last PreToolUse tool (no notification by itself)
  PermissionRequest with a non-empty tool_name      → waitingTool = that tool_name
  Notification permission_prompt                    → waitingTool kept if already set, else the last PreToolUse tool, else none
  any other event that keeps needs_input            → waitingTool unchanged
  the state leaves needs_input (event, input, exit) → waitingTool removed
  ```

  An AskUserQuestion or an `elicitation_dialog` gives no waiting tool.
- `ended` is final: later hook events and input change nothing and notify nothing.
- Sessions stay in the list until `dismiss` removes them or the server stops. Only ended sessions can be removed.
- A removed session is unknown from then on: its hook events give `false` and its input changes nothing.

## Requirements served

- `plan-claude_sessions_client/REQ-12`, `plan-claude_sessions_client/REQ-13`, `plan-claude_sessions_client/REQ-14`, `plan-claude_sessions_client/REQ-20`, `plan-claude_sessions_client/REQ-25`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-22`
- `plan-session_notifications/REQ-14`, `plan-session_notifications/REQ-15`, `plan-session_notifications/REQ-16`
- `plan-session_list_improvements/REQ-2`, `plan-session_list_improvements/REQ-4`, `plan-session_list_improvements/REQ-5`, `plan-session_list_improvements/REQ-6`

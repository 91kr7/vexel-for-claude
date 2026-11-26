---
module: activity
component: subagentStateOf
type: backend function
---

# subagentStateOf

**Purpose** → tells whether a subagent runs, has finished or was stopped, and reads the stop notices of the main transcript.

## Contract

- `subagentStateOf({ finished?, interrupted, sessionEnded }) → "running" | "finished" | "stopped"`

```
finished is true             → "finished"
sessionEnded or interrupted  → "stopped"
anything else                → "running"
```

- `stoppedTaskIdOf(entry) → string | undefined` → for a background task notification that says the task ended without finishing, the id of that task. `entry` is one parsed line of a main transcript.

```
text = userMessageOf(entry)
text is null, or does not start with "<task-notification>"   → undefined
<status>…</status> is "killed", "stopped" or "failed"
and <task-id>…</task-id> is not empty                        → that task id, trimmed
anything else (e.g. status "completed")                      → undefined
```

## Assumptions

Checked on Claude Code 2.1.332, 2026-11-26:

- the task id of a subagent is the `<id>` of its file `agent-<id>.jsonl`. Background bash tasks have task ids too; they match no subagent file.
- "killed" → the user stopped the subagent. "stopped" → a resumed session reports a subagent that did not finish before its previous run ended.
- "completed" can be an interim report ("waiting on its own background work"). Only `finished` in the metadata tells that a subagent finished.

## Dependencies

- SessionHistory `userMessageOf` (module history)

## Requirements served

- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-3`, `plan-session_activity/REQ-11`

---
module: activity
component: locateSubagentFile
type: backend function
---

# locateSubagentFile

**Purpose** → finds the file of one subagent of a hosted or an external session, for the subagent routes.

## Contract

- `locateSubagentFile({ tracker, scanner, reader }, sessionId, agentId) → Promise<string | undefined>`
  - `tracker` → SessionStateTracker (`get`, `claudeSessionId`). `scanner` → ExternalSessionScanner (`get`). `reader` → TranscriptReader (`locate`).
  - `agentId` → the subagent id of the turn tree: its file name without `.jsonl`.

```
tracker.get(sessionId) exists → hosted: main transcript = reader.locate(its folder, tracker.claudeSessionId(sessionId))
                                no Claude Code session id → undefined
else scanner.get(sessionId) exists → external: main transcript = reader.locate(its folder, sessionId)
else → undefined
no main transcript → undefined
else → subagentFileOf(main transcript, agentId)
```

## Rules and invariants

- It reads nothing and writes nothing: it only looks for files.
- The result is always a file under the `subagents/` folder of the session's own transcript, workflow run folders included.

## Dependencies

- SessionStateTracker (module sessions)
- ExternalSessionScanner, TranscriptReader, `subagentFileOf` (module external)

## Requirements served

- `plan-session_activity/REQ-49`, `plan-session_activity/REQ-59`

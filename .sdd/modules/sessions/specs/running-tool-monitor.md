---
module: sessions
component: RunningToolMonitor
type: backend service
---

# RunningToolMonitor

**Purpose** → follows the main transcript of each working session, hosted or external, and tells which tool runs now.

## Contract

- `new RunningToolMonitor(sources)`
  - `sources.tracker` → SessionStateTracker: the hosted sessions, their state and their Claude Code session id (`claudeSessionId`).
  - `sources.scanner` → ExternalSessionScanner: the external sessions and their state. The Claude Code session id of an external session is its `id`.
  - `sources.reader` → TranscriptReader: `locate`, `readFrom` and `readItem`.
  - `sources.intervalMs` → time between two reads. Default: 500.
  - at construction it takes the sessions of `tracker.list()` and `scanner.list()`, then follows their changes and removals.
- `poll() → Promise<void>` → one read: the new complete lines of the main transcript of each `working` session.
- `start()` → one `poll()` now, then one `poll()` `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more reads, and no pending change from the hold rule.
- `get(id) → RunningTool | undefined` → the tool shown now for the session with that id (RunningTool of `runningToolOf`). `undefined` when no tool is shown.
- `onChange(listener) → unsubscribe` → `listener(id, runningTool | undefined)` after each change of `get(id)`.

Transcript of a session:

```
hosted   → reader.locate(folder, tracker.claudeSessionId(id)); no Claude Code session id → no transcript
external → reader.locate(folder, id)
no file found yet → no tool; the next poll tries again
the Claude Code session id of a hosted session changes → the old transcript and its open calls are dropped
```

Open calls, from the items of `readFrom`, in file order:

```
tool_call with an id     → open, with its name; its input comes from readItem when it is the last open call
tool_result              → the call with id = toolUseId is no longer open
user item                → no call is open
any other item           → no change
```

The first poll of a session reads its transcript from the start. Later polls read only the new lines.

Shown tool (hold rule, 1 second):

```
session leaves working (change or removal)  → no tool, at once
computed = runningToolOf(open calls)
computed present, last call differs from the shown one → shown = computed, from now
computed present, same last call                       → shown = computed (only others can differ)
computed absent, shown for 1 s or more                 → no tool
computed absent, shown for less than 1 s               → no tool when the shown tool reaches 1 s
                                                         (unless a new call or a state change comes first)
```

## Rules and invariants

- It reads only sessions in `working`. A session in any other state has no tool.
- Lines with `isSidechain` give no items (TranscriptReader `itemsOf`), so subagent tools never count.
- A tool appears within one interval after its `tool_use` line reaches the transcript.
- It never writes under the Claude Code folder.
- A failed read changes nothing. The next poll runs as usual.
- It does not change the tracker or the scanner.

## Dependencies

- runningToolOf, SessionStateTracker
- ExternalSessionScanner, TranscriptReader (module external)

## Requirements served

- `plan-session_list_improvements/REQ-14`, `plan-session_list_improvements/REQ-20`, `plan-session_list_improvements/REQ-21`, `plan-session_list_improvements/REQ-22`, `plan-session_list_improvements/REQ-24`

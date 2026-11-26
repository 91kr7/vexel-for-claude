---
module: activity
component: ActivityMonitor
type: backend service
---

# ActivityMonitor

**Purpose** → follows the transcripts of every hosted and external session and tells its live activity and the tree of its current turn.

## Contract

- `new ActivityMonitor(sources)`
  - `sources.tracker` → SessionStateTracker: the hosted sessions, their state and their Claude Code session id (`claudeSessionId`).
  - `sources.scanner` → ExternalSessionScanner: the external sessions and their state. The Claude Code session id of an external session is its `id`.
  - `sources.reader` → TranscriptReader: `locate` and `readEntriesFrom`.
  - `sources.intervalMs` → time between two reads. Default: 500.
  - `sources.maxBytesPerPoll` → the most bytes read for one session in one poll, main transcript and subagent files together. Default: 4 MiB.
  - at construction it takes the sessions of `tracker.list()` and `scanner.list()`, then follows their changes and removals.
- `poll() → Promise<void>` → one read of each session that is not settled (below).
- `start()` → one `poll()` now, then one `poll()` `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more reads.
- `get(id) → LiveActivity | undefined` → the last value computed: `liveActivityOf(<turn model of the session>, <its state>)`. `undefined` when the id is unknown, or before the first read of the session that reached the end of every file.
- `onChange(listener) → unsubscribe` → `listener(id, activity | undefined)` after each change of `get(id)`, `lastEventAt` and `waitingFor` included. No call when the value stays the same.
- `turnOf(id) → TurnTree | undefined` → a copy of the last tree computed: `turnTreeOf(<turn model of the session>, <its state>)`. `undefined` when the id is unknown. `noTurn()` before the first read of the session that reached the end of every file, and while it has no transcript.
- `onTurnChange(listener) → unsubscribe` → `listener(id, change)` after each change of the tree of a session, with `change = turnChangeOf(<previous tree>, <new tree>)`: the whole tree, or only the parts that changed. No call when nothing changed. Each listener gets its own copy.

Reading:

```
transcript   → hosted: reader.locate(folder, tracker.claudeSessionId(id)); no Claude Code session id → no transcript
               external: reader.locate(folder, id)
               no file yet → no value; the next poll tries again
order        → the main transcript (TurnModel addMainEntries), then each file of subagentFilesOf(main transcript)
               by name, listed again at each poll (TurnModel addSubagentEntries, id = file name without ".jsonl")
each file    → first read from its start, then only the complete lines after the last one read (readEntriesFrom),
               at most maxBytesPerPoll bytes for all the files of the session in one poll
metadata     → subagentMetaOf(subagent file) after the lines of that file, unless its last metadata had
               finished: true and the file gave no new line. A read with no field keeps the metadata known before
value        → computed after each read, once one read of the session reached the end of every file;
               the tree is computed at the same moments
the Claude Code session id of a hosted session changes → the old transcript and its model are dropped:
                                                         get(id) gives undefined, with a change;
                                                         the tree goes back to noTurn(), sent whole
```

Settled session:

```
a read that started and ended with the session "ended" and reached the end of every file (or found no file)
    → the session is settled: no more reads
a state change → the session is no longer settled
```

## Rules and invariants

- A state change of the tracker or the scanner computes the value and the tree again at once, with no file read. So a session that ends loses `atWork` at once, and its turn shows as ended.
- Exception: a change to `working` from `idle` or `ended` is computed by the next read. The user line of a new turn reaches the transcript just after the state change, so the working entry does not show the text of the previous turn.
- A new text, a new activity, a call that opens or closes, or a subagent that finishes, shows in `get` within one interval after its line or its metadata reaches its file, unless more than `maxBytesPerPoll` bytes came after the previous poll.
- `get` and `turnOf` read only values in memory. No file read runs on the path of a request.
- A removed session (tracker removal, scanner removal) has no value and no tree. The removal gives no `onChange` and no `onTurnChange` call.
- Each line is read once. Memory per session does not grow with the number of lines (TurnModel).
- A failed read changes nothing. The next poll runs as usual.
- It never writes under the Claude Code folder. It does not change the tracker or the scanner.

## Dependencies

- TurnModel, liveActivityOf, turnTreeOf
- SessionStateTracker (module sessions)
- ExternalSessionScanner, TranscriptReader, `subagentFilesOf` and `subagentMetaOf` (module external)

## Requirements served

- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-2`, `plan-session_activity/REQ-11`, `plan-session_activity/REQ-12`, `plan-session_activity/REQ-14`
- `plan-session_activity/REQ-17`, `plan-session_activity/REQ-22`
- `plan-session_activity/REQ-28`, `plan-session_activity/REQ-40`, `plan-session_activity/REQ-43`, `plan-session_activity/REQ-45`

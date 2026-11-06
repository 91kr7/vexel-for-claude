---
module: sessions
component: UsageMonitor
type: backend service
---

# UsageMonitor

**Purpose** → follows the main transcript of every hosted and external session, in any state, and tells its usage figures.

## Contract

- `new UsageMonitor(sources)`
  - `sources.tracker` → SessionStateTracker: the hosted sessions and their Claude Code session id (`claudeSessionId`).
  - `sources.scanner` → ExternalSessionScanner: the external sessions. The Claude Code session id of an external session is its `id`.
  - `sources.reader` → TranscriptReader: `locate` and `readEntriesFrom`.
  - `sources.intervalMs` → time between two reads. Default: 1000.
  - `sources.maxBytesPerPoll` → the most bytes read from one transcript in one poll. Default: 4 MiB.
  - at construction it takes the sessions of `tracker.list()` and `scanner.list()`, then follows their changes and removals.
- `poll() → Promise<void>` → one read of each session: at most `maxBytesPerPoll` of the new complete lines of its main transcript (`readEntriesFrom`), then the context rule `contextAfter` on them.
- `start()` → one `poll()` now, then one `poll()` `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more reads.
- `get(id) → SessionUsage | undefined` → `{ context: { used, window } }` when the session has a context occupancy. `undefined` when it has none, or when the id is unknown.
- `onChange(listener) → unsubscribe` → `listener(id, usage | undefined)` after each change of `get(id)`. No call when a poll gives the same value.

Transcript of a session:

```
hosted   → reader.locate(folder, tracker.claudeSessionId(id)); no Claude Code session id → no transcript
external → reader.locate(folder, id)
no file found yet → no value; the next poll tries again
the Claude Code session id of a hosted session changes → the old transcript and its value are dropped
                                                         at the next poll: get(id) gives undefined, with a change
```

Reading:

```
first poll of a transcript → from the start of the file
later polls                → only the bytes after the last complete line read
a poll stops at maxBytesPerPoll → the value is not published yet; the next poll goes on
a poll reaches the end of the file → the value is published (get, onChange)
```

## Rules and invariants

- It reads every session, in any state. An ended session keeps its last value until it leaves the tracker.
- A removed session (tracker removal, scanner removal) has no value. The removal gives no `onChange` call.
- A new response of the main conversation shows in `get` within one interval after its line reaches the transcript, unless more than `maxBytesPerPoll` bytes came after the previous poll.
- `get` reads only values in memory. No file read runs on the path of a request.
- A large transcript is read over several polls. Until the last one, `get` keeps the value it had before.
- A failed read changes nothing. The next poll runs as usual.
- It never writes under the Claude Code folder. It does not change the tracker or the scanner.

## Dependencies

- contextAfter, SessionStateTracker
- ExternalSessionScanner, TranscriptReader (module external)

## Requirements served

- `plan-session_usage/REQ-1`, `plan-session_usage/REQ-2`, `plan-session_usage/REQ-9`, `plan-session_usage/REQ-10`, `plan-session_usage/REQ-12`, `plan-session_usage/REQ-21`

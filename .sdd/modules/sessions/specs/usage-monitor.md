---
module: sessions
component: UsageMonitor
type: backend service
---

# UsageMonitor

**Purpose** → follows the main transcript and the subagent files of every hosted and external session, in any state, and tells its usage figures.

## Contract

- `new UsageMonitor(sources)`
  - `sources.tracker` → SessionStateTracker: the hosted sessions and their Claude Code session id (`claudeSessionId`).
  - `sources.scanner` → ExternalSessionScanner: the external sessions. The Claude Code session id of an external session is its `id`.
  - `sources.reader` → TranscriptReader: `locate` and `readEntriesFrom`.
  - `sources.intervalMs` → time between two reads. Default: 1000.
  - `sources.maxBytesPerPoll` → the most bytes read for one session in one poll, main transcript and subagent files together. Default: 4 MiB.
  - at construction it takes the sessions of `tracker.list()` and `scanner.list()`, then follows their changes and removals.
- `poll() → Promise<void>` → one read of each session: the new complete lines of its main transcript, then of each of its subagent files (`subagentFilesOf`, new files included), at most `maxBytesPerPoll` bytes in all (`readEntriesFrom`). The context rule `contextAfter` runs on the main lines only. Every response line, main and subagent, goes to the ResponseLedger of the session.
- `start()` → one `poll()` now, then one `poll()` `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more reads.
- `get(id) → SessionUsage | undefined` → `{ context?, tokens? }`:
  - `context` → `{ used, window }`, when the session has a context occupancy.
  - `tokens` → `{ input, output, cacheWrite, cacheRead }`, the ledger totals, when the ledger has a response.
  - `undefined` when the session has neither, or when the id is unknown.
- `onChange(listener) → unsubscribe` → `listener(id, usage | undefined)` after each change of `get(id)`. No call when a poll gives the same value.

Transcript of a session:

```
hosted   → reader.locate(folder, tracker.claudeSessionId(id)); no Claude Code session id → no transcript
external → reader.locate(folder, id)
no file found yet → no value; the next poll tries again
subagent files → subagentFilesOf(main transcript), listed again at each poll
the Claude Code session id of a hosted session changes → the old transcript, its subagent files, its ledger
                                                         and its value are dropped at the next poll:
                                                         get(id) gives undefined, with a change
```

Reading:

```
order of a poll      → the main transcript, then the subagent files by name
first read of a file → from its start (a new transcript, or a new subagent file)
later reads          → only the bytes after the last complete line read in that file
a poll uses up maxBytesPerPoll before the end of every file → the value is not published yet;
                                                              the next poll goes on
a poll reaches the end of every file → the value is published (get, onChange)
```

## Rules and invariants

- It reads every session, in any state. An ended session keeps its last value until it leaves the tracker.
- A removed session (tracker removal, scanner removal) has no value. The removal gives no `onChange` call.
- A new response, of the main conversation or of a subagent, shows in `get` within one interval after its line reaches its file, unless more than `maxBytesPerPoll` bytes came after the previous poll.
- `get` reads only values in memory. No file read runs on the path of a request.
- A large transcript is read over several polls. Until the last one, `get` keeps the value it had before.
- A resumed session keeps its Claude Code session id and its transcript file, so its responses from before the resume count.
- Each line is read once. The ledger sums are updated per new response, never computed again over all of them.
- A failed read changes nothing. The next poll runs as usual.
- It never writes under the Claude Code folder. It does not change the tracker or the scanner.

## Dependencies

- contextAfter, modelResponseOf, ResponseLedger, SessionStateTracker
- ExternalSessionScanner, TranscriptReader and `subagentFilesOf` (module external)

## Requirements served

- `plan-session_usage/REQ-1`, `plan-session_usage/REQ-2`, `plan-session_usage/REQ-9`, `plan-session_usage/REQ-10`, `plan-session_usage/REQ-12`
- `plan-session_usage/REQ-14`, `plan-session_usage/REQ-15`, `plan-session_usage/REQ-16`, `plan-session_usage/REQ-17`, `plan-session_usage/REQ-18`, `plan-session_usage/REQ-19`, `plan-session_usage/REQ-20`, `plan-session_usage/REQ-21`

---
module: activity
component: TurnModel
type: backend service
---

# TurnModel

**Purpose** → the state of the current turn of one session: its start, the latest text of each conversation, the state of each subagent, the time of the last activity and the open tool calls. It is built from the parsed lines of the main transcript and of the subagent files, and from the subagent metadata.

## Contract

- `new TurnModel()` → no turn start, no text, no subagent, no activity, no open call.
- `addMainEntries(entries)` → the next parsed lines of the main transcript, in file order. Each line is given once.
- `addSubagentEntries(id, entries)` → the next parsed lines of the subagent file `id` (its file name without `.jsonl`, e.g. `agent-a1b2`), in file order. Each line is given once.
- `setSubagentMeta(id, meta)` → the metadata (`SubagentMeta` of TranscriptReader) of subagent `id`. It replaces the previous one.
- `mainText() → TimedText | undefined` → the latest text of the main conversation in the current turn.
- `subagents(sessionEnded) → SubagentView[]` → one per subagent known by its lines or its metadata, in the order they became known.
  - `SubagentView` → `{ id, meta, state, latestText? }`.
  - `state` → `subagentStateOf({ finished: meta.finished, interrupted, sessionEnded })`.
  - `latestText` → the latest text of the subagent in the current turn.
- `TimedText` → `{ text, at?, order }`.
  - `text` → the text of an `assistant` item of `itemsOf`: trimmed, markdown kept.
  - `at` → the `timestamp` of its line, when it is a string with a valid date.
  - `order` → grows with each text or call the model takes: one taken later has a higher `order`.
- `lastEventAt() → string | undefined` → the time of the latest activity: the latest time of a line of type `user` or `assistant`, of the main transcript or of any subagent file.
  - time of a line → its `timestamp`, when it is a string with a valid date, as written on the line. Else the moment the model takes the line, as an ISO-8601 time.
  - no such line yet → `undefined`.
- `openCalls(sessionEnded) → OpenCall[]` → the open tool calls of the main conversation and of each subagent whose state is "running", in start order.
  - `OpenCall` → `{ id, name, input?, subagentType?, at?, order }`.
  - `id`, `name` → of the `tool_call` item. `input` → the raw `input` of its `tool_use` block, when present.
  - `subagentType` → the `meta.agentType` of its subagent, when it is a non-empty string. A call of the main conversation has none.
  - `at`, `order` → as for `TimedText`, from the line of the call.

```
a started before b → both "at" known and different → a.at < b.at
                     else                           → a.order < b.order
```

Main transcript lines:

```
for each line, in order:
    startsTurn(line)          → a new turn starts at the time of the line (unknown when it has no valid timestamp):
                                the main text is dropped;
                                each subagent text is dropped, unless both times are known
                                and the text is after the turn start
    stoppedTaskIdOf(line) = X → a stop notice for subagent "agent-X" at the time of the line;
                                a later notice for the same subagent replaces it
    each assistant item       → the main text
    each item                 → the open calls of the main conversation (below)
```

Subagent file lines:

```
for each line, in order:
    a line of type "assistant"              → the in-file interrupt mark is cleared;
                                              its time, when known, is the last activity of the subagent
    each item of itemsOf(line, -, { sidechain: true }):
        user item, isInterruptMarker(text)  → the in-file interrupt mark is set
        assistant item                      → the subagent text, unless the turn start and the line time
                                              are both known and the line is not after the turn start
        each item                           → the open calls of the subagent (below)
```

Open calls of one conversation, from its items in file order:

```
tool_call with an id → open
tool_result          → the call with id = toolUseId is no longer open
user item            → no call of that conversation is open
any other item       → no change
```

A subagent that is not running (finished or stopped) gives no open call.

Interrupted:

```
interrupted = the in-file interrupt mark is set
              or the subagent has a stop notice, and its last activity is not known to be after that notice
```

## Rules and invariants

- Thinking gives no item, so it is never a text.
- Before the first turn start, every text counts: the turn starts with the file.
- A subagent started in an earlier turn that still runs can give the text of the current turn.
- A text whose line has no timestamp counts when it is read after the turn start, and is dropped by the next turn.
- It keeps no list of items. Per subagent it keeps the metadata, one text, one mark, one time and its open calls, so its size does not grow with the run.
- A new turn changes neither the time of the last activity nor the open calls: the user line that starts it closes the main calls.

## Assumptions

Checked on Claude Code 2.1.332, 2026-11-26:

- the lines of type `user`, `assistant` and `attachment` of a subagent file have a `timestamp`. The lines of type `api-request-blob` have none, and carry no text.
- every subagent of a session has its file in `subagents/`, with `spawnDepth` 1. This machine has no nested subagent (`spawnDepth` 2), so the place of their files is not checked.
- a subagent can go on after an interrupt marker in its file: new `assistant` lines follow it.

## Dependencies

- startsTurn, isInterruptMarker, subagentStateOf, stoppedTaskIdOf
- TranscriptReader `itemsOf`, `SubagentMeta` (module external)

## Requirements served

- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-2`, `plan-session_activity/REQ-3`, `plan-session_activity/REQ-5`, `plan-session_activity/REQ-10`, `plan-session_activity/REQ-14`
- `plan-session_activity/REQ-17`, `plan-session_activity/REQ-18`, `plan-session_activity/REQ-19`, `plan-session_activity/REQ-20`, `plan-session_activity/REQ-26`

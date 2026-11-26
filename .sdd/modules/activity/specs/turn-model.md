---
module: activity
component: TurnModel
type: backend service
---

# TurnModel

**Purpose** → the state of the current turn of one session: its start, its steps, the latest text of each conversation, the state, times, model and starting step of each subagent, the time of the last activity and the open tool calls. It is built from the parsed lines of the main transcript and of the subagent files, and from the subagent metadata.

## Contract

- `new TurnModel()` → no turn start, no step, no text, no subagent, no activity, no open call.
- `addMainEntries(entries)` → the next parsed lines of the main transcript, in file order. Each line is given once.
- `addSubagentEntries(id, entries)` → the next parsed lines of the subagent file `id` (its file name without `.jsonl`, e.g. `agent-a1b2`), in file order. Each line is given once.
- `setSubagentMeta(id, meta)` → the metadata (`SubagentMeta` of TranscriptReader) of subagent `id`. It replaces the previous one.
- `turnNumber() → number` → the number of turn starts seen in the main transcript. `0` → no turn yet.
- `steps() → TurnStep[]` → the steps of the main conversation in the current turn, in file order (below). A new array at each call. A step that does not change stays the same object across calls; a step that changes is a new object. The steps are read-only.
- `mainText() → TimedText | undefined` → the latest text of the main conversation in the current turn.
- `subagents(sessionEnded) → SubagentView[]` → one per subagent known by its lines or its metadata, in the order they became known.
  - `SubagentView` → `{ id, meta, state, latestText?, lastText?, startedAt?, lastLineAt?, responseModel?, openCalls, startedBy? }`.
  - `state` → `subagentStateOf({ finished: meta.finished, interrupted, sessionEnded })`.
  - `latestText` → the latest text of the subagent in the current turn.
  - `lastText` → the latest text of the subagent, whatever its turn.
  - `startedAt` → the time of its first line with a valid `timestamp`. `lastLineAt` → the latest valid `timestamp` of its lines.
  - `responseModel` → the `message.model` of its latest `assistant` line that has one: a non-empty string other than "<synthetic>".
  - `openCalls` → its open calls in start order, as in `openCalls` below. Empty unless its state is "running".
  - `startedBy` → the step of the call that started it (below), as `{ parent?, step }`. No `parent` → a step of `steps()`. `parent` → the id of the subagent that made the call, and `step` its position among the steps of that subagent.
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
                                the turn number grows by 1; the steps and the main text are dropped;
                                each subagent text is dropped, unless both times are known
                                and the text is after the turn start
    stoppedTaskIdOf(line) = X → a stop notice for subagent "agent-X" at the time of the line;
                                a later notice for the same subagent replaces it
    each assistant item       → the main text
    each item                 → the steps (below) and the open calls of the main conversation (below)
```

Steps of the main conversation, from its items in file order:

```
assistant item              → a step { kind: "text", text: plainExcerpt(text, 400) }; none when that text is empty
tool_call                   → a step { kind: "tool", name?, argument?, outcome? }
                                  name     → the tool name, when not empty
                                  argument → the argument of runningToolOf for that one call (first line of the
                                             main argument, trimmed), cut at 400 characters with "…"; absent when none.
                                             The input is the one of its tool_use block, also for a call with no id
                                  outcome  → "running"; absent for a call with no id
tool_result with toolUseId  → the step of the call with that id in the current turn: outcome "error"
                              when the result is an error, else "completed"
any other item              → no step
```

Subagent file lines:

```
for each line, in order:
    a line with a valid timestamp           → its start time, if it is the first; its last line time, if later
    a line of type "assistant"              → the in-file interrupt mark is cleared;
                                              its time, when known, is the last activity of the subagent;
                                              its model, when valid, is the response model
    each item of itemsOf(line, -, { sidechain: true }):
        assistant item or tool_call         → one more step of the subagent (positions 0, 1, 2, …)
        user item, isInterruptMarker(text)  → the in-file interrupt mark is set
        assistant item                      → the last text; also the subagent text, unless the turn start and
                                              the line time are both known and the line is not after the turn start
        each item                           → the open calls of the subagent (below)
```

Starting step of a subagent (`startedBy`), from `meta.toolUseId` = T:

```
T is the id of a tool_call step of the current turn          → { step: its index in steps() }
T is the id of a tool_call of subagent P at position n       → { parent: P, step: n }
    found whether the metadata comes before or after that call; once found, it stays
    a call of a subagent is remembered until its child's metadata comes,
    among the latest 2,000 such calls of the session
anything else (no T, a call of an earlier turn, unknown)      → no startedBy
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
- It keeps no list of items. Per subagent it keeps the metadata, two texts, one mark, its times, its model, its step count, its starting step and its open calls, so its size does not grow with the run.
- It keeps the steps of the current turn only, each with a text of at most 400 characters. A new turn drops them.
- A new turn changes neither the time of the last activity nor the open calls: the user line that starts it closes the main calls.

## Assumptions

Checked on Claude Code 2.1.332, 2026-11-26:

- the lines of type `user`, `assistant` and `attachment` of a subagent file have a `timestamp`. The lines of type `api-request-blob` have none, and carry no text.
- every subagent of a session has its file in `subagents/`, with `spawnDepth` 1. This machine has no nested subagent (`spawnDepth` 2), so the place of their files is not checked.
- a subagent can go on after an interrupt marker in its file: new `assistant` lines follow it.

## Dependencies

- startsTurn, isInterruptMarker, subagentStateOf, stoppedTaskIdOf
- TranscriptReader `itemsOf`, `SubagentMeta` (module external)
- plainExcerpt, runningToolOf (module sessions)

## Requirements served

- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-2`, `plan-session_activity/REQ-3`, `plan-session_activity/REQ-5`, `plan-session_activity/REQ-10`, `plan-session_activity/REQ-14`
- `plan-session_activity/REQ-17`, `plan-session_activity/REQ-18`, `plan-session_activity/REQ-19`, `plan-session_activity/REQ-20`, `plan-session_activity/REQ-26`
- `plan-session_activity/REQ-28`, `plan-session_activity/REQ-29`, `plan-session_activity/REQ-30`, `plan-session_activity/REQ-31`, `plan-session_activity/REQ-32`, `plan-session_activity/REQ-34`, `plan-session_activity/REQ-35`, `plan-session_activity/REQ-37`, `plan-session_activity/REQ-38`, `plan-session_activity/REQ-39`, `plan-session_activity/REQ-45`

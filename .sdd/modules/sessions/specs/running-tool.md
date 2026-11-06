---
module: sessions
component: runningToolOf
type: backend function
---

# runningToolOf

**Purpose** → the rule that turns the open tool calls of a session into the tool that the tool line shows.

## Contract

- `runningToolOf(calls) → RunningTool | undefined`
  - `calls` → the open tool calls, in start order. Each call is `{ name, input? }`: the tool name and its raw input.
  - no call → `undefined`.

`RunningTool` → `{ name, argument?, others }`:

```
last     = the last call of calls
name     = last.name
argument = the first line of mainArgumentOf(last.input), trimmed
           absent when there is no main argument, or when that line is empty after the trim
others   = number of calls - 1
```

- a line ends at `\n`, `\r\n` or `\r`.

## Rules and invariants

- It is pure: the same calls give the same result, and the calls are not changed.

## Dependencies

- TranscriptReader `mainArgumentOf` (module external)

## Requirements served

- `plan-session_list_improvements/REQ-15`, `plan-session_list_improvements/REQ-16`, `plan-session_list_improvements/REQ-18`, `plan-session_list_improvements/REQ-19`

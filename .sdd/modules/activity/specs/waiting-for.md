---
module: activity
component: waitingForOf
type: backend function
---

# waitingForOf

**Purpose** → what a session at work waits for: the tool that started first among the running ones, or Claude's response.

## Contract

- `waitingForOf(calls, running) → WaitingFor`
  - `calls` → the open calls of TurnModel `openCalls`, in start order.
  - `running` → the running subagents (`SubagentView` of TurnModel).
- `WaitingFor` → `"response"`, or `WaitingTool` → `{ subagentType?, name, argument?, others }`.

```
waiting = calls, without each call whose id is the meta.toolUseId of a running subagent
waiting is empty → "response"
first        = the first call of waiting
name         = first.name
argument     = the first line of mainArgumentOf(first.input), trimmed, as runningToolOf gives it
               absent when there is no main argument, or when that line is empty
subagentType = first.subagentType, when it is a non-empty string
others       = the number of calls in waiting - 1
```

## Rules and invariants

- It is pure: the same input gives the same result, and the input is not changed.
- A subagent with no `toolUseId` in its metadata excludes no call.

## Dependencies

- TurnModel (`OpenCall`, `SubagentView`)
- runningToolOf (module sessions)

## Requirements served

- `plan-session_activity/REQ-18`, `plan-session_activity/REQ-19`, `plan-session_activity/REQ-20`, `plan-session_activity/REQ-26`

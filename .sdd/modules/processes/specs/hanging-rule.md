---
module: processes
component: isHanging
type: backend function
---

# isHanging

**Purpose** → tells whether a listed process is hanging.

## Contract

- `isHanging(process, kinds, facts, ownPid) → boolean` → `kinds` is the map of classifyProcesses, `facts` all the facts of the same read.

```
pid = ownPid                                        → false
kind fake-claude or claude-session:
  the parent pid is an app-server or test-server in kinds → false
  otherwise                                         → true
kind app-server or test-server:
  no launcher marker                                → false
  a process in facts has the marker pid and startTicks → false
  otherwise                                         → true
```

## Rules and invariants

- A server started by hand, or before the launcher marker existed, is never hanging.
- A launcher PID reused by another process does not count: the start time must match.

## Dependencies

- ProcessReader (`ProcessFacts`), classifyProcesses

## Requirements served

- `plan-app_processes/REQ-19`

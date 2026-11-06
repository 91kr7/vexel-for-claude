---
module: sessions
component: contextAfter
type: backend function
---

# contextAfter

**Purpose** → the context occupancy of a session now, from the lines of its main transcript.

## Contract

- `contextAfter(previous, entries) → ContextOccupancy | undefined`
  - `previous` → the occupancy before these lines, or `undefined`. A call on all the lines of a file starts from `undefined`.
  - `entries` → parsed transcript lines, in file order.
- `ContextOccupancy` → `{ used, window }`

Lines in order, starting from `previous`:

```
line type "system" with subtype "compact_boundary"      → no occupancy
modelResponseOf(line) is a response with sidechain false → used   = input + cacheWrite + cacheRead
                                                           window = contextWindowOf(model, used)
any other line (no response, a subagent response)       → no change
result → the value after the last line
```

## Rules and invariants

- Pure: same input, same result.
- Splitting the lines in two calls gives the same result: `contextAfter(contextAfter(p, a), b)` = `contextAfter(p, a + b)`.
- Output tokens never count in `used`.

## Dependencies

- modelResponseOf, contextWindowOf

## Requirements served

- `plan-session_usage/REQ-3`, `plan-session_usage/REQ-6`, `plan-session_usage/REQ-7`, `plan-session_usage/REQ-9`

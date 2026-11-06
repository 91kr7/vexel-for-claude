---
module: sessions
component: modelResponseOf
type: backend function
---

# modelResponseOf

**Purpose** → turns one parsed transcript line into the model response it records, with its model and its token counts.

## Contract

- `modelResponseOf(entry) → ModelResponse | undefined`
- `ModelResponse` → `{ key, model, input, output, cacheWrite, cacheRead, sidechain }`

Line to response:

```
entry not an object, type not "assistant", or message not an object  → none
message.usage missing or not an object                               → none
message.model = "<synthetic>"                                         → none
key = message.id when a string, else the line uuid when a string, else → none
otherwise → {
  key,
  model      = message.model when a string, else ""
  input      = usage.input_tokens
  output     = usage.output_tokens
  cacheWrite = usage.cache_creation_input_tokens
  cacheRead  = usage.cache_read_input_tokens
  sidechain  = isSidechain is true
}
a count that is missing, not a number, not finite or negative → 0
```

## Rules and invariants

- Pure: same line, same result.
- Several lines of one response share its `key`. The caller decides how to merge them.

## Requirements served

- `plan-session_usage/REQ-3`, `plan-session_usage/REQ-6`

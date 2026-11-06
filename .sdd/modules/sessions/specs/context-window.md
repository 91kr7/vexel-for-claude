---
module: sessions
component: contextWindowOf
type: backend function
---

# contextWindowOf

**Purpose** → the context window size of a model, in tokens.

## Contract

- `contextWindowOf(model, used) → number` → `model` is the model id of a response, `used` its used tokens.

```
used > 200,000                                      → 1,000,000
model contains "[1m]" (any letter case)             → 1,000,000
model is a known extended model, with or without
a date suffix "-YYYYMMDD"                           → 1,000,000
any other model, "" included                        → 200,000
```

Known extended models: `claude-opus-5-5`, `claude-sonnet-5-5`.

## Rules and invariants

- Pure: same input, same result.

## Assumptions

- The known extended models come from the transcripts of this machine on 2026-11-06. Both models reach more than 200,000 used tokens before a compaction, so their window is 1,000,000. The Anthropic model docs were not available to the developer.

## Requirements served

- `plan-session_usage/REQ-4`, `plan-session_usage/REQ-5`

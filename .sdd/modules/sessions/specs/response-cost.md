---
module: sessions
component: costOf
type: backend function
---

# costOf

**Purpose** → the estimated cost of one response at the API list prices of its own model.

## Contract

- `costOf(response) → number | undefined` → USD, or `undefined` when the model has no known price.
- `response` → `{ model, input, output, cacheWrite, cacheWrite5m, cacheWrite1h, cacheRead }` of a ModelResponse.

```
pricing = pricingOf(model)
pricing undefined → undefined
cacheWrite5m or cacheWrite1h absent → cacheWrite5m = cacheWrite, cacheWrite1h = 0
prompt  = input + cacheWrite + cacheRead
tier    = the last tier of pricing with fromPromptTokens <= prompt
cost    = ( input        × tier.input
          + cacheWrite5m × tier.cacheWrite5m
          + cacheWrite1h × tier.cacheWrite1h
          + cacheRead    × tier.cacheRead
          + output       × tier.output ) / 1,000,000
```

Examples:
- `claude-opus-5-5`, 1,000 input, 2,000 output, no cache → 0.044.
- `claude-haiku-5-5`, 100,000 prompt tokens → the first tier; 100,001 → the second tier, for every count of the response.

## Rules and invariants

- Pure: same response, same result.
- The tier applies to the whole response, output included.
- A response with all counts at 0 and a known model costs 0, not `undefined`.

## Dependencies

- pricingOf, modelResponseOf (type ModelResponse)

## Requirements served

- `plan-session_usage/REQ-25`, `plan-session_usage/REQ-26`, `plan-session_usage/REQ-27`, `plan-session_usage/REQ-28`, `plan-session_usage/REQ-30`

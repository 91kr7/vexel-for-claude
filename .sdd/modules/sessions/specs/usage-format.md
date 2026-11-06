---
module: sessions
component: shortTokens, percentOf, usageLevelOf
type: frontend function
---

# Usage format

**Purpose** → the page text of the usage figures: the short form of a token count, the context percentage and its level.

## Contract

- `shortTokens(count) → string`

```
count < 1,000                  → the number, e.g. "950"
rounded to 0.1k is below 1000k → thousands with one decimal and "k", e.g. "45.2k"
otherwise                      → millions with one decimal and "M", e.g. "1.3M"
a trailing ".0" is dropped     → "200k", "1M", "1k"
```

  - 999,950 rounds to "1M", not "1000k".
- `percentOf({ used, window }) → number` → `used / window × 100`, rounded to the nearest whole number. 45,200 of 200,000 → 23.
- `usageLevelOf(percent) → "normal" | "warning" | "error"` → `percent` is the rounded percentage the page shows.

```
percent >= 90 → error
percent >= 70 → warning
otherwise     → normal
```

## Rules and invariants

- Pure: same input, same result.

## Requirements served

- `plan-session_usage/REQ-2`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-11`

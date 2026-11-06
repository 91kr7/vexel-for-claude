---
module: sessions
component: shortTokens, percentOf, usageLevelOf, costText
type: frontend function
---

# Usage format

**Purpose** → the page text of the usage figures: the short form of a token count, the context percentage and its level, the estimated cost.

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

- `costText(usd) → string` → `usd` is the `usd` of `usage.cost`, possibly absent.

```
usd absent  → "—"
usd < 0.01  → "<$0.01" (0 included)
otherwise   → "$" and two decimals, e.g. "$1.27", "$12.00", "$1234.50"
```

- `INCOMPLETE_COST_TEXT` → "Incomplete: the price of a model is unknown", the tooltip and accessible name of the "incomplete" mark.

## Rules and invariants

- Pure: same input, same result.

## Requirements served

- `plan-session_usage/REQ-2`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-11`, `plan-session_usage/REQ-30`, `plan-session_usage/REQ-32`

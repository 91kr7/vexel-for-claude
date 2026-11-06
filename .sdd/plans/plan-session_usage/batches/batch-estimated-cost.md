---
batch: estimated-cost
feature: Estimated cost
closed_req: [REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35]
depends: [tokens-consumed]
---

# Batch estimated-cost — Estimated cost

REQ ids refer to `plan-session_usage/requirements.md`. "Response", "estimated cost" and "prompt length" are defined there.

Components built by earlier batches of this plan are named as in their "What this batch builds" sections. Their paths are in `.sdd/modules/sessions/index.md`, where those batches record them.

## What this batch builds

- **Price list** → the list prices of each known model, in USD, with their tiers and the date they were read.
- **Cost rule** → a pure function: the cost of one response, or "unknown" when its model has no price.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Price list: for each known model id, USD per million tokens of input, 5-minute cache write, 1-hour cache write, cache read and output. A model with tiers lists the prompt length where each tier starts. | REQ-25, REQ-26, REQ-28 | — |
| INT-2 | modify | Response rule (`batch-context-occupancy`) | The response also carries `cacheWrite5m` and `cacheWrite1h`, from `usage.cache_creation`. No split, or a split that does not match `cacheWrite` → all cache write tokens are 5-minute. | REQ-26, REQ-27 | — |
| INT-3 | create | backend, sessions area | Cost rule: model not in INT-1 → unknown. Else the tier of the prompt length, then the five counts × their prices. | REQ-25, REQ-26, REQ-28, REQ-30 | INT-1, INT-2 |
| INT-4 | modify | Response ledger (`batch-tokens-consumed`) | Each record keeps its cost (INT-3). A replaced record replaces its cost. The ledger gives `cost` = `{ usd?, incomplete }`: `usd` is the sum of the known costs, absent when none is known. `incomplete` is true when any cost is unknown. | REQ-24, REQ-30, REQ-31 | INT-3 |
| INT-5 | modify | Usage monitor (`batch-context-occupancy`) | `usage.cost` comes from the ledger, present whenever `usage.tokens` is present. | REQ-22, REQ-23, REQ-33, REQ-34, REQ-35 | INT-4 |
| INT-6 | modify | Usage format (`batch-context-occupancy`) | Cost format: "$" and two decimals, "<$0.01" below one cent. No `usd` → "—". | REQ-30, REQ-32 | — |
| INT-7 | modify | `src/web/sessions/SessionList.tsx` | Every entry with `usage.cost` shows the cost (INT-6) on line 2, after the percentage. Tooltip "Estimated cost at API list prices". `incomplete` → an amber "*" after the cost, with the mark text of the Decisions. | REQ-22, REQ-29, REQ-30, REQ-33, REQ-34 | INT-6 |
| INT-8 | modify | `src/web/sessions/SessionHeader.tsx` | With `usage.cost` → a `.mono-chip` "$1.27 · estimate at API list prices" after the tokens chip. `incomplete` → the amber word "incomplete" in the chip, with the mark text of the Decisions. | REQ-23, REQ-29, REQ-30, REQ-32, REQ-33, REQ-34 | INT-6 |

## Decisions

- **Prices.** The developer reads Anthropic's public pricing page on the delivery date (spec assumption) and writes that date next to the list. If the page cannot be read, the batch stops and asks the human. A model id matches a price entry by its family and version. The date suffix of the id does not matter. A "[1m]" marker does not change the price.
- **Prompt length.** Input plus cache write plus cache read tokens of the response. A tier applies to the whole response, as in Anthropic's long-context prices.
- **Server-side cost.** The page never sees single responses. So the server prices each response and sends only the sum.
- **"incomplete" mark text.** The tooltip and the accessible name of the mark say "Incomplete: the price of a model is unknown". The amber status colour is the same one the context level uses.
- **Same responses as the tokens (REQ-24).** The cost lives in the same ledger records as the tokens. Subagents, repeated lines, resume and `/clear` therefore apply to both in the same way.
- **No change to the routes.** `cost` rides inside `usage`, like `tokens`.
- **Look.** List: "23% · $1.27" before the time, mono 10 px in `--text-muted`. Header: the chip after the tokens chip, the label in `--text-muted`. The cost chip and the "incomplete" mark are new text in English.
- **Tests.** Vitest for INT-1 to INT-8, with responses of known, tiered and unknown models and both cache write durations. Playwright e2e in the browser for the list entry and the header. No Electron e2e (knowledge base `electron-e2e-separate`). Existing tests to run (knowledge base `narrow-batch-tests`): those of the response rule, the ledger, the usage monitor, the usage format, `SessionList`, `SessionHeader`, `SessionView`, `ConversationView`. This is the last batch, so the closing run covers the rest.

## Human acceptance

### Scenario: Every session shows its estimated cost

- REQ → REQ-22, REQ-23, REQ-24, REQ-25, REQ-29, REQ-32, REQ-35
- Given → a hosted session and an external session, each with a few answers of known models, subagents included
- When → Claude answers once more in each, and the user opens one of them
- Then → within 2 seconds each entry shows its cost, such as "$1.27", with the tooltip "Estimated cost at API list prices". The header shows "$1.27 · estimate at API list prices"

### Scenario: Cache and tiered prices

- REQ → REQ-26, REQ-27, REQ-28
- Given → a session with one answer that wrote 1-hour cache, one cache write with no duration, and one Haiku 5.5 answer with a prompt above 100,000 tokens
- When → the user opens the session
- Then → the cost equals the sum of those answers at the 1-hour, 5-minute and long-prompt prices

### Scenario: A model with no known price

- REQ → REQ-30, REQ-31
- Given → a session where one answer comes from a model missing from the price list
- When → the user opens the session
- Then → the cost carries the "incomplete" mark with the tooltip about the unknown price, and the tokens chip still counts that answer

### Scenario: Only unknown prices

- REQ → REQ-30
- Given → a session whose every answer comes from a model missing from the price list
- When → the user looks at the entry and the header
- Then → the cost shows "—" with the "incomplete" mark

### Scenario: Small and missing costs

- REQ → REQ-32, REQ-33
- Given → a new session with no answer, and a session with one tiny answer
- When → the user looks at the list
- Then → the first entry shows no cost, not "$0.00", and the second shows "<$0.01"

### Scenario: An ended session keeps its cost

- REQ → REQ-34
- Given → an open hosted session that shows "$0.85"
- When → the session ends
- Then → its entry in the ended group and its header still show "$0.85"

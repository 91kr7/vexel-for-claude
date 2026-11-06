---
module: sessions
component: pricingOf
type: backend function
---

# pricingOf

**Purpose** → the API list prices of a model id, in USD per million tokens, with their prompt-length tiers.

## Contract

- `pricingOf(model) → ModelPricing | undefined` → `undefined` when the model has no known price.
- `ModelPricing` → the tiers of the model, by ascending `fromPromptTokens`. The first tier starts at 0.
- `PriceTier` → `{ fromPromptTokens, input, cacheWrite5m, cacheWrite1h, cacheRead, output }`. `fromPromptTokens` is the smallest prompt length the tier applies to.
- `PRICES_READ_ON` → `"2026-11-06"`, the date the prices were read.

Model id to price entry:

```
id = model in lower case, without "[1m]", without a trailing date suffix "-YYYYMMDD"
id in the table → its tiers
otherwise ("" and "<synthetic>" included) → undefined
```

Price table (USD per million tokens):

| Model id | Prompt tokens | Input | 5m cache write | 1h cache write | Cache read | Output |
|----------|---------------|-------|----------------|----------------|------------|--------|
| `claude-fable-5-1`, `claude-mythos-5-1` | any | 10 | 12.50 | 20 | 0.25 | 50 |
| `claude-fable-5`, `claude-mythos-5` | any | 10 | 12.50 | 20 | 1 | 50 |
| `claude-opus-5-5` | any | 4 | 5 | 8 | 0.20 | 20 |
| `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5` | any | 5 | 6.25 | 10 | 0.50 | 25 |
| `claude-opus-4-1`, `claude-opus-4` | any | 15 | 18.75 | 30 | 1.50 | 75 |
| `claude-sonnet-5-5` | any | 2 | 2.50 | 4 | 0.10 | 10 |
| `claude-sonnet-5` | any | 2 | 2.50 | 4 | 0.20 | 10 |
| `claude-sonnet-4-6`, `claude-sonnet-4-5`, `claude-sonnet-4` | any | 3 | 3.75 | 6 | 0.30 | 15 |
| `claude-haiku-5-5` | 0 to 100,000 | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 |
| `claude-haiku-5-5` | from 100,001 | 0.50 | 0.625 | 1 | 0.05 | 2.50 |
| `claude-haiku-4-5` | any | 1 | 1.25 | 2 | 0.10 | 5 |

## Rules and invariants

- Pure: same id, same result.
- `claude-opus-5` and `claude-opus-5-5` are different entries: the match is on the whole id, never on a prefix.

## Assumptions

- Source: the "Model pricing" and "Long context pricing" sections of https://platform.claude.com/docs/en/about-claude/pricing, read on 2026-11-06.
- Model ids follow the API ids of the models page (`claude-<family>-<version>`). The page gives no id for Fable 5, Mythos 5 and Mythos 5.1: their ids follow the same pattern.
- Not priced: models missing from the page table (Claude 3 family, Mythos Preview), and the modifiers that a transcript does not record (batch, fast mode, data residency).

## Requirements served

- `plan-session_usage/REQ-25`, `plan-session_usage/REQ-26`, `plan-session_usage/REQ-28`

---
module: sessions
component: SessionFigures
type: UI component
---

# SessionFigures

**Purpose** → the figures of a session summary as chips: context occupancy, total tokens and estimated cost.

## Contract

Props:
- `usage` → the `usage` of the session summary. Optional.

Shows, in this order, 8 px apart, each a `.mono-chip` on surface 2:
- with `usage.context` → the context chip: "Context" in `--text-muted`, then "<used> / <window> · <percent>%", e.g. "Context 45.2k / 200k · 23%". `used` and `window` in short form (`shortTokens`), `percent` by `percentOf`.
  - the value is in `--text-secondary` at level `normal`, amber-400 at `warning`, rose-400 at `error` (`usageLevelOf`).
- with `usage.tokens` → the tokens chip, in `--text-secondary`: "<total> tokens", e.g. "1.3M tokens". `total` = input + output + cacheWrite + cacheRead, in short form.
  - it is focusable with the keyboard (Tab).
  - hover or keyboard focus → a tooltip above the chip, aligned to its right edge: four rows "Input", "Output", "Cache write", "Cache read", each with its count in short form. The tooltip is the chip's description (`role="tooltip"`, `aria-describedby`).
  - pointer away and focus elsewhere → no tooltip.
- with `usage.cost` → the cost chip: the amount `costText(usage.cost.usd)` in `--text-secondary`, with the tooltip (`title`) "Estimated cost at API list prices", the same as the list entry. "<$0.01" below one cent, "—" when there is no `usd`.
  - `usage.cost.incomplete` → the amber-400 word "incomplete" right after the amount. Its tooltip and accessible name: "Incomplete: the price of a model is unknown".
- a missing figure shows no chip: never "0%", "0 tokens" or "$0.00". No `usage` → nothing.

## Rules and invariants

- The chips never wrap and are never cut.
- The tokens tooltip floats over the content: it never changes the height of the row that holds the chips.

## Dependencies

- usage format (`shortTokens`, `percentOf`, `usageLevelOf`, `costText`, `INCOMPLETE_COST_TEXT`)
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-session_list_width/REQ-20`, `plan-session_list_width/REQ-23`, `plan-session_list_width/REQ-24`, `plan-session_list_width/REQ-26`, `plan-session_list_width/REQ-27`
- `plan-session_usage/REQ-2`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-9`, `plan-session_usage/REQ-11`, `plan-session_usage/REQ-13`, `plan-session_usage/REQ-18`
- `plan-session_usage/REQ-23`, `plan-session_usage/REQ-29`, `plan-session_usage/REQ-30`, `plan-session_usage/REQ-32`, `plan-session_usage/REQ-33`, `plan-session_usage/REQ-34`

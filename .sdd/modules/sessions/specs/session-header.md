---
module: sessions
component: SessionHeader
type: UI component
---

# SessionHeader

**Purpose** → the 40 px subbar of the open session, as "Session Info Subbar" of `.sdd/mockups/studio-dark/mock.html`: folder name, "/", path, a line chip, the usage chips, the state pill and the actions.

## Contract

Props:
- `session` → `{ folder, label, state, usage? }` of the open session. Optional.
- `actions` → the buttons of the session.
- `notice` → extra chips shown after the state pill. Optional.
- `line` → the text of the line chip. Optional; default the label.

Shows:
- a `header`, 40 px high (its bottom line included) in every variant, padding 0 × 16 px, `--bg-surface-1`, 1 px `--border-subtle` line below. Two groups at the two ends, 8 px apart, on one row.
- the left group, 10 px gaps, with `session`:
  - the `h2` with the folder name (the last segment of `folder`), 12/16 px weight 600.
  - "/" in `--text-muted`, hidden from assistive technology.
  - the full folder path, mono 11 px, `--text-secondary`.
  - the line in a `.mono-chip` on surface 2, in `--text-muted` (look of `#subbar-model`). Not shown when the text is empty.
- the right group, 8 px gaps → with `session.usage.context`, the context chip; with `session.usage.tokens`, the tokens chip; with `session.usage.cost`, the cost chip; with `session`, the StateBadge `chip`; then `notice`; then `actions`.
- the context chip → a `.mono-chip` on surface 2: "Context" in `--text-muted`, then "<used> / <window> · <percent>%", e.g. "Context 45.2k / 200k · 23%". `used` and `window` in short form (`shortTokens`), `percent` by `percentOf`.
  - the value is in `--text-secondary` at level `normal`, amber-400 at `warning`, rose-400 at `error` (`usageLevelOf`).
  - no `usage.context` → no chip, never "0%".
- the tokens chip → a `.mono-chip` on surface 2, in `--text-secondary`: "<total> tokens", e.g. "1.3M tokens". `total` = input + output + cacheWrite + cacheRead of `usage.tokens`, in short form (`shortTokens`).
  - it is focusable with the keyboard (Tab).
  - hover or keyboard focus → a popover under the chip, aligned to its right edge, over the content below: four rows "Input", "Output", "Cache write", "Cache read", each with its count in short form. The popover is the chip's description (`role="tooltip"`, `aria-describedby`).
  - pointer away and focus elsewhere → no popover.
  - no `usage.tokens` → no chip, never "0 tokens".
- the cost chip → a `.mono-chip` on surface 2: the amount in `--text-secondary`, then "· estimate at API list prices" in `--text-muted`, e.g. "$1.27 · estimate at API list prices". The amount is `costText(usage.cost.usd)`: "<$0.01" below one cent, "—" when there is no `usd`.
  - `usage.cost.incomplete` → the amber-400 word "incomplete" right after the amount, e.g. "$1.27 incomplete · estimate at API list prices". Its tooltip and accessible name: "Incomplete: the price of a model is unknown".
  - no `usage.cost` → no chip, never "$0.00".
- without `session` → the left group is empty and there is no state pill. `notice` and `actions` still show.
- no project avatar.

## Rules and invariants

- Name, path and line stay on one row each. Text too long is cut with an ellipsis, and its full text is its tooltip (`title`).
- The actions are never cut and never wrap: when the header is too narrow, the name, path and line of the left group shrink first.
- The header never shrinks, and it never scrolls with the content below it.
- The popover of the tokens chip never changes the height of the header: the header stays 40 px on one row.

## Dependencies

- StateBadge, Avatar (`folderNameOf`), usage format (`shortTokens`, `percentOf`, `usageLevelOf`, `costText`, `INCOMPLETE_COST_TEXT`)
- ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client-ui_redesign/REQ-17`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-11`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-30`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53`
- `plan-session_usage/REQ-2`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-9`, `plan-session_usage/REQ-11`, `plan-session_usage/REQ-13`, `plan-session_usage/REQ-18`
- `plan-session_usage/REQ-23`, `plan-session_usage/REQ-29`, `plan-session_usage/REQ-30`, `plan-session_usage/REQ-32`, `plan-session_usage/REQ-33`, `plan-session_usage/REQ-34`

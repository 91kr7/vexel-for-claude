---
module: activity
component: SubagentCard
type: UI component
---

# SubagentCard

**Purpose** → one subagent in the turn tree: what it is, what it does now and for how long.

## Contract

Description:
- an `article` named "Subagent: <type>" ("Subagent" with no type). Surface `--role-card`, 1 px `--role-border-subtle` border, `--radius-card`, padding 8 × 10 px. It takes the width of its grid column.

Props:
- `subagent` → a `TurnSubagent` of useTurn: `{ id, type?, description?, model?, state, startedAt?, endedAt?, latestText?, currentTool?, groups }`.
- `children` → optional content at the bottom of the card: the nested groups, given by TurnTreeView.

Shows, top to bottom:
- first row → the type as a mono chip (cut with an ellipsis, full text as tooltip), and at the right end the state pill:
  - `running` → "Running", emerald.
  - `finished` → "Finished", muted grey.
  - `stopped` → "Stopped", the orange of "Interrupt".
- the description → one line, 11.5 px, weight 600, cut with an ellipsis, full text as tooltip.
- a mono 10 px muted row → the model on the left (cut with an ellipsis, full text as tooltip), the duration on the right:
  - running → the time since `startedAt` in the short form (ElapsedTime), counting up every second.
  - finished or stopped → `shortDuration(endedAt - startedAt)`, fixed.
- the latest text → at most two lines, cut with an ellipsis at the end of the second, full text as tooltip. The look of the latest-text line: 11.5 px, `--text-secondary`.
- the current tool → one line in the look of the running-tool line (mono 10 px, muted): "<name>: <argument>", or "<name>" with no argument, cut with an ellipsis; then "+N" when `others` is N > 0. Tooltip: the whole line.
- `children`.

## Rules and invariants

- A missing field leaves its place empty, and the other fields keep their place: no type → no chip; no description, no model, no latest text, no current tool → an empty line; no `startedAt`, or a finished subagent with no valid `endedAt` → no duration.
- The card has no action of its own.

## Dependencies

- ElapsedTime, shortDuration, useTurn (types)
- WebEntry (`mono-chip`), ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-32`, `plan-session_activity/REQ-33`, `plan-session_activity/REQ-34`, `plan-session_activity/REQ-35`, `plan-session_activity/REQ-36`, `plan-session_activity/REQ-44`

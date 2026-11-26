---
module: activity
component: SubagentCard
type: UI component
---

# SubagentCard

**Purpose** → one subagent in the turn tree: what it is, what it does now and for how long. It opens the subagent conversation.

## Contract

Description:
- an `article` named "Subagent: <type>" ("Subagent" with no type). Surface `--role-card`, 1 px `--role-border-subtle` border, `--radius-card`. It takes the width of its grid column.
- its own fields are one button named "Open Conversation: <type>" ("Open Conversation" with no type), padding 8 × 10 px. The button turns `--role-hover` on hover. With the keyboard focus it shows the focus ring inside its edge.
- the `children` sit below the button, inside the card, 10 px from its sides and 8 px from its bottom.

Props:
- `subagent` → a `TurnSubagent` of useTurn: `{ id, type?, description?, model?, state, startedAt?, endedAt?, latestText?, currentTool?, groups }`.
- `onOpen(subagent, opener)` → optional. Called by a click on the button, or Enter or Space on it, with this `subagent` and the button element.
- `children` → optional content at the bottom of the card: the nested groups, given by TurnTreeView. A click inside them does not call this card's `onOpen`.

Exports:
- `SubagentStatePill({ state })` → the state pill below, on its own.

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
- The button is the only action of the card.

## Dependencies

- ElapsedTime, shortDuration, useTurn (types)
- WebEntry (`mono-chip`), ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-32`, `plan-session_activity/REQ-33`, `plan-session_activity/REQ-34`, `plan-session_activity/REQ-35`, `plan-session_activity/REQ-36`, `plan-session_activity/REQ-44`, `plan-session_activity/REQ-49`, `plan-session_activity/REQ-55`

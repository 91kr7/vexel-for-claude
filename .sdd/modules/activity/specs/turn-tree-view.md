---
module: activity
component: TurnTreeView
type: UI component
---

# TurnTreeView

**Purpose** → the tree of the current turn inside the turn panel: only its subagents, as a list of rows in start order, nested rows indented, groups joined by a line, the running subagents of earlier turns on top, and scrolling that follows the latest started subagent.

## Contract

Description:
- one scrolling area that fills the panel under its header, padding 12 × 16 px. It is in the Tab order and shows the focus ring inside its edge. It never scrolls sideways.

Props:
- `turn` → the `TurnTree` of useTurn.
- `onOpenSubagent(subagent, opener)` → optional. Given as `onOpen` to every SubagentCard row of the tree, nested and earlier ones included.

Shows, top to bottom, 8 px apart:
- when `earlier` is not empty → a section named "Still running from earlier turns", with that title (11 px, weight 600) and the groups of `earlier`, one under the other, 8 px apart.
- the groups of `groups`, one under the other, in their order.
- a turn with no group → a compact AreaState `empty` "No subagents in this turn." in the place of the groups. It shows also when the section of earlier turns shows.
- a group → the SubagentCard rows of its members, one per id in its order (an id with no subagent shows nothing), one below the other, 8 px apart.
- after each row → the groups of its own `groups` (nested subagents), 8 px apart, one level further right. This holds at any depth.
- no message of the main conversation: no user message, no text of Claude, no tool call.

Levels and width:
- a group of `groups` or of `earlier` is at level 0. A group in the `groups` of a row of level n is at level n + 1. Its rows are at its level.
- every level starts with a gutter of 14 px, level 0 included. A row of level n starts n + 1 gutters from the left edge of the content and ends at its right edge.
- so, at the smallest width of the panel (360 px), a row of level 3 is at least 240 px wide.
- a row is never wider than its place, at any depth.

Mark of a group:
- a group of two or more shown rows → one vertical line in the middle of the gutter of its level, from the tick of its first row to the tick of its last row. Between two members it also runs beside the rows nested under the first one.
- a tick → a short horizontal line from the line to the left edge of a member row, 19 px below the top of the row (the middle of its first line).
- the rows nested under a member have no tick on that line: they start one level further right.
- a group of one shown row → no line and no tick. Its gutter stays empty, so the rows of one level line up.
- line and tick → 1 px, `--role-border-strong` (`--border-pill`). They are hidden from assistive technologies.

Scrolling:
- the latest started subagent → the subagent of `subagents` with the latest `startedAt`, at any level, nested and earlier ones included. A subagent with no valid `startedAt` does not count. On equal starts, the one later in `subagents`.
- at first → the view follows.
- while the view follows, at first and at each new or changed tree → the view scrolls the least it needs to show the whole row of the latest started subagent. A row taller than the view shows from its top. No latest started subagent → the view does not move.
- the view is at the end when its bottom is within 8 px of the end of the content.
- a user scroll up that leaves the view not at the end → the view stops following. It does not move when the tree changes.
- a user scroll that reaches the end → the view follows again.
- the scrolls that the view makes itself, and the moves of the content when the tree changes, do not change whether it follows.

## Rules and invariants

- It sends nothing. Its only actions are the buttons of the rows.

## Dependencies

- SubagentCard, useTurn (types)
- AreaState, ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-38`, `plan-session_activity/REQ-39`, `plan-session_activity/REQ-45`, `plan-session_activity/REQ-46`, `plan-session_activity/REQ-47`, `plan-session_activity/REQ-49`
- `plan-subagent_panel/REQ-1`, `plan-subagent_panel/REQ-2`, `plan-subagent_panel/REQ-3`, `plan-subagent_panel/REQ-4`, `plan-subagent_panel/REQ-5`
- `plan-subagent_panel/REQ-8`, `plan-subagent_panel/REQ-9`, `plan-subagent_panel/REQ-10`, `plan-subagent_panel/REQ-11`, `plan-subagent_panel/REQ-12`, `plan-subagent_panel/REQ-13`

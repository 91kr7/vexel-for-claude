---
module: activity
component: TurnTreeView
type: UI component
---

# TurnTreeView

**Purpose** → the tree of the current turn inside the turn panel: only its subagents, in start order, with the running subagents of earlier turns on top, and scrolling that follows the latest started subagent.

## Contract

Description:
- one scrolling area that fills the panel under its header, padding 12 × 16 px. It is in the Tab order and shows the focus ring inside its edge.

Props:
- `turn` → the `TurnTree` of useTurn.
- `onOpenSubagent(subagent, opener)` → optional. Given as `onOpen` to every SubagentCard of the tree, nested and earlier ones included.

Shows, top to bottom, 8 px apart:
- when `earlier` is not empty → a section named "Still running from earlier turns", with that title (11 px, weight 600) and one group of the cards of `earlier`.
- the groups of `groups`, one under the other, in their order.
- a turn with no group → a compact AreaState `empty` "No subagents in this turn." in the place of the groups. It shows also when the section of earlier turns shows.
- a group → a grid of SubagentCards, one per id in its order (an id with no subagent shows nothing), in columns of at least 180 px that fill the width and wrap to new rows, 8 px apart. Inside a narrow card, one full-width column.
- each card holds, at its bottom, the groups of its own `groups` (nested subagents), in the same way.
- no message of the main conversation: no user message, no text of Claude, no tool call.

Scrolling:
- the latest started subagent → the subagent of `subagents` with the latest `startedAt`, at any level, nested and earlier ones included. A subagent with no valid `startedAt` does not count. On equal starts, the one later in `subagents`.
- at first → the view follows.
- while the view follows, at first and at each new or changed tree → the view scrolls the least it needs to show the whole card of the latest started subagent. A card taller than the view shows from its top. No latest started subagent → the view does not move.
- the view is at the end when its bottom is within 8 px of the end of the content.
- a user scroll up that leaves the view not at the end → the view stops following. It does not move when the tree changes.
- a user scroll that reaches the end → the view follows again.
- the scrolls that the view makes itself, and the moves of the content when the tree changes, do not change whether it follows.

## Rules and invariants

- It sends nothing. Its only actions are the buttons of the cards.

## Dependencies

- SubagentCard, useTurn (types)
- AreaState, ThemeTokens (module app)

## Requirements served

- `plan-session_activity/REQ-37`, `plan-session_activity/REQ-38`, `plan-session_activity/REQ-39`, `plan-session_activity/REQ-45`, `plan-session_activity/REQ-46`, `plan-session_activity/REQ-47`, `plan-session_activity/REQ-49`
- `plan-subagent_panel/REQ-1`, `plan-subagent_panel/REQ-2`, `plan-subagent_panel/REQ-3`, `plan-subagent_panel/REQ-4`, `plan-subagent_panel/REQ-5`

---
module: activity
component: TurnTreeView
type: UI component
---

# TurnTreeView

**Purpose** → the tree of the current turn inside the turn panel: the steps in order, the subagent groups at their steps, the running subagents of earlier turns, with scrolling that follows the latest step.

## Contract

Description:
- one scrolling area that fills the panel under its header, padding 12 × 16 px. It is in the Tab order and shows the focus ring inside its edge.

Props:
- `turn` → the `TurnTree` of useTurn.

Shows, top to bottom:
- when `earlier` is not empty → a section named "Still running from earlier turns", with that title (11 px, weight 600) and one group of the cards of `earlier`.
- when steps are hidden above → the button "Show N earlier steps" ("Show 1 earlier step" for one), N = the hidden steps, at most 200.
- the shown steps, in order, as a list:
  - text step → the text, 12/18 px, `--text-primary`, wrapped.
  - tool step → one mono 11 px row on `--role-chrome` with a 1 px `--role-border-subtle` border and `--radius-card`: the name chip (as the tool cards of ConversationView), the argument (one line cut with an ellipsis, full text as tooltip), then the outcome, mono 10 px: "Running" (muted), "Completed" (emerald-400) or "Error" (rose-400). A missing name, argument or outcome leaves no text.
  - a group whose `step` is the index of this step → the group right under the step.
- a group → a grid of SubagentCards, one per id in its order (an id with no subagent shows nothing), in columns of at least 180 px that fill the width and wrap to new rows, 8 px apart. Inside a narrow card, one full-width column.
- each card holds, at its bottom, the groups of its own `groups` (nested subagents), in the same way.

Long turns:
- at first → the last 200 steps.
- "Show N earlier steps" → 200 more steps above. The view stays on the steps it shows.
- new steps while the view follows (below) → it shows again the last 200 steps; else the shown steps stay and the new ones add at the bottom.
- a group shows only with its step.

Scrolling:
- the view is at the end when its bottom is within 8 px of the end of the content.
- at first → the view shows the end.
- a new or changed tree while the view was at the end at the user's last scroll → the view scrolls to the end.
- the user scrolled up → the view does not move when the tree changes.

## Rules and invariants

- The number of steps in the page does not grow with the length of the turn while the view follows: at most 200 steps, plus the pages the user asked for.
- It sends nothing and has no other action.

## Dependencies

- SubagentCard, useTurn (types)
- ThemeTokens, WebEntry (`button-neutral`) (module app)

## Requirements served

- `plan-session_activity/REQ-29`, `plan-session_activity/REQ-30`, `plan-session_activity/REQ-31`, `plan-session_activity/REQ-37`, `plan-session_activity/REQ-38`, `plan-session_activity/REQ-39`, `plan-session_activity/REQ-42`, `plan-session_activity/REQ-45`, `plan-session_activity/REQ-46`, `plan-session_activity/REQ-47`

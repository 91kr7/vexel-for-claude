---
module: activity
component: SubagentConversation
type: UI component
---

# SubagentConversation

**Purpose** → the read-only conversation of one subagent, inside the Subagents panel (TurnPanel), from its task to its latest step.

## Contract

Description:
- a region named "Subagent Conversation" (`section` with `aria-label`) on `--role-list`. A bar on top, the ConversationBody below it, filling the rest.

Props:
- `sessionId` → the hosted or external session.
- `subagent` → the `TurnSubagent` to show. The bar follows its changes.
- `leftList` → optional, default `false`. `true` → the subagent left the list of the panel.
- `onBack()` → called by "Back" and by Esc.

Shows:
- the bar → padding 8 × 16 px, 8 px gaps, a 1 px `--role-border-subtle` line below. In this order:
  - the button "Back" (`button-neutral`, arrow-left icon).
  - the type as a mono chip, cut with an ellipsis, full text as tooltip. No type → no chip.
  - the description → one line, 12/16 px, weight 600, cut with an ellipsis, full text as tooltip.
  - at the right end, the state pill of SubagentCard: "Running", "Finished" or "Stopped". With `leftList` → no state pill.
- the ConversationBody on SubagentConversationRoute and SubagentItemContentRoute of `sessionId` and `subagent.id`, with the user items named "Task" and the avatar "T". So it shows as the conversation of an external session.

Actions:
- on mount → the focus goes to "Back".
- "Back" (click, Enter or Space) → `onBack()`.
- Esc while the focus is inside the region → `onBack()`. The key goes no further.

## Rules and invariants

- No input field. It sends nothing.
- Each mount opens a new socket. Unmount closes it.

## Dependencies

- SubagentCard (`SubagentStatePill`), useTurn (types), SubagentConversationRoute, SubagentItemContentRoute
- ConversationBody (module external)
- IconSet, ThemeTokens, WebEntry (`button-neutral`, `mono-chip`) (module app)

## Requirements served

- `plan-session_activity/REQ-49`, `plan-session_activity/REQ-50`, `plan-session_activity/REQ-54`, `plan-session_activity/REQ-55`
- `plan-subagent_panel/REQ-22`

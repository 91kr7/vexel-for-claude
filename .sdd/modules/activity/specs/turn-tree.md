---
module: activity
component: turnTreeOf
type: backend function
---

# turnTreeOf

**Purpose** → the tree of the subagents of a session that run now, of any turn, as the Subagents panel shows it, and the parts that changed between two trees.

## Contract

- `turnTreeOf(model, state) → TurnTree` → `model` is the TurnModel of the session, `state` its session state.
- `TurnTree` → `{ number, groups, subagents }`. It carries no step of the main conversation and no turn state.
  - `number` → `model.turnNumber()`.
  - `groups` → the groups of level 0, in start order (below). `SubagentGroup` → `{ subagents }`: the subagent ids.
  - `subagents` → one `TurnSubagent` per running subagent, nested ones included, in the order they became known.
- `noTurn() → TurnTree` → `{ number: 0, groups: [], subagents: [] }`.

```
number is 0 → noTurn()
views = model.subagents(state = "ended")
the tree holds only the views whose state is "running"
```

Place of a running subagent, from its `startedBy.parent` chain:

```
walk up from its startedBy.parent:
    an ended (finished or stopped) ancestor → go on to its own startedBy.parent
    a running ancestor                      → the subagent is in the groups of that ancestor
    no parent, an unknown id, or a loop     → the subagent is at level 0
sort start = the startedAt of its highest ended ancestor; with no ended ancestor, its own startedAt
```

- A loop of running parents with no subagent at level 0 → its first subagent, in the known order, counts as one at level 0. Each subagent shows once.
- So a running subagent whose parent ended takes the place and the level of that parent, up to the nearest running ancestor or level 0.

Groups, for level 0 and for the running children of each subagent of the tree:

```
a subagent with startedBy → grouped with the subagents of the same startedBy.parent (or of the main conversation):
    sorted by startedBy.step (equal steps keep the known order)
    a child joins the group before it when:
        it and the last child of that group both have a startedBy.message → the two messages are the same
        else                                                              → its step is the same, or 1 more,
                                                                            than the last step of that group
    else it starts a new group
a subagent with no startedBy → grouped by its earlierMessage (TurnModel);
                               with no earlierMessage → a group of its own
```

- So the calls of one assistant message form one group, of the current turn or of an earlier one. Calls of two messages form two groups. The agents of one workflow launch share one link, so they stay one group.
- The subagents that one ended parent started by one message stay one group.
- The step rule is only for links with no `message` (a line with no `message.id`). It compares the running siblings only.
- A group holds only running subagents.

Start order, for the subagents of a group and for the groups of one level:

```
start of a subagent    = its startedAt
inside a group         → earlier start first
start of a group       = the earliest sort start of its subagents
among groups           → earlier start of the group first;
                         equal → earlier start of its first subagent first
a missing start sorts last
equal starts, or both missing → the order above (step order, or the known order)
```

`TurnSubagent` → `{ id, type?, description?, model?, state, startedAt?, endedAt?, latestText?, currentTool?, groups }`:

```
type        = meta.agentType, when not empty
description = meta.description, when not empty
model       = meta.model when not empty, else responseModel
state       = the state of the view
startedAt   = the startedAt of the view
endedAt     = lastLineAt, only when the state is not "running"
latestText  = plainExcerpt(lastText, 400), when not empty
currentTool = runningToolOf(openCalls), only when the state is "running" and a call is open
groups      = the groups of its children in the tree, in start order
```

- `turnChangeOf(previous, next) → TurnChange | undefined`
  - `TurnChange` → `{ type: "turn", turn }` (the whole tree), or `{ type: "update", groups?, subagents? }` with only the parts that changed.

```
previous absent, or another number → { type: "turn", turn: next }
groups          → the whole value of next, when different
subagents       → each subagent of next that is new or has a different field
nothing changed → undefined
```

## Rules and invariants

- The input is not changed. `turnTreeOf` reads the model only.
- A new text or tool call of the main conversation changes no part of the tree.
- A finished or stopped subagent is never in the tree, so `endedAt` never shows. A subagent that ends leaves the next tree; an update does not name it.
- The tree has no loop: a nested group never holds a subagent that contains it.

## Dependencies

- TurnModel (`SubagentView`, `StepLink`)
- plainExcerpt, runningToolOf, SessionState of SessionStateTracker (module sessions)

## Requirements served

- `plan-session_activity/REQ-32`, `plan-session_activity/REQ-33`, `plan-session_activity/REQ-34`, `plan-session_activity/REQ-35`, `plan-session_activity/REQ-36`, `plan-session_activity/REQ-37`, `plan-session_activity/REQ-38`, `plan-session_activity/REQ-44`
- `plan-subagent_panel/REQ-1`, `plan-subagent_panel/REQ-3`, `plan-subagent_panel/REQ-10`
- `plan-subagent_panel/REQ-14`, `plan-subagent_panel/REQ-15`, `plan-subagent_panel/REQ-16`, `plan-subagent_panel/REQ-17`, `plan-subagent_panel/REQ-18`, `plan-subagent_panel/REQ-19`

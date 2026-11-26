---
module: activity
component: turnTreeOf
type: backend function
---

# turnTreeOf

**Purpose** → the tree of the current turn of a session, as the turn panel shows it, and the parts that changed between two trees.

## Contract

- `turnTreeOf(model, state) → TurnTree` → `model` is the TurnModel of the session, `state` its session state.
- `TurnTree` → `{ number, status, steps, groups, earlier, subagents }`.
  - `number` → `model.turnNumber()`.
  - `status` → `"none"` when `number` is 0; else `"running"` when `state` is `working` or `needs_input`; else `"ended"`.
  - `steps` → `model.steps()`.
  - `groups` → the groups of subagents started from the main conversation (`SubagentGroup` → `{ step, subagents }`: the index of the step after which the group shows, and the subagent ids).
  - `earlier` → the ids of the running subagents that are not in the tree, in the order they became known.
  - `subagents` → one `TurnSubagent` per subagent in the tree or in `earlier`, nested ones included, in the order they became known.
- `noTurn() → TurnTree` → `{ number: 0, status: "none", steps: [], groups: [], earlier: [], subagents: [] }`.

```
number is 0 → noTurn()
views = model.subagents(state = "ended")

tree     = the views whose startedBy has no parent (started at a step of the current turn),
           then, again and again, the views whose startedBy.parent is a subagent of the tree
earlier  = the running views not in the tree whose parent is not one of them,
           then their children as for the tree;
           a loop of parents with no such view → its first view counts as one of them
each view shows once, under the first parent that reached it
```

Groups, for the main conversation and for each subagent of the tree (its children):

```
children sorted by startedBy.step (equal steps keep the known order)
a child joins the group before it when its step is the same, or 1 more, than the last step of that group
else it starts a new group
group.step = the highest step of its children
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
groups      = the groups of its children
```

- `turnChangeOf(previous, next) → TurnChange | undefined`
  - `TurnChange` → `{ type: "turn", turn }` (the whole tree), or `{ type: "update", status?, steps?, groups?, earlier?, subagents? }` with only the parts that changed.

```
previous absent, another number, or fewer steps in next → { type: "turn", turn: next }
status         → next.status, when different
steps          → [{ index, step }] for each step of next that is not the same object as the step
                 at that index in previous (new steps included)
groups/earlier → the whole value of next, when different
subagents      → each subagent of next that is new or has a different field
nothing changed → undefined
```

## Rules and invariants

- The input is not changed. `turnTreeOf` reads the model only.
- A subagent that left the tree is absent from `subagents`; an update does not name it.
- A finished or stopped subagent is in `subagents` only when it is in the tree, or nested under a subagent that shows.
- The tree has no loop: a nested group never holds a subagent that contains it.

## Dependencies

- TurnModel (`TurnStep`, `SubagentView`)
- plainExcerpt, runningToolOf, SessionState of SessionStateTracker (module sessions)

## Requirements served

- `plan-session_activity/REQ-28`, `plan-session_activity/REQ-31`, `plan-session_activity/REQ-32`, `plan-session_activity/REQ-33`, `plan-session_activity/REQ-34`, `plan-session_activity/REQ-35`, `plan-session_activity/REQ-36`, `plan-session_activity/REQ-37`, `plan-session_activity/REQ-38`, `plan-session_activity/REQ-39`, `plan-session_activity/REQ-40`, `plan-session_activity/REQ-41`, `plan-session_activity/REQ-44`

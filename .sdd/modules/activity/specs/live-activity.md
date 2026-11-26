---
module: activity
component: liveActivityOf
type: backend function
---

# liveActivityOf

**Purpose** → the live activity of a session: whether it is at work, and the latest text of its current turn.

## Contract

- `liveActivityOf(model, state) → LiveActivity` → `model` is the TurnModel of the session, `state` its session state.
- `LiveActivity` → `{ atWork, latestText? }`. `LatestText` → `{ text, subagentType?, at? }`.

```
running = model.subagents(state = "ended") with state "running"
atWork  = state is "working", or state is not "ended" and running is not empty
not atWork → { atWork: false }

candidates = model.mainText() (no type)
             + the latestText of each running subagent (type = its meta.agentType)
latest     = the latest candidate:
                 a is later than b → both "at" known and different → a.at > b.at
                                     else                           → a.order > b.order
no candidate                                  → { atWork: true }
text = plainExcerpt(latest.text, 400); empty  → { atWork: true }
else → { atWork: true, latestText: { text, subagentType?, at? } }
          subagentType → the type of the candidate, when it is a non-empty string
          at           → the "at" of the candidate, when known
```

## Rules and invariants

- `latestText` is present only when `atWork` is true.
- The text of a finished or stopped subagent is never the latest text.
- `text` is plain, on one line, at most 400 characters, with "…" when cut.

## Dependencies

- TurnModel
- plainExcerpt, SessionState of SessionStateTracker (module sessions)

## Requirements served

- `plan-session_activity/REQ-1`, `plan-session_activity/REQ-2`, `plan-session_activity/REQ-3`, `plan-session_activity/REQ-4`, `plan-session_activity/REQ-6`, `plan-session_activity/REQ-13`

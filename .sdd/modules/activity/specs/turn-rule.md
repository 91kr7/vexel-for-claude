---
module: activity
component: startsTurn
type: backend function
---

# startsTurn

**Purpose** → tells whether a line of a main transcript starts a turn, that is a message that the user sends.

## Contract

- `startsTurn(entry) → boolean` → `entry` is one parsed transcript line.
- `isInterruptMarker(text) → boolean` → `true` when `text` starts with "[Request interrupted by user".

```
text = userMessageOf(entry)
text is null                                         → false
isInterruptMarker(text)                              → false   an interrupt
entry.origin.kind is a string other than "human"     → false   added by Claude Code, e.g. "task-notification"
entry.isCompactSummary is true                       → false   summary written after a compaction
text starts with "<task-notification>"               → false   background task notification
anything else                                        → true
```

## Rules and invariants

- `userMessageOf` already gives null for meta, sidechain, command-without-arguments and local-command lines.

## Assumptions

Markers checked on Claude Code 2.1.332, 2026-11-26:

- interrupt → a user line with the text "[Request interrupted by user]" or "[Request interrupted by user for tool use]".
- background task notification → a user line with `origin.kind` "task-notification", `promptSource` "system" and a text that starts with "<task-notification>". A message the user types has `origin.kind` "human". Lines of older versions have no `origin`.
- compaction → a user line with `isCompactSummary: true`.
- the other messages that Claude Code adds by itself (system reminders, skill text, image notes) are meta lines.

## Dependencies

- SessionHistory `userMessageOf` (module history)

## Requirements served

- `plan-session_activity/REQ-10`

---
module: sessions
component: sessionToOpen
type: frontend function
---

# sessionToOpen

**Purpose** → picks the session that a navigation shortcut opens: previous, next, position 1 to 9, or next that needs input.

## Contract

- `NavigationTarget` → `{ kind: 'previous' }`, `{ kind: 'next' }`, `{ kind: 'position', position }` or `{ kind: 'next-needs-input' }`.
- `sessionToOpen(sessions, order, openSessionId, target) → string | null` → the id of the session to open, or `null` for none. The inputs are not changed.
- the list → the sessions of `groupSessions(sessions, order)`, group after group, top to bottom: the order the session list shows.
- "the open entry" → the entry of the list whose id is `openSessionId`. With `openSessionId` `null`, or with an id the list does not have, there is no open entry.

```
previous:
  open entry at index i → the entry at i - 1; none when i is 0
  no open entry         → the last entry
next:
  open entry at index i → the entry at i + 1; none after the last entry
  no open entry         → the first entry
position n:
  n is an integer from 1 → the entry at index n - 1; none when the list is shorter
  otherwise              → none
next-needs-input:
  start → the entry after the open entry; the first entry with no open entry
  the first entry in state needs_input, going down from start and wrapping to the top
  the open entry itself is checked last
  no entry in state needs_input → none
```

- an empty list → `null` for every target.
- `position` may give the open session itself.

## Dependencies

- groupSessions

## Requirements served

- `plan-keyboard_shortcuts/REQ-4`, `plan-keyboard_shortcuts/REQ-5`, `plan-keyboard_shortcuts/REQ-6`, `plan-keyboard_shortcuts/REQ-7`, `plan-keyboard_shortcuts/REQ-8`, `plan-keyboard_shortcuts/REQ-43`

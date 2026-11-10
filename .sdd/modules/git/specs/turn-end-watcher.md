---
module: git
component: useTurnEndSignal
type: frontend hook
---

# useTurnEndSignal

**Purpose** → tells the git explorer when a session in its repository ends a turn.

## Contract

- `turnEndedInRepository(previous, next, root) → boolean` → `true` when at least one session of `next`:
  - had state `working` in `previous` (same `id`) and has state `idle` in `next`;
  - and has a `folder` equal to `root` or under it (`root` + `/` + more).
- `useTurnEndSignal(sessions, root | undefined, onTurnEnd)` → calls `onTurnEnd()` once each time the session list changes and `turnEndedInRepository(last list, new list, root)` is `true`.
  - the first list seen gives no signal.
  - `root` `undefined` → no signal.

## Rules and invariants

- Hosted and external sessions count the same; the open session counts too.
- Paths compare as text, after removing a trailing `/`. A folder reached through a symbolic link does not match.
- A session that appears already `idle`, or leaves the list, gives no signal. A change to `needs_input` or `ended` gives no signal.
- A turn the user interrupts counts: it is a change from `working` to `idle`.

## Dependencies

- LiveSessionStore (module sessions): the `SessionSummary` list

## Requirements served

- `plan-git_explorer/REQ-25`

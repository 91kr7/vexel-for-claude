---
module: git
component: useTurnEndSignal
type: frontend hook
---

# useTurnEndSignal

**Purpose** → tells the git explorer when a session in or above one of its covered repositories ends a turn.

## Contract

- `turnEndedInRepository(previous, next, roots) → boolean` → `true` when at least one session of `next`:
  - had state `working` in `previous` (same `id`) and has state `idle` in `next`;
  - and, for at least one root of `roots`, has a `folder` equal to the root, under it (root + `/` + more), or above it (the root is under the `folder`).
- `useTurnEndSignal(sessions, roots, onTurnEnd)` → calls `onTurnEnd()` once each time the session list changes and `turnEndedInRepository(last list, new list, roots)` is `true`.
  - the first list seen gives no signal.
  - `roots` empty → no signal.
  - a change of `roots` alone gives no signal.

## Rules and invariants

- Hosted and external sessions count the same; the open session counts too.
- Paths compare as text, after removing a trailing `/`. A folder reached through a symbolic link does not match.
- A session that appears already `idle`, or leaves the list, gives no signal. A change to `needs_input` or `ended` gives no signal.
- A turn the user interrupts counts: it is a change from `working` to `idle`.

## Dependencies

- LiveSessionStore (module sessions): the `SessionSummary` list

## Requirements served

- `plan-multi_repo_workspace/REQ-11`

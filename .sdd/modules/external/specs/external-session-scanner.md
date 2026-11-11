---
module: external
component: ExternalSessionScanner
type: backend service
---

# ExternalSessionScanner

**Purpose** → keeps the list of the Claude Code sessions that run in other terminals, and notifies each addition, change and removal.

## Contract

- `new ExternalSessionScanner(deps)`
  - `deps.check` → ExternalSessionCheck: gives the live session files the client does not host.
  - `deps.history` → SessionHistory: gives the first user message of a session.
  - `deps.hostedPids()` → the pids of the processes the client hosts (SessionRegistry `hostedPids`).
  - `deps.names` → SessionNameStore. Default: none, so no names.
  - `deps.favorites` → SessionFavoriteStore. Default: none, so no favorites.
  - `deps.intervalMs` → time between two scans. Default: 2000.
  - `deps.now()` → the current time. Default: the system clock.
- `scan() → Promise<void>` → one scan. It updates the list and notifies the differences.
- `start()` → one scan now, then one scan `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more scans.
- `list() → ExternalSessionSummary[]` → the current entries, a copy.
- `get(id) → ExternalSessionSummary | undefined` → the current entry with that id.
- `onChange(listener) → unsubscribe` → `listener(change)` for each difference found by a scan, and for each name or favorite change of a listed id:
  - `{ type: "session", session }` → an entry was added or one of its fields changed.
  - `{ type: "session-removed", id }` → an entry left the list.

`ExternalSessionSummary` → `{ id, folder, label, state, lastActivity, external: true, favorite? }`:

- `id` → the `sessionId` of the session file.
- `folder` → the `cwd` of the session file.
- `state` → `status` `"busy"` gives `"working"`. `"waiting"` (Claude Code waits for the user) gives `"needs_input"`. Any other value, or none, gives `"idle"`.
- `lastActivity` → `updatedAt` (milliseconds since the epoch) as ISO-8601. No number → the time of the scan that first found the entry.
- `label` → the name of `id` in SessionNameStore when it has one. Else the default label: the first user message (SessionHistory `get(id)`), whitespace collapsed, cut to 80 characters. No message yet → the last name of `folder`.

Which session files count:

```
ExternalSessionCheck.runningSessions(hostedPids()) gives the live, not hosted files
keep a file only if kind = "interactive" and cwd is a non-empty string
two files with the same sessionId → one entry, from the file with the higher updatedAt
```

## Rules and invariants

- A scan that finds the same data as the previous one notifies nothing.
- A name change of a listed id that changes its label → `{ type: "session", session }` at once, with no scan. A name change of an id that is not listed notifies nothing.
- `favorite` → `true` when `id` has the mark in SessionFavoriteStore. Otherwise the field is absent. A change of the mark of a listed id → `{ type: "session", session }` at once, with no scan. A change of an id that is not listed notifies nothing.
- Once the label comes from a user message, the scanner does not read the transcript again for that entry.
- A failed scan changes nothing. The next scan runs as usual.
- It never writes under the Claude Code folder. It never opens the `<pid>.<hash>.key` files (ExternalSessionCheck rule).

## Dependencies

- ExternalSessionCheck, SessionHistory (module history)
- SessionRegistry (module sessions), through `hostedPids()`
- SessionNameStore, SessionFavoriteStore (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`, `plan-claude_sessions_client/REQ-31`, `plan-claude_sessions_client/REQ-32`, `plan-claude_sessions_client/REQ-36`
- `plan-favorite_session/REQ-2`, `plan-favorite_session/REQ-3`, `plan-favorite_session/REQ-8`, `plan-favorite_session/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-25`
- `plan-session_list_improvements/REQ-25`, `plan-session_list_improvements/REQ-27`, `plan-session_list_improvements/REQ-28`, `plan-session_list_improvements/REQ-37`

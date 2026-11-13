---
module: external
component: ExternalSessionScanner
type: backend service
---

# ExternalSessionScanner

**Purpose** → keeps the list of the Claude Code sessions that run in other terminals, keeps a session whose terminal closed as ended until it is dismissed or resumed in the client, and notifies each addition, change and removal.

## Contract

- `new ExternalSessionScanner(deps)`
  - `deps.check` → ExternalSessionCheck: gives the live session files the client does not host.
  - `deps.history` → SessionHistory: gives the first user message of a session.
  - `deps.hostedPids()` → the pids of the processes the client hosts (SessionRegistry `hostedPids`).
  - `deps.hostedSessionIds()` → the Claude Code session ids of the hosted sessions that have not ended (SessionStateTracker `liveClaudeSessionIds`). Default: none, so an ended entry never leaves by itself.
  - `deps.names` → SessionNameStore. Default: none, so no names.
  - `deps.favorites` → SessionFavoriteStore. Default: none, so no favorites.
  - `deps.intervalMs` → time between two scans. Default: 2000.
  - `deps.now()` → the current time. Default: the system clock.
- `scan() → Promise<void>` → one scan. It updates the list and notifies the differences.
- `start()` → one scan now, then one scan `intervalMs` after the end of the previous one. A second `start()` changes nothing.
- `stop()` → no more scans.
- `list() → ExternalSessionSummary[]` → the current entries, a copy.
- `get(id) → ExternalSessionSummary | undefined` → the current entry with that id, ended entries included.
- `dismiss(id) → boolean` → removes an ended entry and notifies `{ type: "session-removed", id }`. `false`, with no change, when `id` is unknown or its entry has not ended.
- `onChange(listener) → unsubscribe` → `listener(change)` for each difference found by a scan, and for each name or favorite change of a listed id:
  - `{ type: "session", session }` → an entry was added or one of its fields changed.
  - `{ type: "session-removed", id }` → an entry left the list.

`ExternalSessionSummary` → `{ id, folder, label, state, lastActivity, external: true, resumable?, favorite? }`:

- `id` → the `sessionId` of the session file.
- `folder` → the `cwd` of the session file.
- `state` → `status` `"busy"` gives `"working"`. `"waiting"` (Claude Code waits for the user) gives `"needs_input"`. Any other value, or none, gives `"idle"`. An entry whose session file is no longer found gives `"ended"`.
- `resumable` → `true` on an ended entry whose conversation is saved: SessionHistory `get(id)` gives it with a folder. Absent otherwise, and on a running entry.
- `lastActivity` → `updatedAt` (milliseconds since the epoch) as ISO-8601. No number → the time of the scan that first found the entry.
- `label` → the name of `id` in SessionNameStore when it has one. Else the default label: the first user message (SessionHistory `get(id)`), whitespace collapsed, cut to 80 characters. No message yet → the last name of `folder`.

Which session files count:

```
ExternalSessionCheck.runningSessions(hostedPids()) gives the live, not hosted files
keep a file only if kind = "interactive" and cwd is a non-empty string
two files with the same sessionId → one entry, from the file with the higher updatedAt
```

End of a session:

```
listed entry, its file no longer found by a scan:
  its id is in hostedSessionIds()   → removed: { type: "session-removed", id }   (resumed in the client)
  else, not ended yet               → state "ended", resumable when saved: { type: "session", session }
  else                              → nothing (stays ended, same fields)
ended entry found again by a scan   → running again: state from the file, no resumable
```

- An ended entry keeps its label, name and favorite mark. It stays until `dismiss(id)`, until its id runs in the client, or until the server restarts: ended entries live in memory only.
- A dismissed id does not come back as ended. When its conversation runs again in a terminal, a scan lists it as a running entry.

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
- SessionStateTracker (module sessions), through `hostedSessionIds()`
- SessionNameStore, SessionFavoriteStore (module sessions)

## Requirements served

- `plan-claude_sessions_client/REQ-29`, `plan-claude_sessions_client/REQ-30`, `plan-claude_sessions_client/REQ-31`, `plan-claude_sessions_client/REQ-32`, `plan-claude_sessions_client/REQ-36`
- `plan-favorite_session/REQ-2`, `plan-favorite_session/REQ-3`, `plan-favorite_session/REQ-8`, `plan-favorite_session/REQ-9`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-17`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-25`
- `plan-session_list_improvements/REQ-25`, `plan-session_list_improvements/REQ-27`, `plan-session_list_improvements/REQ-28`, `plan-session_list_improvements/REQ-37`
- `plan-wsl_support/REQ-7`, `plan-wsl_support/REQ-8`, `plan-wsl_support/REQ-9`, `plan-wsl_support/REQ-12`, `plan-wsl_support/REQ-14`, `plan-wsl_support/REQ-15`

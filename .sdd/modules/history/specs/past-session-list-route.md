---
module: history
component: PastSessionListRoute
type: REST endpoint
---

# PastSessionListRoute

**Purpose** → gives the page the past sessions it can resume, grouped by project folder.

## Contract

- `GET /api/past-sessions` → `200`. Body: array of groups.
  - group → `{ folder, sessions }`.
  - session → `{ id, label, lastActivity, runningElsewhere, favorite? }`.
    - `id` → the Claude Code session id (SessionHistory).
    - `label` → the name of `id` in SessionNameStore when it has one. Else the first user message, cut with the label rule of SessionStateTracker (one space per whitespace run, trimmed, first 80 characters).
    - `lastActivity` → the last change of the session file, ISO-8601 UTC string.
    - `favorite` → `true` when SessionFavoriteStore has the mark of `id`. Otherwise the field is absent. A session dismissed or ended in the list keeps it.
    - `runningElsewhere` → `true` when ExternalSessionCheck lists the id. The hosted pids it gets are those of the registry sessions whose process has not ended.

## Rules and invariants

- Sessions without a folder or without a first user message are left out.
- Sessions that the client hosts and that have not ended are left out (SessionStateTracker `liveClaudeSessionIds()`).
- Inside a group, the most recent session comes first. Groups come in the order of their most recent session.
- One group per folder. No empty group.

## Dependencies

- SessionHistory, ExternalSessionCheck
- SessionRegistry, SessionStateTracker, SessionNameStore, SessionFavoriteStore (module sessions). The name store and the favorite store are optional: without them, no names and no favorites.

## Requirements served

- `plan-claude_sessions_client/REQ-25`, `plan-claude_sessions_client/REQ-26`, `plan-claude_sessions_client/REQ-27`
- `plan-favorite_session/REQ-4`, `plan-favorite_session/REQ-5`, `plan-favorite_session/REQ-10`
- `plan-session_list_improvements/REQ-29`, `plan-session_list_improvements/REQ-30`

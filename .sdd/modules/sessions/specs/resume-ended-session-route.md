---
module: sessions
component: ResumeEndedSessionRoute
type: REST endpoint
---

# ResumeEndedSessionRoute

**Purpose** → resumes an ended hosted session from its list entry, and removes its ended entry in the same call.

## Contract

- `registerResumeEndedSessionRoute(app, { tracker, history, registry, externalCheck })` → SessionStateTracker, SessionHistory, SessionRegistry, ExternalSessionCheck.
- `POST /api/sessions/:id/resume` → body `{ force? }`. `force: true` skips the running-elsewhere check. Any other value, or no `force`, does not.
  - `201` → a new hosted session resumes the conversation. Body: `{ id }`, the id of the new hosted session.
  - `404` → the tracker has no session `:id`, or it knows no Claude Code session id for it. Body: `{ error: "session_not_found" }`.
  - `409` → the session has not ended. Body: `{ error: "not_ended" }`.
  - `409` → without `force`, the Claude Code session id is among the ids of ExternalSessionCheck `runningSessionIds`, called with the pids of the hosted sessions that have not exited. Body: `{ error: "running_elsewhere" }`.
  - `404` → `resumePastSession` (ResumeSessionRoute) fails. Body: its `{ error }`, `session_not_found` or `folder_not_found`.
- effect on `201` → `resumePastSession` with the Claude Code session id of `:id`, then SessionStateTracker `dismiss(id)`.

Order of the checks:

```
unknown id                                  → 404 session_not_found
state is not ended                          → 409 not_ended
no Claude Code session id                   → 404 session_not_found
not force and the id runs elsewhere         → 409 running_elsewhere
resumePastSession gives an error            → 404 with that error
otherwise                                   → 201 { id }, old entry dismissed
```

## Rules and invariants

- On any error no session starts and the ended entry stays.
- On `201` the tracker first lists the new session, then removes the old entry. The list never holds the old and the new entry for the same conversation after the answer.
- With `force: true`, ExternalSessionCheck is not called.

## Dependencies

- SessionStateTracker, SessionRegistry
- ResumeSessionRoute (`resumePastSession`), SessionHistory, ExternalSessionCheck (module history)

## Requirements served

- `plan-session_list_improvements/REQ-8`, `plan-session_list_improvements/REQ-9`, `plan-session_list_improvements/REQ-11`, `plan-session_list_improvements/REQ-12`

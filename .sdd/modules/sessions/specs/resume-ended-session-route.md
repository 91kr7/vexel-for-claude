---
module: sessions
component: ResumeEndedSessionRoute
type: REST endpoint
---

# ResumeEndedSessionRoute

**Purpose** → resumes an ended session, hosted or external, from its list entry, and removes its ended entry in the same call.

## Contract

- `registerResumeEndedSessionRoute(app, { tracker, history, registry, externalCheck, scanner? })` → SessionStateTracker, SessionHistory, SessionRegistry, ExternalSessionCheck, and the ExternalSessionScanner (module external). No scanner → only hosted sessions.
- `POST /api/sessions/:id/resume` → body `{ force? }`. `force: true` skips the running-elsewhere check. Any other value, or no `force`, does not.
  - `201` → a new hosted session resumes the conversation. Body: `{ id }`, the id of the new hosted session.
  - `404` → neither the tracker nor the scanner has a session `:id`, or the tracker knows no Claude Code session id for it. Body: `{ error: "session_not_found" }`.
  - `409` → the session has not ended. Body: `{ error: "not_ended" }`.
  - `409` → without `force`, the Claude Code session id is among the ids of ExternalSessionCheck `runningSessionIds`, called with the pids of the hosted sessions that have not exited. Body: `{ error: "running_elsewhere" }`.
  - `404` → `resumePastSession` (ResumeSessionRoute) fails. Body: its `{ error }`, `session_not_found` or `folder_not_found`.
- effect on `201` → `resumePastSession` with the Claude Code session id of `:id`, then SessionStateTracker `dismiss(id)`.
- an ended external entry (the tracker has no `:id`, the scanner has it) → the same checks with `:id` as the Claude Code session id, then `resumePastSession(:id)` and ExternalSessionScanner `dismiss(id)`.

Order of the checks:

```
id unknown to the tracker and the scanner   → 404 session_not_found
id only in the scanner                      → the external branch below
unknown id                                  → 404 session_not_found
state is not ended                          → 409 not_ended
no Claude Code session id                   → 404 session_not_found
not force and the id runs elsewhere         → 409 running_elsewhere
resumePastSession gives an error            → 404 with that error
otherwise                                   → 201 { id }, old entry dismissed
```

External branch:

```
state is not ended                          → 409 not_ended
not force and the id runs elsewhere         → 409 running_elsewhere
resumePastSession gives an error            → 404 with that error
otherwise                                   → 201 { id }, external entry dismissed
```

## Rules and invariants

- On any error no session starts and the ended entry stays.
- On `201` the tracker first lists the new session, then removes the old entry. The list never holds the old and the new entry for the same conversation after the answer.
- With `force: true`, ExternalSessionCheck is not called.

## Dependencies

- SessionStateTracker, SessionRegistry
- ExternalSessionScanner (module external)
- ResumeSessionRoute (`resumePastSession`), SessionHistory, ExternalSessionCheck (module history)

## Requirements served

- `plan-session_list_improvements/REQ-8`, `plan-session_list_improvements/REQ-9`, `plan-session_list_improvements/REQ-11`, `plan-session_list_improvements/REQ-12`

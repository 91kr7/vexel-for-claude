---
module: external
component: ResumeHereButton
type: UI component
---

# ResumeHereButton

**Purpose** → the "Riprendi qui" action of an external session: it resumes the session in the client after a warning.

## Contract

Props:
- `sessionId` → the Claude Code session id of the external session.
- `onResumed(id)` → called with the id of the new hosted session.

Shows:
- the button "Riprendi qui". While the request runs it shows the Spinner (ProgressIndicator) in place of its icon, is disabled and has `aria-busy="true"`.
- an ErrorMessage after a failed request:
  - `404` `session_not_found` → "La sessione non esiste più."
  - `404` `folder_not_found` → "La cartella del progetto non esiste."
  - any other failure → "Ripresa della sessione non riuscita."

Actions:
- click → shows RunningElsewhereWarning. Nothing is sent yet.
- "Annulla" in the warning → the warning closes. Nothing is sent.
- "Riprendi comunque" → the warning closes, then `POST /api/past-sessions/<sessionId>/resume` (ResumeSessionRoute).
  - `201` → `onResumed(id)` with the `id` of the body.

## Rules and invariants

- It always shows the warning before the request: an external session runs in another terminal by definition.

## Dependencies

- RunningElsewhereWarning, ResumeSessionRoute (module history)
- ProgressIndicator, ErrorMessage (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-35`
- `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`

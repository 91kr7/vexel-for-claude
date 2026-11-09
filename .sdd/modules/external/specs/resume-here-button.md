---
module: external
component: ResumeHereButton
type: UI component
---

# ResumeHereButton

**Purpose** → the "Resume Here" action of an external session: it resumes the session in the client after a warning.

## Contract

Props:
- `sessionId` → the Claude Code session id of the external session.
- `onResumed(id)` → called with the id of the new hosted session.

Shows:
- the button "Resume Here" → `.button-primary .button-bar` (32 px high, 8 px radius, 12 px weight 500, `--on-accent` text on `--accent-primary`) with the log-in icon at 14 px. While the request runs it shows the Spinner (ProgressIndicator) in place of its icon, is disabled and has `aria-busy="true"`.
- an ErrorMessage after a failed request:
  - `404` `session_not_found` → "The session no longer exists."
  - `404` `folder_not_found` → "The project folder does not exist."
  - any other failure → "Could not resume the session."

Actions:
- click → shows RunningElsewhereWarning. Nothing is sent yet.
- "Cancel" in the warning → the warning closes. Nothing is sent.
- "Resume Anyway" → the warning closes, then `POST /api/past-sessions/<sessionId>/resume` (ResumeSessionRoute).
  - `201` → `onResumed(id)` with the `id` of the body.
- shortcut command `resume` (ShortcutChannel), while no request runs → acts as a click: the warning shows first. While a request runs, the command does nothing.

## Rules and invariants

- It always shows the warning before the request: an external session runs in another terminal by definition.

## Dependencies

- RunningElsewhereWarning, ResumeSessionRoute (module history)
- ProgressIndicator, ErrorMessage, ShortcutChannel, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-35`
- `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-35`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-43`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-33`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`
- `plan-keyboard_shortcuts/REQ-19`, `plan-keyboard_shortcuts/REQ-20`

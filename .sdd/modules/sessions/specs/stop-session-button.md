---
module: sessions
component: StopSessionButton
type: UI component
---

# StopSessionButton

**Purpose** → the "Terminate" button of the open session, with its confirmation.

## Contract

Props:
- `sessionId` → the session to stop.
- `state` → its current state, or `undefined` when the page does not know it yet.
- `folderName` → the name of the session folder, optional. The confirmation shows it.

Shows:
- `state` is `ended` → nothing. The button disappears also while the confirmation is open.
- any other `state`, `undefined` included → the button "Terminate": `.button-danger` (rose, look of `#subbar-stop-btn`) with the decorative glyph "■" before the text. Its accessible name is "Terminate".
- while the stop runs → "Terminate" shows the Spinner (ProgressIndicator) in place of "■", is disabled and has `aria-busy="true"`. It stays so after a `2xx` answer, until `state` becomes `ended` and the button disappears.
- a failed stop → the button is enabled again, and an ErrorMessage "Could not terminate the session." shows next to it. The next stop request hides the message.

Actions:
- "Terminate", `state` is `working` → opens a WarningDialog in the `error` tone (rose primary action), the title "Terminate the Session?", the buttons "Cancel" (focused) and "Terminate" (primary action). No request yet.
  - its text → "**<folderName>** is still working. The current turn will be interrupted. You can resume the conversation from the history." The folder name is bold, in `--text-primary`. Without `folderName` the text starts with "The session", not bold.
  - "Cancel" or Esc → the dialog closes. No request.
  - "Terminate" → the dialog closes and the stop request leaves.
- "Terminate", any other `state` → the stop request leaves at once.
- stop request → `POST /api/sessions/:id/stop`, no body. A network error or a non-`2xx` answer is a failed stop.

## Dependencies

- StopSessionRoute
- WarningDialog, ProgressIndicator, ErrorMessage, ThemeTokens, WebEntry (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-23`, `plan-claude_sessions_client/REQ-24`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-28`, `plan-claude_sessions_client-ui_redesign/REQ-30`, `plan-claude_sessions_client-ui_redesign/REQ-31`, `plan-claude_sessions_client-ui_redesign/REQ-32`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-29`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-31`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-34`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-47`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-48`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-52`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-32`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-48`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-5`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-15`

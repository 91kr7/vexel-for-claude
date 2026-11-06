---
module: history
component: RunningElsewhereWarning
type: UI component
---

# RunningElsewhereWarning

**Purpose** → warns that a session still runs in another terminal before the user resumes it. Any page can use it.

## Contract

Description:
- a WarningDialog in the `attn` (amber) tone: the text in the amber banner with the triangle icon, and an amber primary action. It opens on top of the page and of other dialogs.

Props:
- `onConfirm()` → called on "Resume Anyway".
- `onCancel()` → called on "Cancel", "[Esc]" and Esc.

Shows:
- the title "Session Running in a Terminal".
- the text, in the banner, "This session is still running in another terminal. If you resume it here too, the two instances can damage the conversation."
- the buttons "Cancel" (focused) and "Resume Anyway" (primary action, `.button-attn`).

## Rules and invariants

- It sends no request. The caller does the resume after `onConfirm()`.
- Esc closes only the warning. A dialog below it stays open.

## Dependencies

- WarningDialog (module app)

## Requirements served

- `plan-claude_sessions_client/REQ-27`
- `plan-claude_sessions_client-ui_redesign/REQ-25`, `plan-claude_sessions_client-ui_redesign/REQ-26`, `plan-claude_sessions_client-ui_redesign/REQ-27`, `plan-claude_sessions_client-ui_redesign/REQ-28`
- `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-50`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-49`
- `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-3`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui/REQ-4`

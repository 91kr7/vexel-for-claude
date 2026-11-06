---
module: desktop
component: NotificationTexts
type: backend service
---

# NotificationTexts

**Purpose** → the English title and body of each notification, as plain text.

## Contract

- `notificationTitle(folder, label)` → `"<folder name> · <label>"`. The folder name is the last non-empty segment of `folder` split on `/`. A folder with no such segment is its own name. This is the rule of `folderNameOf` (Avatar, module sessions).
- `needsInputBody(waitingTool?)` → `"Permission for <waitingTool>"` when `waitingTool` is a non-empty string, else `"Needs your input"`.
- `turnEndBody(excerpt?)` → `excerpt` when it is a non-empty string, else `"Claude finished"`.
- `sessionEndBody(error?)` → `"Session ended with an error"` when `error` is `true`, else `"Session ended"`.
- `notificationTexts(event) → { title, body }` → for an AttentionEvent: `notificationTitle(event.folder, event.label)`, and by `kind`:
  - `needs_input` → `needsInputBody(event.waitingTool)`.
  - `turn_end` → `turnEndBody(event.excerpt)`.
  - `session_end` → `sessionEndBody(event.error)`.

## Rules and invariants

- The texts are plain text. SystemNotifications escapes the body for servers that read markup.

## Requirements served

- `plan-session_notifications/REQ-7`, `plan-session_notifications/REQ-8`, `plan-session_notifications/REQ-9`
- `plan-session_notifications/REQ-16`, `plan-session_notifications/REQ-17`
- `plan-session_notifications/REQ-23`

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
- `notificationTexts(event) → { title, body }` → for an AttentionEvent of kind `needs_input`: `notificationTitle(event.folder, event.label)` and `needsInputBody(event.waitingTool)`.

## Rules and invariants

- The texts are plain text. SystemNotifications escapes the body for servers that read markup.

## Requirements served

- `plan-session_notifications/REQ-7`, `plan-session_notifications/REQ-8`, `plan-session_notifications/REQ-9`

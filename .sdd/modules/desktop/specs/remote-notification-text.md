---
module: desktop
component: RemoteNotificationText
type: backend service
---

# RemoteNotificationText

**Purpose** → the title, the body and the priority of a remote notification, as plain text.

## Contract

- `REMOTE_BODY_MAX_BYTES` → 4,096. `REMOTE_PRIORITY_HIGH` → 4. `SHORTENED_LINE` → `"[Text shortened]"`.
- `remoteNotificationMessage(event, waitedMs) → { title, message, priority }` → for a `needs_input` AttentionEvent:
  - `title` → `notificationTitle(event.folder, event.label)` (NotificationTexts).
  - `priority` → 4, the high priority of ntfy.
  - `message` → lines joined with `\n`:

    ```
    waitingDetail is questions  → "Claude asks:", then for each question: the question,
                                  then one line "- <label>" per option
    else waitingTool non-empty  → "Permission for <waitingTool>",
                                  then the argument text when waitingDetail is an argument
    else                        → "Needs your input"
    last line                   → "Waiting for <N> min", N = floor(waitedMs / 60,000)
    ```

- shortening: the message is longer than 4,096 bytes of UTF-8 →
  `<first line>\n<detail cut>\n[Text shortened]\n<waiting line>`, within 4,096 bytes.
  - the detail is the lines between the first line and the waiting line.
  - the cut keeps the longest start of the detail that fits, and ends at a whole character.

## Rules and invariants

- A message of at most 4,096 bytes is never cut and has no `[Text shortened]` line.
- An argument with no waiting tool gives "Needs your input" with no detail.

## Dependencies

- NotificationTexts, AttentionClient (the `AttentionEvent` shape), NtfyPublisher (the `NtfyMessage` shape)

## Requirements served

- `plan-remote_notifications/REQ-30`, `plan-remote_notifications/REQ-31`, `plan-remote_notifications/REQ-32`, `plan-remote_notifications/REQ-33`, `plan-remote_notifications/REQ-34`, `plan-remote_notifications/REQ-35`, `plan-remote_notifications/REQ-36`

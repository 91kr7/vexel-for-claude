---
module: desktop
component: NotificationRules
type: backend service
---

# NotificationRules

**Purpose** → decides which notification to show and which to close, from the attention events, the needs-input list, the window focus and the open session of the page.

## Contract

- `new NotificationRules({ windowFocused? })` → `windowFocused` defaults to `false`. At start there is no open session and no notification.
- Each method below returns the commands to run, in order. A command is `{ type: "show", event }` or `{ type: "close", sessionId }`.
- `receiveEvent(event)`:

  ```
  event.id received before            → []
  else the window has the focus       → []   (the id now counts as received)
  else                                → [show event]; the session has a notification of kind event.kind
  ```

- `receiveNeedsInput(sessions)` → the list replaces the previous one. One `close` for each session that has a `needs_input` notification and is not in the list.
- `setWindowFocused(focused)` → stores the focus. Focused, and the open session has a notification → `[close <open session>]`. Else `[]`.
- `setOpenSession(sessionId | null)` → stores the open session. The window has the focus, and that session has a notification → `[close <sessionId>]`. Else `[]`.

## Rules and invariants

- Nothing shows while the window has the focus.
- The same event id never gives a second `show`.
- After a `close`, the session has no notification.
- Notifications on screen stay when the window gets the focus. Only the open session's one closes.
- It uses no Electron API.

## Requirements served

- `plan-session_notifications/REQ-3`, `plan-session_notifications/REQ-4`, `plan-session_notifications/REQ-6`, `plan-session_notifications/REQ-11`, `plan-session_notifications/REQ-12`

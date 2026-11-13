---
module: desktop
component: SystemNotifications
type: backend service
---

# SystemNotifications

**Purpose** → shows and closes the notifications of the Linux desktop, one per session, and reports clicks and closes.

## Contract

- `new SystemNotifications({ appName, iconPath, connect? })`
  - `connect()` → opens a NotificationServer (below). Default: the D-Bus session bus, service `org.freedesktop.Notifications`.
  - it connects at the first call that needs the server, not before.
- `show({ sessionId, kind, title, body, replaces? }) → Promise<void>` → one `notify` on the server:
  - `appName`, `appIcon` = `iconPath`, `summary` = `title`.
  - `body` → escaped when the server lists the capability `body-markup`: `&`, `<`, `>` become `&amp;`, `&lt;`, `&gt;`. Else as given.
  - `actions` → `["default", "Open"]`. The `default` action is a click on the notification.
  - by `kind`: `needs_input` → urgency `critical`, expire timeout `0` (never expires). `turn_end` and `session_end` → urgency `normal`, expire timeout `-1` (the server's usual timeout).
  - `replacesId` → the id of the notification of the session `replaces` when it is given, else of `sessionId`. `0` when that session has none. So a notification is replaced in place, with the same id, whatever the kinds of the old and the new one.
  - after the call, the notification belongs to `sessionId`. The session `replaces` has none.
- `close(sessionId) → Promise<void>` → closes the notification of the session. Nothing when it has none.
- `onClick(listener) → unsubscribe` → `listener(sessionId)` when the server reports the `default` action on the notification of that session.
- `onClosed(listener) → unsubscribe` → `listener(sessionId)` when the server reports `NotificationClosed` for the notification of that session. Not for a notification closed by `close`.

`NotificationServer` (the port to the server; tests give a fake one):

- `capabilities() → Promise<string[]>`
- `notify({ replacesId, appName, appIcon, summary, body, actions, urgency, expireTimeoutMs }) → Promise<number>` → the notification id. `urgency` is `"low"`, `"normal"` or `"critical"`.
- `closeNotification(id) → Promise<void>`
- `onActionInvoked(listener(id, actionKey))`, `onNotificationClosed(listener(id))`
- `disconnect()`

The D-Bus server: `GetCapabilities`, `Notify` (urgency as the `urgency` byte hint 0, 1, 2), `CloseNotification`, and the signals `ActionInvoked` and `NotificationClosed`.

## Rules and invariants

- A session has at most one notification.
- When the server reports `NotificationClosed` (closed by the user, expired, or clicked), the notification no longer belongs to its session.
- Calls run one at a time, in call order. A `close` right after a `show` closes that notification.
- It never throws and its promises never reject. A failure (no bus, no server, no reply within 5 seconds) drops the connection, and the next call connects again.
- A failure is logged as one line, `System notification failed: <reason>`, only when its reason differs from the last failure logged. The reason is the error message.
- A call that the server answers with success (`notify` or `closeNotification`) clears the last reason, so the next failure is logged again. A `close` of a session with no notification does not reach the server and clears nothing.

## Requirements served

- `plan-session_notifications/REQ-10`, `plan-session_notifications/REQ-13`, `plan-session_notifications/REQ-18`, `plan-session_notifications/REQ-19`
- `plan-session_notifications/REQ-24`
- `plan-session_notifications/REQ-28`, `plan-session_notifications/REQ-29`
- `plan-wsl_support/REQ-1`, `plan-wsl_support/REQ-2`, `plan-wsl_support/REQ-3`, `plan-wsl_support/REQ-4`, `plan-wsl_support/REQ-5`, `plan-wsl_support/REQ-6`

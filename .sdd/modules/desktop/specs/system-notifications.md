---
module: desktop
component: SystemNotifications
type: backend service
---

# SystemNotifications

**Purpose** → shows and closes the notifications of the Linux desktop, one per session, and reports clicks.

## Contract

- `new SystemNotifications({ appName, iconPath, connect? })`
  - `connect()` → opens a NotificationServer (below). Default: the D-Bus session bus, service `org.freedesktop.Notifications`.
  - it connects at the first call that needs the server, not before.
- `show({ sessionId, kind, title, body }) → Promise<void>` → one `notify` on the server:
  - `appName`, `appIcon` = `iconPath`, `summary` = `title`.
  - `body` → escaped when the server lists the capability `body-markup`: `&`, `<`, `>` become `&amp;`, `&lt;`, `&gt;`. Else as given.
  - `actions` → `["default", "Open"]`. The `default` action is a click on the notification.
  - by `kind`: `needs_input` → urgency `critical`, expire timeout `0` (never expires). `turn_end` → urgency `normal`, expire timeout `-1` (the server's usual timeout).
  - `replacesId` → the id of the notification the session has, else `0`. So a session with a notification gets it replaced in place, with the same id, whatever the kinds of the old and the new one.
- `close(sessionId) → Promise<void>` → closes the notification of the session. Nothing when it has none.
- `onClick(listener) → unsubscribe` → `listener(sessionId)` when the server reports the `default` action on the notification of that session.

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
- It never throws and its promises never reject. A failure (no bus, no server, no reply within 5 seconds) is logged, the connection is dropped, and the next call connects again.

## Requirements served

- `plan-session_notifications/REQ-10`, `plan-session_notifications/REQ-13`, `plan-session_notifications/REQ-18`, `plan-session_notifications/REQ-19`

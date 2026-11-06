---
module: desktop
component: NotificationRules
type: backend service
---

# NotificationRules

**Purpose** → decides which notification to show, group and close, from the attention events, the needs-input list, the window focus, the open session of the page and the clock.

## Contract

- `new NotificationRules({ windowFocused?, now? })` → `windowFocused` defaults to `false`. `now()` gives the current time in milliseconds, default `Date.now`. At start there is no open session, no notification and no burst.
- A notification has one line per session: the latest event of that session. Lines are ordered latest event first. The notification belongs to the session of its first line.
- Each method below, except `notificationClosed`, returns the commands to run, in order. A command is one of:
  - `{ type: "show", event, replaces? }` → the notification of `event.sessionId`, about that one event.
  - `{ type: "show-group", sessionId, kind, events, replaces? }` → a grouped notification. `events` are its lines, latest first. `sessionId` is the session of `events[0]`. `kind` is `needs_input` when one of `events` is `needs_input`, else the kind of `events[0]`.
  - `{ type: "close", sessionId }` → closes the notification that belongs to `sessionId`.
- `show` and `show-group` replace in place the notification that belongs to their session. With `replaces`, they replace in place the notification that belonged to the session `replaces`. `replaces` is present only when that session differs from the session of the command.
- After a change, a notification gives one command, by its lines:

  ```
  no line left        → close (the session it belonged to)
  one line            → show of that line's event: the session's own texts and look
  two or more lines   → show-group
  ```

- A session leaves a notification → its line goes, and the notification gives its command.
- A burst starts with an event that shows a notification. The burst runs while `now()` is at most 5000 ms after that event, and while its notification is not closed. A new burst ends the previous one.
- `receiveEvent(event)`:

  ```
  event.id received before            → []
  else the window has the focus       → []   (the id now counts as received; no burst changes)
  else a burst runs                   → its session leaves its own notification, if that is not the burst's
                                        the event becomes the first line of the burst notification
                                        → [leave commands..., command of the burst notification]
  else its session has a notification with only its own line
                                      → that notification starts a new burst, with the event as its line
                                        → [show event]   (in place)
  else                                → its session leaves its grouped notification, if any
                                        a new notification with the event starts a new burst
                                        → [leave commands..., show event]
  ```

- `receiveNeedsInput(sessions)` → the list replaces the previous one. Each session with a `needs_input` line that is not in the list leaves its notification. One command for each notification that changed. A line of another kind stays.
- `setWindowFocused(focused)` → stores the focus. Focused, and the open session has a line → that session leaves its notification. Else `[]`.
- `setOpenSession(sessionId | null)` → stores the open session. The window has the focus, and that session has a line → it leaves its notification. Else `[]`.
- `notificationClosed(sessionId)` → the desktop closed by itself the notification that belongs to `sessionId` (it expired, or the user closed or clicked it). That notification and all its lines go, and its burst ends. Returns nothing. Nothing when no notification belongs to `sessionId`.

## Rules and invariants

- Nothing shows while the window has the focus.
- A session has at most one line, in at most one notification.
- The same event id never gives a second command.
- A grouped notification has at least two lines.
- Time comes only from `now()`. No timer runs: a burst ends when the next event finds it over.
- Notifications on screen stay when the window gets the focus. Only the line of the open session goes.
- It uses no Electron API.

## Requirements served

- `plan-session_notifications/REQ-3`, `plan-session_notifications/REQ-4`, `plan-session_notifications/REQ-6`, `plan-session_notifications/REQ-11`, `plan-session_notifications/REQ-12`, `plan-session_notifications/REQ-19`
- `plan-session_notifications/REQ-25`, `plan-session_notifications/REQ-26`, `plan-session_notifications/REQ-27`, `plan-session_notifications/REQ-28`, `plan-session_notifications/REQ-29`

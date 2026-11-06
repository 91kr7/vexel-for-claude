---
slug: session_notifications
date: 2026-11-06
spec: .sdd/analysis/session_notifications.md
status: validated
---

# Requirements — System notifications and tray signal for waiting sessions

"The desktop app" is the desktop application of `plan-desktop_app`, with its window and its tray icon. "Has the focus" means that the window has the keyboard focus. A "notification" is a system notification of the Linux desktop. An "event" is a state change that notifies: a session enters "needs input", a turn ends, or a hosted session ends. "Opens a session" means that the page shows that session, as after a click on it in the list. A "grouped notification" is the one notification for events of several sessions (REQ-25).

## Feature: Needs-input notification

| ID | Requirement |
|----|-------------|
| REQ-1 | A notification appears when a hosted or external session enters "needs input". |
| REQ-2 | Every notification appears within 5 seconds of the state change that causes it, for hosted and external sessions. |
| REQ-3 | No notification appears while the window has the focus. |
| REQ-4 | Notifications appear while the window is in the background, minimized, or closed to the tray. |
| REQ-5 | State changes that happened before the desktop app started do not notify. |
| REQ-6 | The same state change never notifies twice. |
| REQ-7 | A notification about one session names it by its project folder and its label, as the list does. |
| REQ-8 | The needs-input notification says what is needed, with the wording of the needs-input card of the list. |
| REQ-9 | When the client does not know what is needed, the needs-input notification says that the session needs input. |
| REQ-10 | The needs-input notification is urgent and stays on screen until the user closes it. |
| REQ-11 | A needs-input notification disappears when its session no longer needs input. |
| REQ-12 | The notification of a session disappears when the user opens that session in the app. |
| REQ-13 | A click on a notification shows the window, in front, and opens that session. |

## Feature: Turn-end notification

| ID | Requirement |
|----|-------------|
| REQ-14 | A notification appears when a turn of a hosted or external session ends and the session goes from working to idle. |
| REQ-15 | A turn that the user interrupts does not notify. |
| REQ-16 | The turn-end notification shows the start of Claude's final response of that turn, as plain text without markdown, at most 100 characters. |
| REQ-17 | When that final response has no text, the turn-end notification says that Claude finished. |
| REQ-18 | The turn-end notification is a normal notification that the desktop hides after its usual time. |
| REQ-19 | A new notification of a session replaces its previous one in place, so each session has at most one notification at a time. |
| REQ-20 | When the session of a clicked notification is no longer in the list, the click only shows the window. |

## Feature: Session-end notification

| ID | Requirement |
|----|-------------|
| REQ-21 | A notification appears when a hosted session ends and the user did not stop it. |
| REQ-22 | A hosted session that the user ends with Terminate, by quitting the desktop app, or with an exit command in its terminal does not notify. |
| REQ-23 | The session-end notification says that the session ended, and whether it ended with an error. |
| REQ-24 | The session-end notification is a normal notification that the desktop hides after its usual time. |

## Feature: Grouped notifications

| ID | Requirement |
|----|-------------|
| REQ-25 | Events of several sessions within 5 seconds of the first one alert the user once, with one notification that says how many sessions and names them. |
| REQ-26 | The first event notifies at once, and the later events within the 5 seconds merge into its notification. |
| REQ-27 | A grouped notification is urgent when at least one of its sessions needs input. |
| REQ-28 | A click on a grouped notification opens the session of the latest event. |
| REQ-29 | A session leaves a grouped notification when its own notification would disappear (REQ-11, REQ-12) or be replaced (REQ-19), and the grouped notification disappears when no session is left. |

## Feature: Tray signal

| ID | Requirement |
|----|-------------|
| REQ-30 | The tray icon has an attention look while at least one hosted or external session needs input, and its normal look otherwise. |
| REQ-31 | The attention icon is easy to tell from the normal icon at tray size, on light and dark panels. |
| REQ-32 | While at least one session needs input, the tray tooltip says how many, with correct singular and plural. |
| REQ-33 | The tray menu has one entry for each session that needs input, named as in the list. |
| REQ-34 | A click on such an entry shows the window, in front, and opens that session. |
| REQ-35 | The menu entries are ordered by when the session started to need input, the longest waiting first. |
| REQ-36 | The tray icon, tooltip and menu update by themselves, also while the window has the focus. |
| REQ-37 | The "Open Window" and "Quit" actions of the tray stay as they are. |

## Gatekeeper decisions (2026-11-06)

These are not human decisions.

- **REQ-29.** The gatekeeper kept the proposed default. With one session left, the grouped notification becomes the notification of that session. Reason: REQ-11, REQ-12 and REQ-19 must keep holding for a session inside a grouped notification.
- **REQ-12, window focus.** When the window gets the focus while a session is already open in it, this counts as opening that session. Reason: the user now sees that session.
- **Five features.** The gatekeeper accepted the cut into the five features above.

## Assumptions

- **Where the shared rules live.** REQ-2 to REQ-7 and REQ-12, REQ-13 hold for every notification. They sit in the first feature because its batch builds the notifications. REQ-19 and REQ-20 sit in "Turn-end notification": only from there can one session have a notification that is not about "needs input", so only from there can they be checked.
- **Focus does not clear.** Notifications already on screen stay when the window gets the focus. Only REQ-11, REQ-12 and REQ-29 remove them.
- **REQ-22.** The list of user stops comes from the spec's assumptions.
- **REQ-32 with no session waiting.** The tooltip stays as today.
- **Tray at start.** The tray shows the sessions that already need input when the desktop app starts. REQ-5 concerns notifications only.
- **REQ-37.** It restates `plan-desktop_app/REQ-13` and `/REQ-14`, because the tray menu changes in this plan.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Only the desktop app shows notifications. The browser client shows none, and a focused browser page does not block them.
- Every notification text, tooltip and menu entry is in English, like the rest of the UI.
- Linux only, on the user's machine.
- Out of scope: removing the `notify.sh` hook, notifications from the browser client, answering or replying from a notification or the tray menu, settings to turn notifications on or off, custom sounds, a notification when an external session ends, repeated reminders, changes to the snackbar, start at login.
- Every requirement of the earlier plans of this client stays true, up to `plan-light_theme`.

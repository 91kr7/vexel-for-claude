---
slug: remote_notifications
date: 2026-11-26
spec: .sdd/analysis/remote_notifications.md
status: validated
---

# Requirements — Remote notification to the phone through ntfy

"The desktop app" is the desktop application of `plan-desktop_app`. "The remote notification" is the message the desktop app posts to the ntfy topic of the user. "The remote switch" is its on/off switch. "The sound switch" is the switch of `plan-input_sound`. "The topic URL" is the address of the ntfy topic, on ntfy.sh or on another ntfy server. "The token" is the optional ntfy access token.

## Feature: Notifications section

| ID | Requirement |
|----|-------------|
| REQ-1 | The settings section of the sound is named "Notifications". |
| REQ-2 | "Notifications" is the second-to-last section of the settings popup. |
| REQ-3 | "Updates" is the last section of the settings popup. |
| REQ-4 | The "Notifications" section holds the sound switch, with its behaviour of `plan-input_sound`. |
| REQ-5 | The section has the remote switch, off by default. |
| REQ-6 | The section has a field for the topic URL, which accepts a topic on ntfy.sh or on another ntfy server. |
| REQ-7 | The section has an optional field for the token. |
| REQ-8 | The token field hides its value, like a password field. |
| REQ-9 | The section rejects a topic URL that is not an http or https address with a topic, and says why. |
| REQ-10 | The remote switch does not turn on while the topic URL is empty or invalid. |
| REQ-11 | Every change in the section applies at once, with no reload. |
| REQ-12 | The desktop app remembers the remote switch, the topic URL and the token across restarts. |
| REQ-13 | The sound switch and the remote switch work independently of each other. |

## Feature: Test notification

| ID | Requirement |
|----|-------------|
| REQ-14 | The section has a "Send test notification" button. |
| REQ-15 | The button sends a short test message to the topic, with the token when one is set. |
| REQ-16 | After a successful send, the section shows that the message was sent. |
| REQ-17 | After a failed send, the section shows a short error with the reason, for example a refused token. |
| REQ-18 | The token does not appear in any error message. |

## Feature: Remote notification

| ID | Requirement |
|----|-------------|
| REQ-19 | With the remote switch on, the desktop app sends a remote notification when a hosted or external session has stayed in "needs input" for 60 seconds without a break. |
| REQ-20 | With the remote switch off, the desktop app sends no remote notification. |
| REQ-21 | A session that leaves "needs input" within 60 seconds sends no remote notification. |
| REQ-22 | A session sends at most one remote notification while it keeps needing input. |
| REQ-23 | A session that leaves "needs input" and enters it again starts a new 60-second count. |
| REQ-24 | State changes that happened before the desktop app started send no remote notification. |
| REQ-25 | A turn end and a session end send no remote notification. |
| REQ-26 | The remote notification is sent whether the window has the focus, is in the background, is minimized, or is closed to the tray. |
| REQ-27 | Two sessions that need input at the same time each send their own remote notification. |
| REQ-28 | The remote notification leaves the desktop app within 5 seconds of the end of the 60 seconds. |
| REQ-29 | The remote notification carries the token when one is set. |
| REQ-30 | The remote notification names the session by its project folder and its label, as the session list does. |
| REQ-31 | For a permission request, the remote notification names the tool and shows what the tool will do, for example the command or the file path. |
| REQ-32 | For a question from Claude, the remote notification shows the question and its options. |
| REQ-33 | When the client does not know what the session needs, the remote notification says that the session needs input. |
| REQ-34 | The remote notification says how long the session has been waiting. |
| REQ-35 | The remote notification uses the high priority of ntfy. |
| REQ-36 | A text too long for one notification is shortened, and the notification says that it was shortened. |
| REQ-37 | A failed remote notification does not delay or block the system notifications, the sound or the tray. |
| REQ-38 | A failed remote notification shows no error to the user and is not sent again. |
| REQ-39 | The token does not appear in the logs. |

## Assumptions

The first four assumptions and REQ-27 are gatekeeper decisions of 2026-11-26. They are not human decisions.

- **Topic URL becomes invalid.** If the user empties or breaks the topic URL while the remote switch is on, the switch turns off by itself. Reason: REQ-10 forbids an "on" switch without a valid URL.
- **Test button and remote switch.** The test button works with the remote switch on or off. It is disabled while the topic URL is empty or invalid. Reason: the user tests the topic before turning the switch on.
- **Switch read at the end of the count.** The desktop app reads the remote switch, the topic URL and the token at the end of the 60 seconds. A session that started to wait 30 seconds before the switch went on sends a notification 30 seconds later. Reason: no extra state on a switch change.
- **Session already waiting at start.** A session that already needs input when the desktop app starts sends nothing until it leaves "needs input" and enters it again (REQ-24).
- **No grouping.** REQ-27 comes from the spec, section "Assumptions".
- **Too long.** "Too long for one notification" means a message body over 4,096 bytes, the limit of ntfy ([ntfy publish](https://docs.ntfy.sh/publish/)).
- **How long.** The waiting time is the time from the entry into "needs input" to the send, so about one minute.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Only the desktop app shows the "Notifications" section and sends remote notifications. The client open in a browser does neither.
- Every new text is in English, like the rest of the UI.
- The sound, the system notifications and the tray do not change.
- A tap on the phone notification does only what the ntfy app does by default.
- Out of scope: the reply channel from the phone, remote notifications for turn end or session end, other push services, repeated reminders.
- Every requirement of the earlier plans stays true, `plan-input_sound`, `plan-session_notifications` and `plan-settings_dialog` included.

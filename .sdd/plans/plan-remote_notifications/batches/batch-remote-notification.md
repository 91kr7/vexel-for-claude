---
batch: remote-notification
feature: Remote notification
closed_req: REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39
depends: test-notification
---

# Batch — Remote notification

When a hosted or external session has needed input for 60 seconds, the desktop app posts a notification to the ntfy topic. The notification says which session waits, what Claude asks, and for how long.

## What this batch builds

- **Waiting detail** (backend, sessions area) → turns the hook event of a permission request or of a question into the detail the notification shows.
- **Remote rule** (desktop area, next to the notification rules) → counts 60 s for each session that enters "needs input" and decides when to send.
- **Remote notification text** (desktop area, next to NotificationTexts) → the title and the body of the remote notification.

## Decisions

- **The source is the attention events.** The AttentionMonitor (module sessions) gives one `needs_input` event for each entry into "needs input". It gives none at first sight and none while a session keeps waiting. A session leaves the needs-input list when its state changes. The remote rule uses only these two inputs, so REQ-22, REQ-23 and REQ-24 need no new logic in the backend.
- **Count.** A `needs_input` event starts a 60,000 ms count for its session and replaces an older count of that session. A needs-input list without the session stops its count. At the end of the count the rule gives "send" once, with the event. `turn_end` and `session_end` start nothing. Each session has its own count (REQ-27). The clock and the timers are injected, like NotificationRules.
- **Focus is not an input.** The rule gets every event and list before the focus checks of NotificationRules (REQ-26), like the SoundRule.
- **Settings read at the end.** On "send", the main process reads the remote settings store. Switch off, or empty URL → nothing. Otherwise it publishes through the ntfy publisher of batch test-notification, with the token when set (`requirements.md`, assumption "Switch read at the end of the count").
- **Waiting detail.** The hook events of hosted sessions carry `tool_input`. The tracker keeps the detail of the waiting request, with the rules of `waitingTool`:
  - `PermissionRequest` → the full main argument of its `tool_input` (`mainArgumentOf`, TranscriptReader, module external). For Bash this is the command; for Edit and Write it is the file path.
  - `Notification` `permission_prompt` → the detail already kept, else the one of the last `PreToolUse`.
  - `PreToolUse` of `AskUserQuestion` → each question of `tool_input.questions`, with the labels of its options.
  - Leaving `needs_input` removes the detail.
- **External sessions.** The client knows no waiting tool for them (AttentionMonitor), so their notification says "Needs your input" (REQ-33). Reading their transcript for the detail is out of this plan. Human decision of 2026-11-26.
- **Message.**
  - Title → `notificationTitle(folder, label)` of NotificationTexts: `"<folder name> · <label>"` (REQ-30).
  - Permission → first line `"Permission for <tool>"`, then the detail when known.
  - Question → `"Claude asks:"`, then each question on its own line, each option on a line that starts with `"- "`.
  - Unknown → `"Needs your input"`.
  - Last line → `"Waiting for <N> min"`, with N the whole minutes from the event to the send (REQ-34).
  - Priority → `high` (4) of ntfy (REQ-35).
- **Shortening.** The body stays within 4,096 bytes of UTF-8. A longer body cuts the detail at a whole character and adds the line `"[Text shortened]"` before the waiting line (REQ-36).
- **No wait, no retry.** The main process starts the publish and does not wait for it. A failure writes at most one line with the reason of the publisher to the main process output. It shows nothing and does not send again (REQ-37, REQ-38). The line holds no token and no request headers (REQ-39).
- **Nothing else changes.** NotificationRules, SystemNotifications, SoundRule and TrayIcon do not change.
- **Tests.**
  - Vitest covers the waiting detail (each hook case), the tracker and the monitor (the detail on the event), and the client (detail passed, bad detail dropped).
  - Vitest also covers the rule with a fake clock: 60 s, a leave before 60 s, one send per wait, enter again, two sessions, no turn end, no first sight.
  - Vitest covers the text (each kind, waiting time, the 4,096-byte cut on a multi-byte text) and the main wiring with a failing publisher (no block, one log line without the token).
  - The Electron e2e group checks one send to a local fake ntfy server, with the window hidden. The tests never post to ntfy.sh.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Waiting detail: from a hook event, the full main argument of its tool input, or the questions of an `AskUserQuestion` with their option labels (decision "Waiting detail"). | REQ-31, REQ-32 | — |
| INT-2 | modify | `src/server/sessions/session-state-tracker.ts` | Keep the waiting detail of INT-1 next to `waitingTool`, with the rules of decision "Waiting detail". Give it by session id. | REQ-31, REQ-32 | INT-1 |
| INT-3 | modify | `src/server/sessions/attention-monitor.ts` | Add the waiting detail of the tracker to a hosted `needs_input` event, when known. | REQ-31, REQ-32, REQ-33 | INT-2 |
| INT-4 | modify | `src/desktop/attention-client.ts` | Accept the optional waiting detail of a `needs_input` event and pass it on. A malformed detail is dropped, and the event is kept. | REQ-31, REQ-32 | — |
| INT-5 | create | desktop area, next to the notification rules | Remote rule of decision "Count": a 60 s count per session from each `needs_input` event, stopped by a list without the session, then "send" once. No Electron API. | REQ-19, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-27, REQ-28 | — |
| INT-6 | create | desktop area, next to NotificationTexts | Remote notification text: the title, body and priority of decision "Message", shortened by decision "Shortening". | REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36 | — |
| INT-7 | modify | `src/desktop/main.ts` | Pass every event and list of the AttentionClient to the remote rule, before the focus checks. On "send", apply decision "Settings read at the end", with the text of INT-6. | REQ-19, REQ-20, REQ-26, REQ-28, REQ-29 | INT-4, INT-5, INT-6 |
| INT-8 | modify | `src/desktop/main.ts` | Start the publish of INT-7 without waiting for it. A failure follows decision "No wait, no retry". | REQ-37, REQ-38, REQ-39 | INT-7 |

The developer updates the specs of SessionStateTracker, AttentionMonitor, AttentionRoute (the event shape), AttentionClient and DesktopApp. They write the specs of the waiting detail, the remote rule and the remote notification text, and update the indexes.

## Human acceptance

### Scenario: The phone shows the command Claude wants to run

- REQ → REQ-19, REQ-26, REQ-28, REQ-29, REQ-30, REQ-31, REQ-34, REQ-35
- Given → the remote switch is on with a token, the phone follows the topic, and the window is closed to the tray
- When → the user sends a prompt to a hosted session that makes Claude ask permission for a Bash command, and does not answer for 60 seconds
- Then → within 65 seconds the phone shows a high-priority notification titled with the project folder and the session label
- And → its text names Bash, shows the command and says "Waiting for 1 min"

### Scenario: The phone shows Claude's question and its options

- REQ → REQ-32, REQ-27
- Given → the remote switch is on, and two hosted sessions run
- When → Claude asks a question with options in one session and a permission in the other, and the user answers neither for 60 seconds
- Then → the phone shows two notifications, one with the question and its options, one with the permission

### Scenario: A quick answer sends nothing

- REQ → REQ-21, REQ-25
- Given → the remote switch is on, and a hosted session works on a prompt
- When → Claude asks a permission and the user grants it within 30 seconds, then Claude finishes the turn
- Then → the phone shows no notification

### Scenario: A new wait sends a new notification

- REQ → REQ-22, REQ-23
- Given → the phone showed the notification of a session, and the session kept waiting 2 more minutes with no second notification
- When → the user grants the permission, and Claude asks another one that the user does not answer for 60 seconds
- Then → the phone shows a second notification for that session

### Scenario: An external session sends a generic notification

- REQ → REQ-33
- Given → the remote switch is on, and the desktop app runs
- When → a session in a terminal asks a permission, and the user does not answer for 60 seconds
- Then → the phone shows a notification with the project folder, "Needs your input" and "Waiting for 1 min"

### Scenario: No notification for a session that already waited

- REQ → REQ-24
- Given → the desktop app is not running, and a session in a terminal needs input
- When → the user starts the desktop app and waits 2 minutes
- Then → the phone shows no notification

### Scenario: The remote switch off sends nothing

- REQ → REQ-20
- Given → the remote switch is off, with a valid topic URL
- When → a session waits for input for 60 seconds
- Then → the phone shows no notification, and the system notification shows as before

### Scenario: A long command is shortened

- REQ → REQ-36
- Given → the remote switch is on
- When → Claude asks permission for a command longer than 4,096 bytes, and the user does not answer for 60 seconds
- Then → the phone shows the start of the command, then "[Text shortened]" and the waiting time

### Scenario: A broken topic changes nothing on the desktop

- REQ → REQ-37, REQ-38, REQ-39
- Given → the remote switch is on, and the ntfy server refuses the token
- When → a session waits for input for 60 seconds
- Then → the system notification, the sound and the tray work as before, and no error shows in the app

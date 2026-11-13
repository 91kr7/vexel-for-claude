---
batch: failed-notifications
feature: Failed system notifications
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6]
depends: []
---

# Batch — Failed system notifications

Source: the branch `feature/wsl-support` changes `src/desktop/system-notifications.ts` for this feature. Port that change and adapt it to main.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/desktop/system-notifications.ts` | On a failed call, write one log line that names the reason. Write no other line while the same reason repeats. Write again when the reason changes, or at the first failure after a call that succeeded. | REQ-1, REQ-2, REQ-3, REQ-4 | — |
| INT-2 | modify | `src/desktop/system-notifications.ts` | Keep the rest of the contract as it is: no throw, no rejected promise, the 5 s limit, drop the connection and connect again at the next call. | REQ-5, REQ-6 | INT-1 |

Update the spec of SystemNotifications (module desktop) with the new log rule.

## Human acceptance

The app is started from a shell with `npm run desktop`, so its log shows in that shell. This is a gatekeeper exception to the rule that a log line is not a `Then`: here the log line is the result the spec asks for.

### Scenario: A failed notification gives one log line and the app keeps working

- REQ → REQ-1, REQ-2, REQ-5
- Given → the desktop app runs on a machine with no notification service, and its window is in the background
- When → two sessions, one after the other, enter "needs input"
- Then → the shell shows one line that names why the notification failed
- And → the tray, the snackbar and the session list show both sessions as needing input, with no delay

### Scenario: A new reason gives a new line

- REQ → REQ-3
- Given → the shell already shows a failure line with one reason
- When → the next notification fails with another reason
- Then → the shell shows a second line that names the new reason

### Scenario: Notifications work again where a notification service runs

- REQ → REQ-4, REQ-6
- Given → the shell shows a failure line, and then a notification service starts
- When → a session enters "needs input" while the window is in the background
- Then → the notification appears as before this change
- And → when the service stops again, the next failed notification gives a new line in the shell

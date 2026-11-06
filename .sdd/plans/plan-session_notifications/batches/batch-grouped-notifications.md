---
batch: grouped-notifications
feature: Grouped notifications
closed_req: REQ-25, REQ-26, REQ-27, REQ-28, REQ-29
depends: turn-end-notification, session-end-notification
---

# Batch — Grouped notifications

Events of several sessions within 5 seconds alert the user once. The first event shows at once, and the later ones merge into its notification. The change is in the desktop area only.

## Decisions

- **Modify targets from `needs-input-notification`.** The notification rules and the notification texts are named by component. Their paths are in the indexes.
- **Burst.** A burst starts with an event that shows a notification. For 5 seconds, an event of another session merges into that notification, which updates in place. An event of a session already in the burst updates its line. After the 5 seconds, the next event starts a new burst.
- **Leaving a group** (REQ-29, gatekeeper decision). A session leaves the grouped notification when its own notification would close (REQ-11, REQ-12) or when it has a new event after the 5 seconds. With one session left, the notification becomes the notification of that session, with its own texts. With none left, it closes.
- **Urgency.** Urgent with no timeout while one of its sessions has a needs-input event. Otherwise normal, with the usual timeout. It changes in place when a session joins or leaves.
- **Click.** It opens the session of the latest event, with the click path of `needs-input-notification`.
- **Texts** (gatekeeper decision, 2026-11-06). Title "N sessions need your attention". Body: one line per session, "<folder name> · <label>", latest event first.
- **Focus.** An event while the window has the focus shows nothing and joins no burst (REQ-3).
- **Tests.** Vitest for the rules with a fake clock. No Electron e2e is needed.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | Notification rules (from `needs-input-notification`) | Bursts: the first event shows at once. For 5 seconds, an event of another session merges into its notification, in place (decision "Burst"). | REQ-25, REQ-26 | — |
| INT-2 | modify | Notification rules (from `needs-input-notification`) | A grouped notification is urgent while one of its sessions has a needs-input event. A click on it opens the session of its latest event. | REQ-27, REQ-28 | INT-1 |
| INT-3 | modify | Notification rules (from `needs-input-notification`) | A session leaves a grouped notification by the decision "Leaving a group". | REQ-29 | INT-1 |
| INT-4 | modify | Notification texts (from `needs-input-notification`) | Grouped title and body (decision "Texts"). | REQ-25 | — |

The developer updates the specs of the notification rules and texts.

## Human acceptance

### Scenario: A burst of events gives one notification

- REQ → REQ-25, REQ-26, REQ-27
- Given → the window is in the background, and two external sessions are working
- When → the user sends both sessions, at once, a prompt that ends in a few seconds, and one of them asks for permission
- Then → a notification appears at the first event, and becomes "2 sessions need your attention" with both names
- And → it is urgent, and stays on screen

### Scenario: A click on the group opens the latest session

- REQ → REQ-28
- Given → a grouped notification names session A, then session B, which came later
- When → the user clicks the notification
- Then → the window comes to the front with session B open

### Scenario: A session that is answered leaves the group

- REQ → REQ-29
- Given → a grouped notification names session A, which needs input, and session B, whose turn ended
- When → the user answers session A in its terminal
- Then → the notification shows only session B, with the start of Claude's answer

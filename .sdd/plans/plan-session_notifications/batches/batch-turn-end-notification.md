---
batch: turn-end-notification
feature: Turn-end notification
closed_req: REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20
depends: needs-input-notification
---

# Batch — Turn-end notification

When a turn of a hosted or external session ends, the desktop app shows a normal notification with the start of Claude's final response. A turn that the user interrupts does not notify. From this batch on, a new notification of a session replaces the previous one in place.

## What this batch builds

- **Turn reader** (backend, sessions area) → reads the end of a session transcript. It gives Claude's final response of the last turn, and whether the user interrupted that turn.
- **Plain excerpt** (backend, sessions area) → turns a response into plain text without markdown, at most 100 characters.

## Decisions

- **Modify targets from `needs-input-notification`.** The attention monitor, the notification rules, the notification texts and the system notifications are created by that batch. The `Where` column names them by component. Their paths are in the indexes.
- **Turn end of a hosted session.** `working` → `idle` caused by a `Stop` hook. `idle` from user input (Esc, Ctrl+C) is an interrupt. `idle` from `idle_prompt` is a correction. Neither notifies.
- **Turn end of an external session.** `working` → `idle` seen by the scanner, when the transcript does not end the turn with the interrupt marker of Claude Code ("[Request interrupted by user", with or without "for tool use").
- **Transcript.** Hosted: TranscriptReader `locate` with the folder and the Claude Code session id of the tracker. External: the session id is the Claude Code session id. Read only the end of the file, not the whole file. If the last reply is not written yet, read again once after a short wait, within the 5 seconds of REQ-2.
- **Final response.** The text items of Claude after the last tool result of the turn, joined. A turn that ends on a tool call, or with no text, has none.
- **Plain text.** Remove code fences, inline code marks, emphasis, heading and list marks, and keep the text of links. Collapse whitespace. Longer than 100 characters → the first 99 and "…".
- **Texts** (gatekeeper decision, 2026-11-06). Title as in `needs-input-notification`. Body: the excerpt, or "Claude finished" when there is none.
- **Look.** Turn-end notifications have urgency `normal` and the desktop's usual timeout.
- **One per session.** A new event of a session replaces its notification, whatever the kind. The replacement keeps the same notification id (`replaces_id`), so it stays in place.
- **REQ-20** needs no new code: `batch-needs-input-notification/INT-14` opens a session only when the list has it. This batch is the first where a notification can outlive its session in the list.
- **Tests.** Vitest for the tracker cause, the turn reader (transcript fixtures), the plain excerpt, the monitor and the rules. Electron e2e only in the Electron group (knowledge base `electron-e2e-separate`).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/sessions/session-state-tracker.ts` | Give change listeners the cause of each change: the hook event name, user input, or the process exit. Give the Claude Code session id of a session. | REQ-14, REQ-15, REQ-16 | — |
| INT-2 | create | backend, sessions area | Turn reader: locate the transcript and read its end. Give the final response of the last turn and whether the user interrupted it (decisions "Transcript" and "Final response"). | REQ-15, REQ-16, REQ-17 | — |
| INT-3 | create | backend, sessions area | Plain excerpt: markdown to plain text, at most 100 characters (decision "Plain text"). | REQ-16 | — |
| INT-4 | modify | Attention monitor (from `needs-input-notification`) | Emit a turn-end event when a session goes from `working` to `idle`. Hosted: only on a `Stop` hook. External: only when the turn reader finds no interrupt. Detail: the excerpt, or none. | REQ-14, REQ-15, REQ-16, REQ-17 | INT-1, INT-2, INT-3 |
| INT-5 | modify | Notification texts (from `needs-input-notification`) | Turn-end body: the excerpt, or "Claude finished" when there is none. | REQ-16, REQ-17 | — |
| INT-6 | modify | Notification rules (from `needs-input-notification`) | Keep one notification per session. A new event of a session replaces its notification. | REQ-19 | — |
| INT-7 | modify | System notifications (from `needs-input-notification`) | Replace a notification in place, with the same notification id. Turn-end notifications have urgency `normal` and the usual timeout. | REQ-18, REQ-19 | — |

The developer updates the specs of SessionStateTracker and of the modified components. They write the specs of the two new components and update the indexes.

## Human acceptance

### Scenario: A finished turn shows the start of Claude's answer

- REQ → REQ-14, REQ-16, REQ-18
- Given → the window is in the background, and the user works on an external session in a terminal
- When → the user sends a prompt, and Claude ends the turn with "**Done.** The tests pass."
- Then → a normal notification shows "Done. The tests pass.", without the bold marks
- And → it hides after the desktop's usual time

### Scenario: An interrupted turn stays silent

- REQ → REQ-15
- Given → the window is in the background, and an external session is working
- When → the user presses Esc in its terminal
- Then → no notification appears

### Scenario: A turn with no final text says that Claude finished

- REQ → REQ-17
- Given → the window is in the background, and an external session is working
- When → the user sends a prompt whose turn ends with a tool call and no text
- Then → the notification says "Claude finished"

### Scenario: A new notification takes the place of the old one

- REQ → REQ-19
- Given → the turn-end notification of an external session is on screen
- When → the user sends that session a prompt that makes Claude ask for permission
- Then → the needs-input notification takes the place of the turn-end one, and only one notification of that session is on screen

### Scenario: A click on a gone session only shows the window

- REQ → REQ-20
- Given → the turn-end notification of an external session is in the notification list, and the user has closed that terminal
- When → the user clicks the notification
- Then → the window comes to the front, and no session opens

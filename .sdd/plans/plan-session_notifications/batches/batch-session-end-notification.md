---
batch: session-end-notification
feature: Session-end notification
closed_req: REQ-21, REQ-22, REQ-23, REQ-24
depends: needs-input-notification, turn-end-notification
---

# Batch — Session-end notification

When a hosted session ends and the user did not stop it, the desktop app shows a normal notification. It says whether the session ended with an error.

## Decisions

- **Modify targets from `needs-input-notification`.** The attention monitor, the notification texts and the system notifications are named by component. Their paths are in the indexes.
- **Who stopped the session** (gatekeeper decision, 2026-11-06, from the spec's assumption that an exit command is a user stop).

  ```
  stop() was called (Terminate, quit of the desktop app, server shutdown) → no event
  exit code 0, no signal (the user's exit command: /exit, Ctrl+C twice, Ctrl+D) → no event
  exit code other than 0                                                     → event, with an error
  ended by a signal that the client did not send                             → event, no error
  ```

  Claude Code exits with code 0 only when the user asks. So a clean exit counts as the user's exit command. This is an assumption: if Claude Code exits with code 0 by itself, that end does not notify.
- **Texts** (gatekeeper decision, 2026-11-06). Title as in `needs-input-notification`. Body "Session ended", or "Session ended with an error".
- **Look.** Session-end notifications have urgency `normal` and the desktop's usual timeout. They replace the previous notification of the session in place, as every new notification does since `turn-end-notification`.
- **External sessions** never give this event (out of scope).
- **Tests.** Vitest for the registry and the monitor, with a fake CLI (`AI_CLIENT_CLAUDE_CLI`) that exits with a chosen code or is killed. Electron e2e only in the Electron group (knowledge base `electron-e2e-separate`).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/sessions/session-registry.ts` | A Session tells how its process ended (exit code, signal), and whether `stop()` was called on it. | REQ-21, REQ-22, REQ-23 | — |
| INT-2 | modify | Attention monitor (from `needs-input-notification`) | When a hosted session becomes `ended`, emit a session-end event by the rule "Who stopped the session". Detail: with or without an error. | REQ-21, REQ-22, REQ-23 | INT-1 |
| INT-3 | modify | Notification texts (from `needs-input-notification`) | Session-end body: "Session ended", or "Session ended with an error". | REQ-23 | — |
| INT-4 | modify | System notifications (from `needs-input-notification`) | Session-end notifications have urgency `normal` and the usual timeout. | REQ-24 | — |

The developer updates the specs of SessionRegistry and of the modified components, and the indexes.

## Human acceptance

### Scenario: A hosted session that dies says so

- REQ → REQ-21, REQ-23, REQ-24
- Given → the window is in the background, and a hosted session is working
- When → the user kills its Claude Code process with `kill -9` from another terminal
- Then → a normal notification of that session says "Session ended"
- And → it hides after the desktop's usual time

### Scenario: A session that fails says it ended with an error

- REQ → REQ-21, REQ-23
- Given → the window is in the background, and a hosted session runs a CLI that will exit with code 1
- When → the user waits for the CLI to exit
- Then → a notification of that session says "Session ended with an error"

### Scenario: A session the user ends stays silent

- REQ → REQ-22
- Given → the window is in the background, and the user works on a hosted session in the browser client
- When → the user types `/exit` in its terminal
- Then → no notification appears
- And → "Terminate" on another hosted session shows no notification either

---
batch: session-switch
feature: Session switch
closed_req: [REQ-10, REQ-11, REQ-12, REQ-13, REQ-33]
depends: [modal-dialogs]
---

# Batch session-switch

The motion base comes from batch modal-dialogs. Today one SessionView serves every hosted session: a new session id closes the old connection and attaches the new one.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/AppLayout.tsx` | When the open session changes, cross-fade the main area from the old view to the new one. SessionView, ConversationView and EmptyState are all covered. | REQ-10 | — |
| INT-2 | modify | `src/web/AppLayout.tsx` | A new selection during a cross-fade ends it: only the last selected session stays, and no older content stays visible. The leaving content takes no input. | REQ-11, REQ-26, REQ-28 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | During the cross-fade, open no extra connection and send no extra `resize`. The terminal fits once, when the fade ends, and keeps the input focus rules of today. | REQ-12, REQ-13 | INT-1 |
| INT-4 | modify | `src/web/sessions/SessionView.tsx` | Keep the input typed while the connection of the session is still opening, then send it in order once it opens. A new `sessionId` drops the kept input, so it never reaches another session. | REQ-11, REQ-33 | — |

Notes:

- Each session keeps its content on the server mirror. A session the user goes back to shows its snapshot, as today.
- Rows and columns of a running session must not change during the fade. This avoids flicker and many resizes of the running session.

## Human acceptance

### Scenario: switching session cross-fades the main area

- REQ → REQ-10, REQ-12, REQ-13
- Given → two open sessions A and B, each with text in its terminal, and A on screen
- When → the user clicks B in the session list
- Then → A fades out while B fades in, and B shows its text with the correct layout

### Scenario: a third selection during the fade wins

- REQ → REQ-11, REQ-28
- Given → three sessions A, B and C, with A on screen
- When → the user clicks B and, during the fade, clicks C
- Then → only C shows in the main area, with no text of A or B left on screen

### Scenario: typing right after a switch reaches the new session

- REQ → REQ-12, REQ-26, REQ-33
- Given → two sessions A and B, with A on screen
- When → the user opens B with its shortcut and types at once, before B has finished connecting
- Then → the typed text appears in B, in the order typed, and A has not received it

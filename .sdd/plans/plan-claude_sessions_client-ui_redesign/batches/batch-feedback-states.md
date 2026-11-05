---
batch: feedback-states
feature: Feedback states
closed_req: [REQ-1, REQ-3, REQ-4, REQ-5, REQ-29, REQ-30, REQ-31, REQ-32]
depends: [open-session, dialogs]
---

# Batch — Feedback states

Loading states, error messages and the progress of start, stop and resume, in every area. This is the last batch, so it also closes REQ-1, REQ-3, REQ-4 and REQ-5, which cover every screen. The INTs of the earlier batches serve them. This batch adds its own new elements on the same theme tokens and checks the whole client against them.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch").

## What this batch builds

- **Progress indicator** → one indicator for a loading area and for an action in progress.
- **Error message** → one look for every failure the user sees.

## Decisions for this batch

- **Success is shown by its result** → a start or a resume opens the new session, and a stop turns the state into "Terminata" and removes "Termina". There is no extra notice.
- **Failure** → a message in Italian, next to the action that failed. The generic "Operazione non riuscita." becomes a message that names the action, for example "Avvio della sessione non riuscito.". The specific messages of today stay.
- **Lost connection** → when the session events connection closes, the list shows an error. The client does not reconnect by itself, as today.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area | Progress indicator: one animated indicator, with an Italian text for screen readers. It marks a loading area or an action in progress. | REQ-29, REQ-31, REQ-1 | — |
| INT-2 | create | frontend, app area | Error message: an icon and an Italian text in the error colour, announced with `role="alert"`. | REQ-30, REQ-1, REQ-3 | — |
| INT-3 | modify | `src/web/sessions/live-session-store.ts` | Expose a load status: `loading` until the first list arrives, `error` when the list does not load or the events connection closes, else `ready`. `useLiveSessions` returns it with the list. | REQ-29, REQ-30 | — |
| INT-4 | modify | `src/web/sessions/SessionList.tsx` | New status prop: the INT-1 indicator while `loading`, in place of "Nessuna sessione.". An INT-2 message on `error`. | REQ-29, REQ-30 | INT-1, INT-2, INT-3 |
| INT-5 | modify | `src/web/AppLayout.tsx` | Pass the INT-3 status to SessionList. | REQ-29, REQ-30 | INT-3, INT-4 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | The INT-1 indicator over the terminal until the first snapshot arrives. When the connection closes, an INT-2 message above the terminal, besides `[Sessione disconnessa]`. | REQ-29, REQ-30 | INT-1, INT-2 |
| INT-7 | modify | `src/web/external/ConversationView.tsx` | "Caricamento…" and "Conversazione non disponibile." with INT-1 and INT-2. The same while an expanded item loads, and if its load fails. | REQ-29, REQ-30 | INT-1, INT-2 |
| INT-8 | modify | `src/web/folders/FolderChooser.tsx` | INT-1 while a folder lists. While the start runs, "Avvia sessione" shows INT-1 and is disabled. Errors use INT-2. | REQ-29, REQ-30, REQ-31, REQ-32 | INT-1, INT-2 |
| INT-9 | modify | `src/web/history/ResumeDialog.tsx` | INT-1 while the list loads. While a resume runs, "Riprendi" shows INT-1 and is disabled. Errors use INT-2. | REQ-29, REQ-30, REQ-31, REQ-32 | INT-1, INT-2 |
| INT-10 | modify | `src/web/external/ResumeHereButton.tsx` | While the resume runs, "Riprendi qui" shows INT-1. The error uses INT-2. | REQ-30, REQ-31, REQ-32 | INT-1, INT-2 |
| INT-11 | modify | `src/web/sessions/StopSessionButton.tsx` | While the stop runs, "Termina" shows INT-1 and is disabled. A failed stop shows an INT-2 message. Today it has no visible effect. | REQ-30, REQ-31, REQ-32 | INT-1, INT-2 |

## Human acceptance

### Scenario: The user sees a stop in progress and its result

- REQ → REQ-31, REQ-32
- Given → an idle hosted session is open
- When → the user clicks "Termina"
- Then → the button shows that the stop is in progress
- And → when it ends, the header shows "Terminata" and "Termina" is gone

### Scenario: The user sees the list load

- REQ → REQ-29
- Given → the server answers slowly
- When → the user opens the client
- Then → the session list shows a loading state, not "Nessuna sessione.", until the list arrives

### Scenario: The user sees why a start failed

- REQ → REQ-30, REQ-32
- Given → the folder chooser is open
- When → the user starts a session in a folder that does not exist
- Then → the dialog stays open and shows "La cartella non esiste." with the error look

### Scenario: The user sees that the connection to the client is lost

- REQ → REQ-30
- Given → the client is open with its session list
- When → the server stops
- Then → the list shows an error message in Italian that says the connection was lost

### Scenario: The user goes through the whole client with the keyboard, in both themes

- REQ → REQ-1, REQ-3, REQ-4, REQ-5
- Given → the operating system uses the dark theme, and later the light theme
- When → the user goes through every screen and dialog with Tab, Enter and Esc only
- Then → every action works, and the element with the focus is always marked
- And → all screens share the same look, and text and state indicators pass a WCAG 2.2 AA contrast check

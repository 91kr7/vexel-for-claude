---
batch: dialogs
feature: Dialogs
closed_req: [REQ-25, REQ-26, REQ-27, REQ-28]
depends: [visual-language]
---

# Batch — Dialogs

One shared dialog for the folder chooser, the resume history, the running-elsewhere warning and the stop confirmation. Each has one primary action, a cancel action, Enter and Esc.

Constraint → every requirement of `plan-claude_sessions_client` stays true (`requirements.md`, "Constraints on every batch").

## What this batch builds

- **Dialog frame** → the shared modal: title, content, one primary and one cancel action, Enter and Esc.
- **Warning dialog** → the Dialog frame with the look of a risky action.

## Decisions for this batch

- **Initial focus on "Annulla"** in the stop confirmation and the running-elsewhere warning (gatekeeper decision). Today both already open like this. With REQ-26, Enter there cancels until the user moves the focus.
- **Enter in the folder chooser path field** (gatekeeper decision) → if the field holds a folder other than the one listed, Enter lists it, as today. If the field holds the listed folder, Enter starts the session. So the user types a path, presses Enter to see it, and presses Enter again to start.
- **Resume history** → a click on an entry selects it. The primary action "Riprendi" resumes the selected entry and is disabled while nothing is selected. Today a click on an entry resumes at once. The dialog had no primary action, so REQ-25 needs this change.
- **Stacked dialogs** → the warning can open over the resume history. Esc and Enter act on the top dialog only.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area | Dialog frame: modal with title, content and one action row: a primary and a cancel button. Enter triggers the primary action unless a button has the focus, and Esc cancels. The focus stays inside while it is open and goes back on close. | REQ-25, REQ-26, REQ-27, REQ-1, REQ-4, REQ-5 | — |
| INT-2 | create | frontend, app area | Warning dialog: the Dialog frame with a warning icon, the warning colour and a danger-styled primary action. | REQ-28 | INT-1 |
| INT-3 | modify | `src/web/folders/FolderChooser.tsx` | Use the Dialog frame: primary "Avvia sessione", cancel "Annulla". Enter in the path field follows the decision above. | REQ-25, REQ-26, REQ-27 | INT-1 |
| INT-4 | modify | `src/web/history/ResumeDialog.tsx` | Use the Dialog frame. A click or the keyboard selects an entry, and the primary "Riprendi" resumes the selected one. Cancel "Annulla". | REQ-25, REQ-26, REQ-27, REQ-4 | INT-1 |
| INT-5 | modify | `src/web/history/RunningElsewhereWarning.tsx` | Use the Warning dialog: primary "Riprendi comunque", initial focus on "Annulla". Esc closes only the warning, and the dialog below stays open. | REQ-25, REQ-26, REQ-27, REQ-28 | INT-2 |
| INT-6 | modify | `src/web/sessions/StopSessionButton.tsx` | The confirmation "Terminare la sessione?" uses the Warning dialog: primary "Termina", initial focus on "Annulla". | REQ-25, REQ-26, REQ-27, REQ-28 | INT-2 |

## Human acceptance

### Scenario: The user starts a session with the keyboard only

- REQ → REQ-25, REQ-26
- Given → the folder chooser lists the folder the user typed, with "Avvia sessione" as its primary action next to "Annulla"
- When → the user presses Enter in the path field
- Then → the session starts in that folder and opens

### Scenario: The user sees that stopping a working session is risky

- REQ → REQ-25, REQ-26, REQ-28
- Given → the open session is working
- When → the user clicks "Termina"
- Then → the confirmation looks different from the folder chooser, with "Termina" as its primary action and the focus on "Annulla"
- And → Enter closes it, and the session keeps working

### Scenario: The user closes the warning with Esc

- REQ → REQ-27, REQ-28
- Given → the running-elsewhere warning is open over the resume history
- When → the user presses Esc
- Then → the warning closes, no session is resumed, and the resume history stays open

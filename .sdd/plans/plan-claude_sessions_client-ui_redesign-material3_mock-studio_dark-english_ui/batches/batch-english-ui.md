---
batch: english-ui
feature: English user interface
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16
depends: —
---

# Batch — English user interface

This batch creates no component. It changes UI text only: no behaviour, layout or style. The reasons for the texts below are in the "Assumptions" of `requirements.md`. The values are repeated here so that this file is enough on its own.

**Capitals** → Title Case for titles, buttons, labels, tooltips, chips and state names. Sentence case for sentences, hints, messages, errors and counters.

**States and outcomes:**

| Today | English |
|-------|---------|
| Lavora | Running |
| Richiede input | Needs Input |
| In attesa | Idle |
| Terminata | Ended |
| Fatto (tool card) | Completed |
| Fallito (tool card) | Error |
| Claude's name line | Claude |

## Texts fixed by this plan

From the mock `.sdd/mockups/studio-dark/mock.html` (REQ-13):

| Element | Today | English |
|---------|-------|---------|
| Top bar button | Nuova sessione | New Session |
| Rail first button: name and tooltip | Nuova sessione | New Claude Code Session |
| Rail "Sessioni" button | Sessioni | Sessions |
| New-session dialog: title | Nuova sessione | New Claude Code Session |
| New-session dialog: field label | Cartella del progetto | Working Directory Path |
| New-session dialog: primary action | Avvia sessione | Start Session |
| Dialog footer | Annulla | Cancel |
| User name line and avatar letter | Tu, T | You, U |
| Relative time | ora, N min fa | Just now, Nm ago |

Mock texts that are **not** used:

- "Stop / Interrupt" → it names one button. The client has two different actions, so they get "Interrupt" and "Terminate".
- "Permission Required" (banner tag) → the client's card tag shows the state name, "Needs Input". A session can need input for a question, not only for a permission.
- "Orchestrated Sessions" (list header) → the list title stays "Sessions", as the rail button that leads to it. The longer label and the needs-input chip would not fit the 224 px panel (REQ-15).
- "No Active Claude Code Sessions" and "+ Start First Session" (empty state) → the client shows this state when no session is open, also while sessions run. The mock text would be false then.

Other names chosen by this plan:

| Today | English |
|-------|---------|
| Riprendi (rail, dialog primary action) | Resume |
| Riprendi sessione | Resume Session |
| Riprendi qui | Resume Here |
| Riprendi comunque | Resume Anyway |
| Interrompi | Interrupt |
| Termina | Terminate |
| Rispondi | Reply |
| Apri | Open |
| Sola lettura | Read-only |
| Esterna | External |
| Maiusc (key badge) | Shift |

Every other text → a plain, natural English translation, with the capitals rule of `requirements.md`.

## Decisions for this batch

- **Times.** "HH:MM", "DD/MM/YYYY" and "DD/MM/YYYY HH:MM" stay as they are: they hold no words. The resume dialog's date and time keep the same shape: day before month, 24-hour clock, no AM/PM. A US English format breaks REQ-8.
- **Plurals.** One → singular. Any other number → plural. Examples: "1 needs input", "2 need input", "1 new message", "3 new messages".
- **Fit.** If an English text overflows its element at 1280 px, shorten the text. Do not change the layout.
- **Terminal.** The client writes "[Sessione disconnessa]" into the terminal itself, so it is in scope. Text that Claude Code writes is not.
- **Server.** The server sends error codes only, never UI text. It is not touched.
- **`.sdd/.archi`.** The developer changes the "GUI language" line in its "Assumptions" to English. This is a gatekeeper decision, and it has no INT because it serves no REQ.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/index.html` | Set the page language to English (`lang="en"`). The title "Vexel for Claude" stays. | REQ-10, REQ-11 | — |
| INT-2 | modify | `src/web/TopBar.tsx` | The button reads "New Session". | REQ-1, REQ-3, REQ-13 | — |
| INT-3 | modify | `src/web/NavigationRail.tsx` | Button names, tooltips and accessible names: "New Claude Code Session", "Sessions", "Resume". The `nav` label in English. | REQ-1, REQ-3, REQ-9, REQ-13, REQ-15 | — |
| INT-4 | modify | `src/web/AppLayout.tsx` | List panel title "Sessions" and the panel's accessible label in English. | REQ-1, REQ-9, REQ-15 | — |
| INT-5 | modify | `src/web/EmptyState.tsx` | Title and text in English. Buttons "New Session" and "Resume Session". | REQ-1, REQ-3, REQ-5 | — |
| INT-6 | modify | `src/web/NeedsInputSnackbar.tsx` | Text "<project> needs your input" and the button "Open". | REQ-3, REQ-5 | — |
| INT-7 | modify | `src/web/dialogs/Dialog.tsx` | Footer button "Cancel". Accessible name of "[Esc]" → "Close (Esc)". Every dialog, warnings included, takes these from here. | REQ-3, REQ-4, REQ-9, REQ-13 | — |
| INT-8 | modify | `src/web/feedback/ProgressIndicator.tsx` | Default label "Loading…". | REQ-5 | — |
| INT-9 | modify | `src/web/sessions/StateBadge.tsx` | The four state names of `requirements.md` "Assumptions". They stay on one line and are never cut. | REQ-2, REQ-13, REQ-15 | — |
| INT-10 | modify | `src/web/sessions/session-order.ts` | The four group titles in English. | REQ-1 | — |
| INT-11 | modify | `src/web/sessions/SessionList.tsx` | Loading, error and empty texts. Chip "External", line "Permission for <tool>", card tag with the state name, button "Reply". Rows keep their height. | REQ-1, REQ-3, REQ-5, REQ-15 | INT-9 |
| INT-12 | modify | `src/web/sessions/NeedsInputCounter.tsx` | Pill "1 needs input" or "N need input". | REQ-6, REQ-15 | — |
| INT-13 | modify | `src/web/sessions/RelativeTime.tsx` | "Just now" and "Nm ago". "HH:MM" and "DD/MM/YYYY" do not change. | REQ-7, REQ-8, REQ-13 | — |
| INT-14 | modify | `src/web/sessions/SessionView.tsx` | Button "Interrupt" and its accessible name. Terminal region name in English. Hint row "Ctrl" + "Shift" + "L" with English text. | REQ-1, REQ-3, REQ-9, REQ-15 | — |
| INT-15 | modify | `src/web/sessions/SessionView.tsx` | Loading label, the connection error messages, and the "[Sessione disconnessa]" line written into the terminal. | REQ-5, REQ-14 | — |
| INT-16 | modify | `src/web/sessions/StopSessionButton.tsx` | Button "Terminate" and its accessible name. Confirmation title and text. Failure message. | REQ-3, REQ-4, REQ-5, REQ-15 | INT-7 |
| INT-17 | modify | `src/web/folders/FolderChooser.tsx` | Title, field label and primary action from the mock table. Description, form name, "Recent", "Folders" and the radiogroup name in English. | REQ-1, REQ-3, REQ-4, REQ-9, REQ-13 | INT-7 |
| INT-18 | modify | `src/web/folders/FolderChooser.tsx` | Listing loading label and the five error messages. | REQ-5 | — |
| INT-19 | modify | `src/web/history/ResumeDialog.tsx` | Title "Resume Session", primary "Resume", radiogroup name, pill "Running in a terminal", loading and empty texts, error messages. | REQ-1, REQ-3, REQ-4, REQ-5, REQ-9 | INT-7 |
| INT-20 | modify | `src/web/history/ResumeDialog.tsx` | Session date and time in an English format: day before month, 24-hour clock, no AM/PM. | REQ-7, REQ-8 | — |
| INT-21 | modify | `src/web/history/RunningElsewhereWarning.tsx` | Title, banner text and primary action "Resume Anyway". | REQ-3, REQ-4 | INT-7 |
| INT-22 | modify | `src/web/external/ConversationView.tsx` | Header line, chip "Read-only", name lines "You" and "Claude", user avatar letter "U", accessible labels of the messages. | REQ-1, REQ-9, REQ-12, REQ-13 | — |
| INT-23 | modify | `src/web/external/ConversationView.tsx` | Tool cards: outcomes "Completed" and "Error", the lone result card "Result", the card label "Tool: <name>". | REQ-1, REQ-9, REQ-13, REQ-16 | — |
| INT-24 | modify | `src/web/external/ConversationView.tsx` | Loading, empty and error states, the full-content load error, and "1 new message" or "N new messages". | REQ-5, REQ-6 | — |
| INT-25 | modify | `src/web/external/ResumeHereButton.tsx` | Button "Resume Here" and its three error messages. | REQ-3, REQ-5 | INT-21 |
| INT-26 | modify | `src/web/` | Search the whole frontend for Italian UI text that is left, including `title` tooltips, accessible labels and rare states. Translate it. | REQ-14 | INT-1 to INT-25 |

## Human acceptance

### Scenario: The user reads the session list in English

- REQ → REQ-1, REQ-2, REQ-6, REQ-7, REQ-8, REQ-15
- Given → the window is 1280 px wide, two sessions need input and one session works
- When → the user opens the page
- Then → the list header shows "2 need input", and the entries show "Needs Input" and "Running" with times such as "Just now", "5m ago" or "14:05"
- And → every text stays inside its row, chip or badge

### Scenario: The user starts a session from English dialogs

- REQ → REQ-3, REQ-4, REQ-9, REQ-13
- Given → the page is open
- When → the user clicks "New Session" in the top bar
- Then → the dialog "New Claude Code Session" shows the field "Working Directory Path" and the buttons "Cancel" and "Start Session"
- And → a screen reader names the close control "Close (Esc)" and the rail buttons "New Claude Code Session", "Sessions" and "Resume"

### Scenario: The user reads an external session in English

- REQ → REQ-12, REQ-16, REQ-6
- Given → an external session with a failed tool call is open, and the user has scrolled up
- When → three new messages arrive
- Then → the button "3 new messages" appears
- And → the messages show "You" and "Claude", and the failed tool card shows "Error ▾"

### Scenario: The user sees an error in English

- REQ → REQ-5, REQ-14
- Given → the new-session dialog is open
- When → the user types a relative path and presses Enter
- Then → an English error message shows under the folders, and no Italian text is on the screen

### Scenario: The page declares English

- REQ → REQ-10, REQ-11
- Given → the page is open in the browser
- When → the user reads it with a screen reader
- Then → the tab title is "Vexel for Claude", and the screen reader uses English pronunciation

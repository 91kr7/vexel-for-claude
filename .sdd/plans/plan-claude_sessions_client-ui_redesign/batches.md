---
slug: claude_sessions_client-ui_redesign
date: 2026-11-05
status: validated
---

# Batches — UI/UX redesign of the Claude sessions client

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [visual-language](batches/batch-visual-language.md) | Visual language and keyboard use | REQ-2, REQ-6, REQ-7 | — | certified | The client follows the dark theme of the system |
| [layout](batches/batch-layout.md) | Layout | REQ-8, REQ-9, REQ-10 | visual-language | certified | The user sees the list and the open session side by side |
| [session-list](batches/batch-session-list.md) | Session list | REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16 | layout | certified | The user spots the session that needs input |
| [open-session](batches/batch-open-session.md) | Open session | REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24 | session-list | certified | The user works in a hosted session under its header |
| [dialogs](batches/batch-dialogs.md) | Dialogs | REQ-25, REQ-26, REQ-27, REQ-28 | visual-language | todo | The user starts a session with the keyboard only |
| [feedback-states](batches/batch-feedback-states.md) | Feedback states | REQ-1, REQ-3, REQ-4, REQ-5, REQ-29, REQ-30, REQ-31, REQ-32 | open-session, dialogs | todo | The user sees a stop in progress and its result |

Execution order: visual-language → layout → session-list → open-session. dialogs needs only visual-language, so it can run at any point after it. feedback-states comes last.

## Assumptions and decisions

- **Visual-language is a feature batch, not an enabling one.** It closes REQ-2, REQ-6 and REQ-7. It also gives every existing screen the new base look, and the later batches build on its theme tokens.
- **No behaviour change** (spec, accepted by the gatekeeper) → a constraint on every batch, not a REQ (`requirements.md`, "Constraints on every batch"). Each batch also keeps true the REQs that earlier batches of this plan closed.
- **Fonts and icons are files in the repository**, not npm dependencies. Font: Inter (SIL OFL 1.1). Icons: Lucide (ISC). Details are in `batch-visual-language.md`.
- **Success of start, stop and resume is shown by its result.** There is no extra notice. Details are in `batch-feedback-states.md`.
- **The resume history gets a primary action.** A click selects an entry, and "Riprendi" resumes it. Enter in the folder chooser path field first lists the folder, then starts. Details are in `batch-dialogs.md`.
- **Components that earlier batches of this plan build** are cited by name in later batches, for example the State badge of `session-list` in `open-session`. Their paths are in the indexes once their batch is done.

Gatekeeper decisions, taken at requirements validation. These are not human decisions.

- **The stop confirmation and the running-elsewhere warning keep the initial focus on "Annulla".** With REQ-26, Enter there cancels until the user moves the focus. See `batch-dialogs.md`.
- **An expanded tool call or tool output shows its full content (REQ-21).** It loads only on the first expand, so REQ-24 still holds. See `batch-open-session.md`.
- **Window widths from 1280 px to 3840 px (REQ-10).** A tool output counts as long above 5 lines (REQ-21).

Gatekeeper decision, taken at coverage validation.

- **Enter in the folder chooser path field (REQ-26).** It lists the typed folder when that folder is not the one listed. It starts the session when the field holds the listed folder. Reason → this keeps today's listing on Enter and still gives REQ-26 its primary action, with the smaller change. See `batch-dialogs.md`.

## Departures

None.

## Coverage check

Each INT is cited as `batch/INT-n`. Batch abbreviations: `vl` = visual-language, `ly` = layout, `sl` = session-list, `os` = open-session, `dl` = dialogs, `fs` = feedback-states.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | vl/INT-1, vl/INT-2, vl/INT-3, vl/INT-5, ly/INT-3, sl/INT-1, os/INT-1, dl/INT-1, fs/INT-1, fs/INT-2 | feedback-states |
| REQ-2 | vl/INT-1, vl/INT-6 | visual-language |
| REQ-3 | vl/INT-1, vl/INT-5, sl/INT-1, fs/INT-2 | feedback-states |
| REQ-4 | ly/INT-3, os/INT-10, dl/INT-1, dl/INT-4 | feedback-states |
| REQ-5 | vl/INT-1, vl/INT-5, dl/INT-1 | feedback-states |
| REQ-6 | vl/INT-2, vl/INT-3 | visual-language |
| REQ-7 | vl/INT-2, vl/INT-3, vl/INT-4 | visual-language |
| REQ-8 | ly/INT-1, ly/INT-2 | layout |
| REQ-9 | ly/INT-3, ly/INT-4 | layout |
| REQ-10 | ly/INT-2 | layout |
| REQ-11 | sl/INT-2 | session-list |
| REQ-12 | sl/INT-1, sl/INT-2 | session-list |
| REQ-13 | sl/INT-3 | session-list |
| REQ-14 | ly/INT-1, sl/INT-6 | session-list |
| REQ-15 | sl/INT-5 | session-list |
| REQ-16 | sl/INT-4 | session-list |
| REQ-17 | os/INT-1, os/INT-2, os/INT-3, os/INT-4 | open-session |
| REQ-18 | os/INT-3 | open-session |
| REQ-19 | os/INT-4 | open-session |
| REQ-20 | os/INT-5 | open-session |
| REQ-21 | os/INT-6, os/INT-7, os/INT-8, os/INT-9, os/INT-10 | open-session |
| REQ-22 | os/INT-11 | open-session |
| REQ-23 | os/INT-11 | open-session |
| REQ-24 | os/INT-3, os/INT-10 | open-session |
| REQ-25 | dl/INT-1, dl/INT-3, dl/INT-4, dl/INT-5, dl/INT-6 | dialogs |
| REQ-26 | dl/INT-1, dl/INT-3, dl/INT-4, dl/INT-5, dl/INT-6 | dialogs |
| REQ-27 | dl/INT-1, dl/INT-3, dl/INT-4, dl/INT-5, dl/INT-6 | dialogs |
| REQ-28 | dl/INT-2, dl/INT-5, dl/INT-6 | dialogs |
| REQ-29 | fs/INT-1, fs/INT-3, fs/INT-4, fs/INT-5, fs/INT-6, fs/INT-7, fs/INT-8, fs/INT-9 | feedback-states |
| REQ-30 | fs/INT-2, fs/INT-3, fs/INT-4, fs/INT-5, fs/INT-6, fs/INT-7, fs/INT-8, fs/INT-9, fs/INT-10, fs/INT-11 | feedback-states |
| REQ-31 | fs/INT-1, fs/INT-8, fs/INT-9, fs/INT-10, fs/INT-11 | feedback-states |
| REQ-32 | fs/INT-8, fs/INT-9, fs/INT-10, fs/INT-11 | feedback-states |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. There is no enabling INT.
- Five REQs span more than one batch. REQ-1, REQ-3, REQ-4 and REQ-5 cover every screen, so they close in feedback-states, the last batch. There, the whole client is checked against them. REQ-14 closes in session-list.

---
slug: popup_glass
date: 2026-11-20
requirements: requirements.md
status: validated
---

# Batches — Popup glass effect and termination popup margins

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| glass-popups | Glass popups | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — | todo | Popups show the terminal through a blurred, see-through background |
| termination-margins | Termination popup margins | REQ-11, REQ-12, REQ-13 | — | todo | The termination popup has the same margins as the other dialogs |

Execution order: glass-popups, then termination-margins. They have no logical dependency, but both change `src/web/dialogs/Dialog.tsx`, so they run one after the other.

## Assumptions and decisions

- **One source for the glass.** The 60% background and the 8px blur are tokens derived from the role tokens. So the three themes and the Windows 11 look follow with no value of their own (REQ-4). If the Windows 11 styles turn out to set their own popup fill, the implementer aligns it with the tokens.
- **Which popups.** From the specs, the app draws these popups: every dialog through the shared Dialog frame, the Plan Usage popover, the terminal search box, the tooltips of the rail, of the session header line pill, of the session token figures and of terminal hyperlinks, the needs-input snackbar, the short-message toast and the newer-version notice. The app draws no menu of its own: the Settings "menus" are sections inside a dialog.
- **Terminal search box.** It floats over the terminal, so it counts as a popup. Planner's reading of "everything that floats over the page".
- **"N new messages" button.** It floats over the conversation view, but it is a button, not a popup. It keeps `.vx-glass` and its current look.
- **Dialog contents.** Only the Dialog frame and the Settings dialog paint plain fills over the frame, according to their specs. Other dialogs (Resume, New session, folder chooser, session name) put content on the frame, and that content keeps its fills (REQ-5).
- **Termination margins.** The cause is not in the specs. The fix sits in the shared Dialog frame, so every warning dialog gets it (see batch termination-margins).
- **Tests.** Browser e2e group only. REQ-9 is judged by hand in the desktop app (requirements, assumption on REQ-9; knowledge base `electron-e2e-separate`).

## Departures

None.

## Coverage check

REQ → INT (each INT cited as `<batch>/INT-n`):

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | glass-popups/INT-1, INT-2, INT-3, INT-4, INT-5, INT-6, INT-7, INT-8, INT-9, INT-10 | glass-popups |
| REQ-2 | glass-popups/INT-1, INT-2, INT-3, INT-5, INT-6, INT-7, INT-8, INT-9, INT-10 | glass-popups |
| REQ-3 | glass-popups/INT-1, INT-11, INT-12, INT-13 | glass-popups |
| REQ-4 | glass-popups/INT-1 | glass-popups |
| REQ-5 | glass-popups/INT-2, INT-3, INT-4 | glass-popups |
| REQ-6 | glass-popups/INT-1, INT-6, INT-10 | glass-popups |
| REQ-7 | glass-popups/INT-2 | glass-popups |
| REQ-8 | glass-popups/INT-3 | glass-popups |
| REQ-9 | glass-popups/INT-3, INT-4 | glass-popups |
| REQ-10 | glass-popups/INT-3, INT-5, INT-7, INT-11, INT-12, INT-13 | glass-popups |
| REQ-11 | termination-margins/INT-1 | termination-margins |
| REQ-12 | termination-margins/INT-2 | termination-margins |
| REQ-13 | termination-margins/INT-1, INT-2 | termination-margins |

Result:

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. No enabling INT.
- Each REQ closes in a single batch.
- The "REQ closed" column, this table and the `closed_req` of each batch file carry the same lists.
- No batch creates a new component.

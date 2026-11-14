---
status: validated
---

# Batches — ui_restyle

Requirements: `requirements.md`. Batch files: `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| top-bar | Top bar | REQ-1, REQ-2, REQ-3 | — | certified | The top bar is lower and has no "New Session" button |
| window-buttons | Window buttons (desktop app, macOS look) | REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11 | — | in progress | The macOS-style window buttons are flat and glow under the pointer |
| project-row | Project row | REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28 | — | todo | The user marks a project from the star next to its name |
| session-star | Session star | REQ-29, REQ-30, REQ-31, REQ-32, REQ-33 | project-row | todo | The user marks a session from the star next to its name |
| terminal | Terminal | REQ-34, REQ-35 | — | todo | The terminal focus ring stays clear of the footer |

Execution order: top-bar, window-buttons, project-row, session-star, terminal. Only session-star has a real dependency. All batches edit `src/web/styles.css`, so they run one after the other.

## Assumptions and decisions

- **Mock.** The request mock is `.sdd/mockups/ui_restyle/mock.html`, copied from the session scratchpad (gatekeeper decision).
- **Shared star look.** Batch project-row adds star classes to `src/web/styles.css`. Batch session-star reuses them, so the two stars cannot drift apart. That is why session-star depends on project-row.
- **When the pop plays.** Only after the user's own press that marks. A favorite shown at load, or marked from another page, does not animate.
- **Star outside the row button.** The star sits on line 1 but is not nested inside the row or entry button, because a button inside a button is invalid HTML. This also keeps a star click from choosing the project or opening the session (REQ-24, REQ-30).
- **"Only Rename" in the session corner (REQ-31).** Only the star leaves that corner. "Resume" and "Dismiss" of an ended row stay as today, because the request does not remove them.
- **Session name.** The star goes after the name on line 1 of the entry, where the FavoriteIndicator is today.
- **FavoriteIndicator.** The component stays, because the resume history uses it. Rows and session entries no longer use it.
- **Tests and Electron.** Each existing test stays in its group. A new test that launches Electron goes only in the Electron group (knowledge base `electron-e2e-separate`).

## Departures

None.

## Coverage check

Every REQ is served by at least one INT, and every INT serves at least one REQ. No enabling INT. Every REQ closes in its own batch. No REQ spans two batches.

| REQ | Batch | INTs |
|-----|-------|------|
| REQ-1 | top-bar | INT-3, INT-4 |
| REQ-2 | top-bar | INT-1, INT-2, INT-4 |
| REQ-3 | top-bar | INT-2, INT-4 |
| REQ-4 | window-buttons | INT-2, INT-4 |
| REQ-5 | window-buttons | INT-1, INT-4 |
| REQ-6 | window-buttons | INT-2, INT-4 |
| REQ-7 | window-buttons | INT-2, INT-4 |
| REQ-8 | window-buttons | INT-3, INT-4 |
| REQ-9 | window-buttons | INT-3, INT-4 |
| REQ-10 | window-buttons | INT-3, INT-4 |
| REQ-11 | window-buttons | INT-2, INT-3, INT-4 |
| REQ-12 | project-row | INT-1, INT-8 |
| REQ-13 | project-row | INT-1, INT-8 |
| REQ-14 | project-row | INT-2, INT-8 |
| REQ-15 | project-row | INT-3, INT-7, INT-8 |
| REQ-16 | project-row | INT-3, INT-7, INT-8 |
| REQ-17 | project-row | INT-3, INT-7, INT-8 |
| REQ-18 | project-row | INT-7, INT-8 |
| REQ-19 | project-row | INT-2, INT-5, INT-6, INT-8 |
| REQ-20 | project-row | INT-6, INT-8 |
| REQ-21 | project-row | INT-6, INT-8 |
| REQ-22 | project-row | INT-5, INT-6, INT-8 |
| REQ-23 | project-row | INT-1, INT-8 |
| REQ-24 | project-row | INT-2, INT-8 |
| REQ-25 | project-row | INT-4, INT-5, INT-8 |
| REQ-26 | project-row | INT-2, INT-6, INT-7, INT-8 |
| REQ-27 | project-row | INT-4, INT-8 |
| REQ-28 | project-row | INT-3, INT-7, INT-8 |
| REQ-29 | session-star | INT-1, INT-4, INT-5 |
| REQ-30 | session-star | INT-3, INT-4, INT-5 |
| REQ-31 | session-star | INT-2, INT-5 |
| REQ-32 | session-star | INT-1, INT-2, INT-4, INT-5 |
| REQ-33 | session-star | INT-3, INT-5 |
| REQ-34 | terminal | INT-1, INT-2 |
| REQ-35 | terminal | INT-1, INT-2 |

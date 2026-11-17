---
slug: ui_transitions
date: 2026-11-17
requirements: requirements.md
status: validated
---

# Batches — UI transitions

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| modal-dialogs | Modal dialogs (also builds the motion base) | REQ-1, REQ-2 | — | certified | A dialog opens with a zoom and closes with the reverse |
| popovers | Popovers, snackbar, toasts | REQ-3, REQ-4 | modal-dialogs | certified | The popovers slide up on enter and slide down on leave |
| git-explorer-panel | Git Explorer panel | REQ-5, REQ-6 | modal-dialogs | certified | The Git Explorer slides in and out |
| session-switch | Session switch | REQ-10, REQ-11, REQ-12, REQ-13, REQ-33 | modal-dialogs | certified | Switching session cross-fades the main area |
| theme-change | Theme change | REQ-14, REQ-15 | modal-dialogs | certified | The theme changes with a colour dissolve |
| cascading-lists | Cascading lists | REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | modal-dialogs | certified | The session list enters in cascade |
| tab-change | Tab change (also closes the common rules) | REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32 | all the batches above | implemented | Switching tabs fades in the new content |

Execution order: modal-dialogs first. Then popovers, git-explorer-panel, session-switch, theme-change and cascading-lists, in any order. tab-change last.

## Assumptions and decisions

- **Motion base in the first batch.** Batch modal-dialogs builds the motion base and the exit presence, because the dialogs are the first user of both. No separate foundation batch.
- **Common rules (REQ-25 to REQ-32).** Each batch applies them to its own effect and tests them there. They close in tab-change, the last batch, when all seven effects exist.
- **Session list panel removed.** REQ-7, REQ-8 and REQ-9 are removed by human decision, with no batch. Their ids stay unused (convention `identifiers.md`: no renumbering).
- **Every modal dialog.** The effect lives in the shared Dialog frame, so every modal dialog gets it, the New session dialog included (REQ-1, human decision).
- **Focus (REQ-27).** It applies to the surfaces that take the focus or handle keys today. The Plan Usage popover still does not take the focus: changing that would change the app's behaviour, which is out of scope.
- **Colour dissolve.** A whole-page cross-fade from a picture of the old colours to the live new ones, such as the View Transitions API of Chromium (also in Electron 45). It covers the terminal canvas with no change to the terminal itself.
- **Terminal resizes.** The Git Explorer slide and the cross-fade send at most one `resize` to the running session, when they end.
- **Existing e2e tests.** A batch that breaks an existing e2e test with its effect adapts the test in the same batch. Turning off the effects for the whole suite is not allowed, because the effects would then go untested.
- **No Electron e2e.** The effects live in the page. Their tests run in the browser group (knowledge base `electron-e2e-separate`). The smoothness on WSL is a manual check, and nothing in this plan has a WSL-only path.

## Departures

None.

## Coverage check

REQ → INT (each INT cited as `<batch>/INT-n`):

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | modal-dialogs/INT-4 | modal-dialogs |
| REQ-2 | modal-dialogs/INT-3, INT-5, INT-6, INT-7 | modal-dialogs |
| REQ-3 | popovers/INT-1, INT-2, INT-3, INT-4 | popovers |
| REQ-4 | popovers/INT-1, INT-2, INT-3, INT-4, INT-5 | popovers |
| REQ-5 | git-explorer-panel/INT-1 | git-explorer-panel |
| REQ-6 | git-explorer-panel/INT-1, INT-2, INT-3 | git-explorer-panel |
| REQ-7, REQ-8, REQ-9 | removed by human decision | — |
| REQ-10 | session-switch/INT-1 | session-switch |
| REQ-11 | session-switch/INT-2, INT-4 | session-switch |
| REQ-12 | session-switch/INT-3 | session-switch |
| REQ-13 | session-switch/INT-3 | session-switch |
| REQ-14 | theme-change/INT-1, INT-2, INT-3 | theme-change |
| REQ-15 | theme-change/INT-1 | theme-change |
| REQ-16 | cascading-lists/INT-2 | cascading-lists |
| REQ-17 | cascading-lists/INT-5 | cascading-lists |
| REQ-18 | cascading-lists/INT-3 | cascading-lists |
| REQ-19 | cascading-lists/INT-4 | cascading-lists |
| REQ-20 | cascading-lists/INT-1, INT-2, INT-5 | cascading-lists |
| REQ-21 | cascading-lists/INT-2, INT-5 | cascading-lists |
| REQ-22 | cascading-lists/INT-1 | cascading-lists |
| REQ-23 | tab-change/INT-1 | tab-change |
| REQ-24 | tab-change/INT-2 | tab-change |
| REQ-25 | modal-dialogs/INT-2, INT-3; theme-change/INT-1; tab-change/INT-3 | tab-change |
| REQ-26 | modal-dialogs/INT-5; popovers/INT-2, INT-4, INT-5; git-explorer-panel/INT-1; session-switch/INT-2; theme-change/INT-1; cascading-lists/INT-4; tab-change/INT-2 | tab-change |
| REQ-27 | modal-dialogs/INT-4; popovers/INT-1; git-explorer-panel/INT-1 | tab-change |
| REQ-28 | modal-dialogs/INT-3; popovers/INT-3, INT-5; git-explorer-panel/INT-2; session-switch/INT-2; theme-change/INT-2; tab-change/INT-2 | tab-change |
| REQ-29 | tab-change/INT-3 (no code needed, see the batch notes) | tab-change |
| REQ-30 | modal-dialogs/INT-2; tab-change/INT-3 | tab-change |
| REQ-31 | modal-dialogs/INT-1; tab-change/INT-3 | tab-change |
| REQ-32 | modal-dialogs/INT-1 | tab-change |
| REQ-33 | session-switch/INT-4 | session-switch |

Result:

- Every REQ is served by at least one INT, except REQ-7, REQ-8 and REQ-9, which are removed.
- Every INT serves at least one REQ. No enabling INT.
- REQ-25 to REQ-32 are served across several batches and close in tab-change.
- The "REQ closed" column, this table and the `closed_req` of each batch file carry the same lists.

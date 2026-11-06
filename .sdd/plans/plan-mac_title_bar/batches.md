---
status: validated
---

# Batches — Mac-style title bar in the desktop app

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [title-bar](batches/batch-title-bar.md) | Top bar as title bar | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14 | — | certified | The Vexel bar moves and maximizes the window |
| [window-buttons](batches/batch-window-buttons.md) | Window buttons | REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28 | title-bar | todo | The red button closes the window to the tray |

Execution order: `title-bar`, then `window-buttons`.

## Assumptions and decisions

- **Two batches.** The spec's window frame, drag, state, theme and browser requirements make one feature, and its window buttons make the second. The buttons sit in the bar that `title-bar` turns into a drag area, so `window-buttons` comes after it. The gatekeeper accepted the split and the interim state on 2026-11-06 (see `requirements.md`).
- **Electron drag region.** The drag and the double click use Electron's drag region on the top bar. The desktop's own handling of that region gives the double click and the snap to the screen edges. The details are in `batch-title-bar`, "Decisions".
- **Resize on GNOME (REQ-2).** A window without the native frame keeps the resize from the edges on Linux. The developer checks it on the GNOME session of the user and reports it if it fails.
- **Startup page.** It gets the same bar: drag area in `title-bar`, window buttons in `window-buttons`. It stays in its light theme, because it shows only for a moment and cannot read the saved theme. The gatekeeper accepted this on 2026-11-06. To get the buttons it needs a small inline script (`batch-window-buttons`, "Decisions").
- **Window border.** No border is added. Without the native frame GNOME may draw no shadow, so this is a point to check by hand on GNOME (see `requirements.md`).
- **Merge with feat/terminal_addons.** That branch also changes `src/desktop/main.ts`, `src/desktop/desktop-bridge.cts` and `src/web/desktop-bridge.ts`. This plan adds to those files in small, separate blocks. The rules are in the "Decisions" of each batch.
- **Tests.** Electron checks only in the Electron group, and small (`electron-e2e-separate`). Each batch runs only the tests of what it touches (`narrow-batch-tests`). No batch runs the full suites. The gatekeeper runs the full suites once, after merging feat/terminal_addons (human decision).

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT. Every INT serves at least one REQ. Every REQ closes in the batch that serves it.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-title-bar/INT-1` | title-bar |
| REQ-2 | `batch-title-bar/INT-1` | title-bar |
| REQ-3 | `batch-title-bar/INT-1` | title-bar |
| REQ-4 | `batch-title-bar/INT-1` | title-bar |
| REQ-5 | `batch-title-bar/INT-1` | title-bar |
| REQ-6 | `batch-title-bar/INT-2`, `INT-3` | title-bar |
| REQ-7 | `batch-title-bar/INT-3` | title-bar |
| REQ-8 | `batch-title-bar/INT-3`, `INT-4` | title-bar |
| REQ-9 | `batch-title-bar/INT-3` | title-bar |
| REQ-10 | `batch-title-bar/INT-5` | title-bar |
| REQ-11 | `batch-title-bar/INT-4` | title-bar |
| REQ-12 | `batch-title-bar/INT-3` | title-bar |
| REQ-13 | `batch-title-bar/INT-3` | title-bar |
| REQ-14 | `batch-title-bar/INT-2`, `INT-3` | title-bar |
| REQ-15 | `batch-window-buttons/INT-7`, `INT-8` | window-buttons |
| REQ-16 | `batch-window-buttons/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-7` | window-buttons |
| REQ-17 | `batch-window-buttons/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-7` | window-buttons |
| REQ-18 | `batch-window-buttons/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-7` | window-buttons |
| REQ-19 | `batch-window-buttons/INT-5`, `INT-7` | window-buttons |
| REQ-20 | `batch-window-buttons/INT-7` | window-buttons |
| REQ-21 | `batch-window-buttons/INT-1`, `INT-2`, `INT-3`, `INT-4`, `INT-5`, `INT-7` | window-buttons |
| REQ-22 | `batch-window-buttons/INT-6`, `INT-7` | window-buttons |
| REQ-23 | `batch-window-buttons/INT-1`, `INT-3`, `INT-10` | window-buttons |
| REQ-24 | `batch-window-buttons/INT-9` | window-buttons |
| REQ-25 | `batch-window-buttons/INT-4`, `INT-8` | window-buttons |
| REQ-26 | `batch-window-buttons/INT-6`, `INT-7` | window-buttons |
| REQ-27 | `batch-window-buttons/INT-7` | window-buttons |
| REQ-28 | `batch-window-buttons/INT-7` | window-buttons |

- **REQ-3, REQ-4, REQ-5** already hold today. `batch-title-bar/INT-1` keeps them true when the native frame goes away, and the scenario "The window keeps its desktop behaviour" checks them.
- **REQ-12, REQ-13** already hold for the top bar. `batch-title-bar/INT-3` keeps the bar on the theme tokens now that it is the title bar.
- No enabling intervention.

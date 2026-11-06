---
status: validated
---

# Batches — Desktop app that also runs the backend

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [desktop-window](batches/batch-desktop-window.md) | Desktop window | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — | certified | The client opens in its own window from the application menu |
| [window-tray](batches/batch-window-tray.md) | Window and tray | REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17 | desktop-window | implemented | Sessions keep running with the window closed |

Execution order: `desktop-window`, then `window-tray`.

## Assumptions and decisions

- **Two batches.** The spec has two features. The tray changes the window that `desktop-window` creates, so `window-tray` comes after it.
- **Electron.** The raw request names it, and `.sdd/.archi` does not list it yet. Gatekeeper decision of 2026-11-06. `batch-desktop-window/INT-9` updates `.sdd/.archi`.
- **New desktop area.** The desktop app is a third area next to `src/server` and `src/web`, and it imports neither. Its exact folder and file names are the developer's choice. They record them in the indexes.
- **Backend outside Electron.** The desktop app starts the server as a separate process with the system Node 22. node-pty therefore needs no rebuild for Electron.
- **The page does not change.** The window loads the page that the backend serves. So no frontend file changes, and REQ-3 holds by construction.
- **One server change.** `batch-window-tray/INT-5` adds an orderly shutdown to `src/server/main.ts`. Today the server has no signal handling, so the end of the sessions on stop is not certain.
- **Modify targets created by this plan.** `window-tray` modifies components that `desktop-window` creates. Their paths do not exist yet, so its `Where` column names them by component. The developer finds the paths in the indexes.
- **Tray on Linux.** Some desktops, such as GNOME without the AppIndicator extension, hide tray icons. This is a risk of the spec, not a REQ. The batch does not work around it.
- **Electron sandbox.** On some Linux systems the Electron sandbox does not start from `node_modules`. If it fails, the developer of `desktop-window` records the fix as an assumption in `.sdd/.archi`.
- **Placement details** of each batch (address, timeouts, texts, labels, dialog) are in the "Decisions" section of its batch file. The gatekeeper accepted the 15-second limit, the texts, the labels and the dialog wording on 2026-11-06. These are gatekeeper decisions, not human decisions.

## Departures

None. No human decision contradicts the spec. REQ-17 is a reading of the spec, confirmed by the gatekeeper (see `requirements.md`).

## Coverage check

Every REQ is served by at least one INT. Every REQ closes in the batch that serves it.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-desktop-window/INT-3`, `INT-7` | desktop-window |
| REQ-2 | `batch-desktop-window/INT-5`, `INT-6`, `INT-7` | desktop-window |
| REQ-3 | `batch-desktop-window/INT-3` | desktop-window |
| REQ-4 | `batch-desktop-window/INT-1`, `INT-3` | desktop-window |
| REQ-5 | `batch-desktop-window/INT-1` | desktop-window |
| REQ-6 | `batch-desktop-window/INT-4`; `batch-window-tray/INT-2` | desktop-window |
| REQ-7 | `batch-desktop-window/INT-1`, `INT-2`, `INT-3` | desktop-window |
| REQ-8 | `batch-desktop-window/INT-1` | desktop-window |
| REQ-9 | `batch-desktop-window/INT-1`, `INT-3` | desktop-window |
| REQ-10 | `batch-desktop-window/INT-1` | desktop-window |
| REQ-11 | `batch-window-tray/INT-2` | window-tray |
| REQ-12 | `batch-window-tray/INT-1` | window-tray |
| REQ-13 | `batch-window-tray/INT-1`, `INT-2` | window-tray |
| REQ-14 | `batch-window-tray/INT-1`, `INT-4` | window-tray |
| REQ-15 | `batch-window-tray/INT-4`, `INT-5` | window-tray |
| REQ-16 | `batch-window-tray/INT-4` | window-tray |
| REQ-17 | `batch-window-tray/INT-3`, `INT-4` | window-tray |

- **REQ-6** closes in `desktop-window`. In `window-tray` the window can be hidden, so `batch-window-tray/INT-2` keeps REQ-6 true in that case. The scenario "A second launch brings back the closed window" checks it again.
- **Enabling interventions**, which serve no REQ: `batch-desktop-window/INT-8` (typecheck and build of the desktop area) and `batch-desktop-window/INT-9` (`.sdd/.archi` update, requested by the gatekeeper).
- Every other INT serves at least one REQ.

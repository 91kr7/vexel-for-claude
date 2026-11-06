---
batch: desktop-window
feature: Desktop window
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10
depends: —
---

# Batch — Desktop window

The client opens in an Electron window, from the Linux application menu. The window starts the backend, or uses one that already runs. The page and the backend do not change.

## What this batch builds

- **Desktop app** (new desktop area) → the Electron main process: one window, one running instance, and the start of the backend.
- **Backend launcher** (desktop area) → finds a running backend or starts one, and tells the desktop app when the backend is ready or has failed.
- **Startup page** (desktop area) → the page the window shows while the backend starts, and the error when it cannot start.
- **Menu entry and install command** (desktop area) → the "Vexel for Claude" entry of the application menu, with its icon, and the command that installs it.

## Decisions

- **Electron** is the desktop runtime. The raw request names it (gatekeeper decision, 2026-11-06).
- **The backend runs outside Electron.** The desktop app starts the server as a separate process with the system Node 22, so node-pty keeps its current build. It runs the same command as `npm start` directly, not through npm, so that a stop signal reaches the server in `window-tray`.
- **Address.** `127.0.0.1`, port from `PORT`, default `3000`, the same as the server. The window loads the page from that address. LocalAccessGuard already accepts it, so the guard does not change (REQ-8, REQ-10).
- **A running backend** is one where `GET /api/health` answers `200` with `{ status: "ok" }`. Any other answer, or none, means that no backend runs.
- **Ready and failed.** The backend is ready when `GET /api/health` answers. It has failed when its process exits first, or when it is not ready within 15 seconds. If another program holds the port, the server cannot bind and exits, so this case is a failure too.
- **Startup page text.** "Starting the backend…" while waiting. On failure: "The backend could not start." followed by the last lines of the backend output. The page uses the client's dark "Studio" colours. It cannot import `src/web` (see `.sdd/.archi` conventions), so it carries its own small style.
- **Built page.** The install command runs the build, so the server has `dist/web` to serve. A launch does not build.
- **Temporary close.** Until `window-tray`, closing the window quits the desktop app. A backend that the app started keeps running (gatekeeper decision, see `requirements.md`). So the launcher starts it detached from the app.
- **Name and icon.** The menu entry is "Vexel for Claude", the name in the TopBar. The icon uses the "VX" logo mark.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area (new, next to backend and frontend) | Backend launcher: check `GET /api/health` on the backend address and reuse a backend that answers. Otherwise start the server detached, wait until it is ready, and report failure with its last output lines. It also reports whether it started the backend. | REQ-4, REQ-5, REQ-7, REQ-8, REQ-9, REQ-10 | — |
| INT-2 | create | desktop area | Startup page: a loading state "Starting the backend…" and an error state "The backend could not start." with the output lines it receives. Dark "Studio" colours, English text. | REQ-7 | — |
| INT-3 | create | desktop area | Desktop app (Electron main process): open one window on the startup page, run the launcher, then load the client page from the backend address. On failure, show the error state. Closing the window quits the app. | REQ-1, REQ-3, REQ-4, REQ-7, REQ-9 | INT-1, INT-2 |
| INT-4 | create | desktop area | Single instance: a second launch passes control to the running app, which shows and focuses its window. The second launch then exits. | REQ-6 | INT-3 |
| INT-5 | create | desktop area | App icon from the "VX" logo mark, in the sizes the window and the menu entry need. | REQ-2 | — |
| INT-6 | create | desktop area | Menu entry "Vexel for Claude" that launches the desktop app from this repository, with the icon. An install command builds the page and copies the entry into the user's application menu. | REQ-2 | INT-5 |
| INT-7 | modify | `package.json` | Add Electron. Add the scripts that launch the desktop app and run the install command. | REQ-1, REQ-2 | INT-3, INT-6 |
| INT-8 | modify | `tsconfig.json` | Enabling. Add a config for the desktop area to the solution file, with Node and Electron types, so `npx tsc -b` checks it. Add the step that turns it into the code Electron runs. | — | INT-7 |
| INT-9 | modify | `.sdd/.archi` | Enabling. Record Electron in Stack and Dependencies, the desktop area in Structure and Conventions (it does not import `src/server` or `src/web`), and the launch and install commands. | — | INT-7, INT-8 |

The developer writes the specs of the new components and records them in the indexes (`.sdd/modules/`). The paths they record there are the ones `window-tray` modifies.

## Human acceptance

### Scenario: The client opens in its own window from the application menu

- REQ → REQ-1, REQ-2, REQ-3, REQ-4, REQ-9
- Given → the desktop app is installed, and no backend runs
- When → the user opens "Vexel for Claude" from the application menu
- Then → a window shows the client page with its session list within 5 seconds
- And → the page has the same features and look as in the browser

### Scenario: The desktop app uses a backend that already runs

- REQ → REQ-5
- Given → the user started the backend with `npm start` and started a session from the browser
- When → the user opens "Vexel for Claude"
- Then → the window shows that same session, and no second backend starts

### Scenario: A second launch shows the existing window

- REQ → REQ-6
- Given → the desktop app runs with its window open
- When → the user opens "Vexel for Claude" from the menu again
- Then → the existing window comes to the front, and no second window opens

### Scenario: The browser client stays available and local

- REQ → REQ-8, REQ-10
- Given → the desktop app started the backend
- When → the user opens `http://127.0.0.1:3000` in a browser on the same machine
- Then → the browser shows the same sessions as the window
- And → from another machine of the network, the client address does not answer

### Scenario: The window says that the backend could not start

- REQ → REQ-7
- Given → no backend runs, and another program holds port 3000
- When → the user opens "Vexel for Claude"
- Then → the window shows "The backend could not start." with the reason, not an empty page

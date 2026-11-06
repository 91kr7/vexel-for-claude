---
batch: file-drop
feature: File drop
closed_req: [REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54]
depends: [clickable-links]
---

# Batch file-drop — File drop

The REQs are in `.sdd/plans/plan-terminal_addons/requirements.md`. "The terminal" is the xterm.js terminal of SessionView. "Ended session" is a hosted session whose header shows "Ended".

## What this batch builds

- **Dropped paths text** → turns a list of absolute paths into the text that the drop inserts.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, sessions area | Dropped paths text: each path in drop order, followed by one space. A path with spaces or shell-special characters is wrapped in single quotes, with `'` written as `'\''`. Other paths stay as they are. | REQ-48, REQ-49 | — |
| INT-2 | modify | `src/desktop/desktop-bridge.cts` | Add a third function: the absolute path of a dropped file or folder, through Electron `webUtils`. An empty result means no path. | REQ-46 | — |
| INT-3 | modify | `src/web/desktop-bridge.ts` | The page side exposes the path lookup of INT-2. In a browser there is none. | REQ-46 | INT-2 |
| INT-4 | modify | `src/web/desktop-bridge.ts` | With the bridge, a file dropped anywhere in the page does nothing: the page prevents the default of `dragover` and `drop`. The terminal handles its own drop (INT-5). | REQ-53 | — |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | Desktop app, live session: a file dragged over the panel → the panel shows an "accepts the drop" state. On drop → the paths, then INT-1, then `paste` into the terminal. Bracketed paste applies when Claude Code asks for it, and no Enter is sent. | REQ-46, REQ-47, REQ-48, REQ-50, REQ-51 | INT-1, INT-3 |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | Ended session: no "accepts the drop" state, and a drop inserts nothing. | REQ-52 | INT-5 |
| INT-7 | modify | `src/web/sessions/SessionView.tsx` | Browser client: no "accepts the drop" state. A drop on the terminal inserts nothing and shows "Paths can be dropped only in the desktop app." over the panel for a few seconds, announced as a status. | REQ-54 | — |

## Decisions

- **No `File.path`.** Electron 45 no longer gives the path on the dropped `File`. Only the preload can read it, with `webUtils.getPathForFile`. The sandboxed preload can `require` `electron`, so INT-2 stays within the `.archi` rule.
- **Page guard, no main-process change.** The page prevents the default drop (INT-4), so the window never opens the file. This batch does not change `src/desktop/main.ts`.
- **Folders.** A folder from the file manager arrives as a `File` entry, and `webUtils` gives its path too. If the developer finds a case where it does not, they report it.
- **Browser drag.** In the browser the panel shows no "accepts the drop" state (gatekeeper decision).
- **Specs.** The developer updates the SessionView, DesktopBridge and useDesktopBridge specs, and writes the spec of the new function.

## Tests

- Run e2e with `E2E_PORT` and `E2E_CLAUDE_DIR` set for this cycle (batch `clickable-links`, INT-1 and INT-2).
- Browser e2e for the desktop path: a stub `window.desktopBridge`, added with `addInitScript`, gives the paths. The fake CLI shows what it received.
- Electron group (`npm run test:e2e:desktop`), one check only: the bridge gives the absolute path of a real file from disk (INT-2). Everything else is checked by Vitest or by the browser e2e.

## Human acceptance

### Scenario: The user drops files on the terminal in the desktop app

- REQ → REQ-46, REQ-47, REQ-48, REQ-49, REQ-50, REQ-51
- Given → the desktop app shows a live hosted session
- When → the user drags `/home/me/shot.png` and the folder `/home/me/My Docs` from the file manager and drops them on the terminal
- Then → while dragging, the panel showed that it accepts the drop. After the drop, Claude Code's input shows `/home/me/shot.png '/home/me/My Docs' ` as a paste.
- And → nothing is sent until the user presses Enter

### Scenario: A drop on an ended session inserts nothing

- REQ → REQ-52
- Given → the desktop app shows a session whose header shows "Ended"
- When → the user drops a file on its terminal
- Then → the terminal does not change

### Scenario: A file dropped elsewhere in the window does not replace the client

- REQ → REQ-53
- Given → the desktop app is open
- When → the user drops a file on the session list
- Then → the window still shows the client, and the file does not open

### Scenario: The browser client explains that it cannot take a drop

- REQ → REQ-54
- Given → the browser client shows a live hosted session
- When → the user drops a file on the terminal
- Then → the terminal does not change, and the message "Paths can be dropped only in the desktop app." shows over the panel

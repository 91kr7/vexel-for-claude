---
batch: title-bar
feature: Top bar as title bar
closed_req: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14
depends: —
---

# Batch — Top bar as title bar

The desktop window loses its native title bar. The Vexel top bar moves the window and maximizes it by double click. The window buttons come in `window-buttons`.

## Decisions

- **Drag area.** The top bar uses the Electron drag region (`-webkit-app-region: drag`), and every control on it is `no-drag`. The logo and the brand are not controls, so they are part of the drag area. This keeps an empty area at every width (REQ-9) without a minimum window width.
- **Double click (REQ-7).** It comes from the drag region. Chromium on Linux applies the desktop's title bar double click action to it, which is maximize or restore on GNOME. No page code handles it. If it does not work on GNOME, the developer reports it and does not invent a workaround.
- **Desktop only (REQ-14).** The top bar turns on the drag area only when the page runs in the desktop window, that is when `window.desktopBridge` exists.
- **Theme (REQ-12, REQ-13).** The top bar already uses the theme tokens. It keeps them, and it gets no colour of its own.
- **Startup page (REQ-10).** It gets a 48 px bar at the top, all of it a drag area, in its light theme, with no content in this batch. It stays light whatever theme the client saved (`plan-light_theme/REQ-20`), because it cannot read that theme.
- **Dialogs (REQ-11).** The backdrop sets no drag value, so the drag area of the top bar under it still works. The dialog frame is `no-drag`, so a tall dialog over the top bar keeps its clicks.
- **Merge with feat/terminal_addons.** The changes to `src/desktop/main.ts` and `src/web/desktop-bridge.ts` are small and separate: one window option, one new export. They do not rewrite the window open handler, the menu or the existing bridge functions.
- **Tests.**
  - Electron checks go only in the Electron group (`npm run test:e2e:desktop`), and they stay small: one spec for this batch.
  - The other checks are unit tests and browser e2e of the changed files, following `narrow-batch-tests`.
  - The batch does not run the full suites.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/desktop/main.ts` | Open the window without the native frame. Keep its title, icon, size, resize from the edges and the close that hides it to the tray. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5 | — |
| INT-2 | modify | `src/web/desktop-bridge.ts` | Add a separate export that tells whether the page runs in the desktop window. It is false in a browser. | REQ-6, REQ-14 | — |
| INT-3 | modify | `src/web/TopBar.tsx` | In the desktop window, the bar is a drag area and its controls are not. The logo, the brand and the space between the two ends stay draggable at every width. In the browser, nothing changes. | REQ-6, REQ-7, REQ-8, REQ-9, REQ-12, REQ-13, REQ-14 | INT-2 |
| INT-4 | modify | `src/web/dialogs/Dialog.tsx` | The dialog frame is never part of the drag area. The backdrop leaves the drag area of the top bar working. | REQ-8, REQ-11 | — |
| INT-5 | modify | `src/desktop/startup-page.ts` | Add a 48 px light bar at the top of the loading and the error states. All of it is a drag area. | REQ-10 | — |

The developer updates the specs of DesktopApp, useDesktopBridge, TopBar, Dialog and StartupPage.

## Human acceptance

### Scenario: The Vexel bar moves and maximizes the window

- REQ → REQ-1, REQ-6, REQ-7, REQ-9
- Given → the desktop app shows the client in a window that is not maximized, and no GNOME title bar shows above the Vexel bar
- When → the user drags the top bar by the "Vexel for Claude" brand
- Then → the window follows the pointer
- And → a double click on the same place maximizes the window, and a second double click restores it

### Scenario: The controls of the top bar do not move the window

- REQ → REQ-8
- Given → the desktop window is open and not maximized
- When → the user double clicks "New Session"
- Then → the "New Session" dialog opens, and the window keeps its place and its size

### Scenario: The window keeps its desktop behaviour

- REQ → REQ-2, REQ-3, REQ-4, REQ-5
- Given → the desktop window is open and a session is working
- When → the user presses the desktop's close shortcut
- Then → the window disappears, the tray icon stays and the session keeps working
- And → after "Open Window" in the tray, the window resizes from its bottom right corner, and the task switcher lists it as "Vexel for Claude"

### Scenario: The bar moves the window with a dialog open

- REQ → REQ-11
- Given → the "New Session" dialog is open in the desktop window
- When → the user drags the top bar by the brand
- Then → the window moves, and the dialog stays open

### Scenario: The bar moves the window on the startup page

- REQ → REQ-10
- Given → the desktop app is starting the backend, or shows "The backend could not start."
- When → the user drags the bar at the top of the window
- Then → the window moves

### Scenario: The bar follows the theme

- REQ → REQ-12, REQ-13
- Given → the desktop window shows the client in the dark theme, with a dark top bar
- When → the user clicks the theme switch
- Then → the top bar turns light together with the rest of the client

### Scenario: The browser keeps its top bar

- REQ → REQ-14
- Given → the client is open in a browser
- When → the user drags the top bar
- Then → nothing moves, and the top bar looks as before this change

---
batch: window-buttons
feature: Window buttons
closed_req: REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28
depends: title-bar
---

# Batch — Window buttons

The top bar gets the red, yellow and green buttons that close the window to the tray, minimize it, and maximize or restore it. The startup page gets the same buttons.

## What this batch builds

- **Window actions** (desktop area) → the main process side of the window buttons. It closes, minimizes, and maximizes or restores the window when the page asks. It tells the page when the window is maximized or restored.
- **Window buttons** (web, app area) → the group of three round buttons at the left end of the top bar.

## Decisions

- **Close (REQ-16).** The red button asks for the same close as the native close button. The existing close handler then hides the window to the tray. The red button does not hide the window by itself.
- **Look.** It follows the macOS buttons:
  - 12 px circles, 8 px apart, before the logo, at the left end of the top bar.
  - Red `#ff5f57`, yellow `#febc2e`, green `#28c840`, the same in both themes.
  - Dark symbols, about 50 % black, on the colours.
- **Symbols.** Close → a cross. Minimize → a minus. Maximize → two arrows that point out. Restore → two arrows that point in.
- **Accessible names (REQ-27).** "Close", "Minimize", and "Maximize" or "Restore" by the window state. English, like the rest of the GUI.
- **Keyboard (REQ-28).** The buttons are real buttons in the Tab order of the top bar. They show the focus ring of the other top bar controls.
- **Dialogs (REQ-24).** The window buttons stay visible and clickable above the dialog backdrop. The dialog focus trap does not take them in: the dialog keeps its keyboard rules.
- **Startup page (REQ-23).** The page cannot import `src/web`, so it copies the look of the buttons.
  - A small inline script calls `window.desktopBridge`.
  - Its Content-Security-Policy allows that one script and nothing more.
  - This replaces the StartupPage rule "no script". The developer updates that spec.
- **Bridge on the startup page.** The DesktopBridge preload also runs on the startup page. The developer checks it, and reports it if it does not.
- **Who may ask.** The window actions accept only requests from the window's own web contents, like the open-session report today.
- **Merge with feat/terminal_addons.**
  - `src/desktop/main.ts` gets one call that connects the window actions to the window, after the window is created.
  - `src/desktop/desktop-bridge.cts` and `src/web/desktop-bridge.ts` get their additions in a separate block.
  - None of them rewrites the window open handler, the menu or `getPathForFile`.
- **Tests.** This is the last batch.
  - It runs only its new tests and the tests of the files it changed, following `narrow-batch-tests`.
  - Electron checks go only in the Electron group (`npm run test:e2e:desktop`) and stay small.
  - It does not run the full suites. The gatekeeper runs them once, after the merge of feat/terminal_addons.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | desktop area | Window actions: close, minimize, and maximize or restore the window, for its own web contents only. Send the maximized state to the page on each change, and answer the current state. | REQ-16, REQ-17, REQ-18, REQ-21, REQ-23 | — |
| INT-2 | modify | `src/desktop/main.ts` | Connect the window actions to the window, as one separate addition. | REQ-16, REQ-17, REQ-18, REQ-21 | INT-1 |
| INT-3 | modify | `src/desktop/desktop-bridge.cts` | Add to `window.desktopBridge`, in a separate block: close, minimize, maximize or restore, the current maximized state, and a listener of its changes. | REQ-16, REQ-17, REQ-18, REQ-21, REQ-23 | INT-1 |
| INT-4 | modify | `src/web/desktop-bridge.ts` | Add, in a separate block, the page side of these functions and a hook with the maximized state. Nothing in a browser. | REQ-16, REQ-17, REQ-18, REQ-21, REQ-25 | INT-3 |
| INT-5 | modify | `src/web/icons/Icons.tsx` | Add the four symbols: close, minimize, maximize, restore. | REQ-19, REQ-21 | — |
| INT-6 | modify | `src/web/theme/tokens.css` | Add the red, yellow and green of the buttons and the colour of their symbols, the same in both themes. | REQ-22, REQ-26 | — |
| INT-7 | create | web, app area | Red, yellow and green round buttons that close, minimize, and maximize or restore the window. With the pointer over the group, all three show their symbol, and the green one follows the window state. Names, keyboard and focus ring as in the top bar. | REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-26, REQ-27, REQ-28 | INT-4, INT-5, INT-6 |
| INT-8 | modify | `src/web/TopBar.tsx` | In the desktop window, show the window buttons at the left end, before the logo, outside the drag area. In the browser, no buttons and no space for them. | REQ-15, REQ-25 | INT-7 |
| INT-9 | modify | `src/web/dialogs/Dialog.tsx` | While a dialog is open, the backdrop leaves the window buttons visible and clickable above it. | REQ-24 | INT-8 |
| INT-10 | modify | `src/desktop/startup-page.ts` | Put the three window buttons, with the same look and symbols, at the left of the startup bar. They are not part of the drag area. A small inline script calls the bridge, and the page policy allows only that script. | REQ-23 | INT-3 |

The developer updates the specs of DesktopApp, DesktopBridge, useDesktopBridge, IconSet, ThemeTokens, TopBar, Dialog and StartupPage. They write the specs of the two new components, and update the indexes.

## Human acceptance

### Scenario: The red button closes the window to the tray

- REQ → REQ-15, REQ-16
- Given → the desktop window shows the client, with the red, yellow and green buttons at the left of the top bar, and a session is working
- When → the user clicks the red button
- Then → the window disappears, the tray icon stays and the session keeps working
- And → "Open Window" in the tray shows the window with the same session

### Scenario: The yellow and green buttons minimize, maximize and restore

- REQ → REQ-17, REQ-18, REQ-21
- Given → the desktop window is open and not maximized
- When → the user clicks the green button
- Then → the window fills the screen, and the green symbol changes from "maximize" to "restore"
- And → a second click on the green button restores the window, and a click on the yellow one minimizes it

### Scenario: The symbols show on hover, in both themes

- REQ → REQ-19, REQ-20, REQ-22, REQ-26
- Given → the desktop window is in the dark theme, with the pointer away from the buttons, so they show only their colours
- When → the user moves the pointer over the yellow button
- Then → all three buttons show their symbol: a cross, a minus and the maximize arrows
- And → after a switch to the light theme the buttons keep the same colours, and their symbols are still easy to read

### Scenario: The buttons work with the keyboard

- REQ → REQ-27, REQ-28
- Given → the desktop window is open, and a screen reader is on
- When → the user presses Tab until the yellow button has the focus
- Then → the button shows a focus ring, and the screen reader says "Minimize"
- And → Enter minimizes the window

### Scenario: The buttons work with a dialog open and on the startup page

- REQ → REQ-23, REQ-24
- Given → the "New Session" dialog is open in the desktop window
- When → the user clicks the green button
- Then → the window maximizes, and the dialog stays open
- And → while the desktop app is starting the backend, the three buttons show at the top left of the startup page and work too

### Scenario: The browser shows no window buttons

- REQ → REQ-25
- Given → the client is open in a browser
- When → the user looks at the top bar
- Then → it shows no red, yellow or green buttons, and the logo is at the left end as before

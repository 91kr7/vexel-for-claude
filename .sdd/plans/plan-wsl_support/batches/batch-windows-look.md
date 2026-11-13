---
batch: windows-look
feature: Windows 11 look
closed_req: [REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40]
depends: []
---

# Batch — Windows 11 look

Source: the branch `feature/wsl-support` changes and adds the files of the table below for this feature. Port them and adapt them to main.

Words: a "look" is the visual style of the client, the "current look" of main today or the "Windows 11 look". A look is not a theme: the light and dark themes stay, and each look has both. "macOS buttons" are the red, yellow and green window buttons of today.

## What this batch builds

- **Look store** → holds the active look, marks it on the page root, and saves it, as ThemeStore does for the theme.
- **Look switch** → the top-bar button that shows the active look and changes it.
- **Windows 11 stylesheet** → the styles of the Windows 11 look, for the light and the dark theme.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | app module, `src/web/theme` area | Look store: the active look, its mark on the page root, the toggle that saves it in `localStorage`. Start look: the current look. A change only moves the mark, with no reload or remount. | REQ-16, REQ-20, REQ-21, REQ-22, REQ-24 | — |
| INT-2 | modify | `src/web/index.html` | Before the first paint, read the saved look and mark it on the root, as the inline script does for the theme. Same key and validity rule as INT-1. | REQ-23, REQ-24 | INT-1 |
| INT-3 | create | app module, `src/web/theme` area | Windows 11 stylesheet, active only under the look mark, for both themes: Mica-like surfaces in the client's own colours, the Windows 11 default accent blue, Segoe UI with a sans-serif fallback, 4px and 8px corners. | REQ-17, REQ-25, REQ-26, REQ-27 | INT-1 |
| INT-4 | create | app module, `src/web/theme` area, in the stylesheet of INT-3 | Give text WCAG 2.2 AA contrast in light and dark. Change the accent tone only where contrast needs it. Keep the five status colours easy to tell apart. | REQ-36, REQ-37, REQ-38 | INT-3 |
| INT-5 | modify | `src/web/styles.css` | Load the Windows 11 stylesheet. Leave every rule of the current look unchanged. The terminal panel stays dark in both looks. | REQ-17, REQ-34 | INT-3 |
| INT-6 | modify | `src/web/icons/Icons.tsx` | Add the icons of the look switch and of the Windows-style minimize, maximize, restore and close buttons. | REQ-19, REQ-28 | — |
| INT-7 | create | app module, `src/web` area | Look switch: icon button that shows the active look and toggles it, with an accessible name, keyboard use and the focus ring. | REQ-18, REQ-19, REQ-39 | INT-1, INT-6 |
| INT-8 | modify | `src/web/WindowButtons.tsx` | In the Windows 11 look, show Windows-style minimize, maximize/restore and close buttons, with the same actions as the macOS buttons. Each has an accessible name, keyboard use and the focus ring. The current look keeps the macOS buttons. | REQ-28, REQ-29, REQ-30, REQ-31, REQ-34, REQ-39, REQ-40 | INT-1, INT-6 |
| INT-9 | modify | `src/web/TopBar.tsx` | Put the look switch next to the theme switch, as a `no-drag` control. In the Windows 11 look, put the window buttons at the right end. Keep an empty drag area at every width, and no window buttons in a browser. | REQ-18, REQ-28, REQ-32, REQ-33, REQ-35 | INT-7, INT-8 |

Notes for the implementer:

- The app must not bundle Segoe UI. The font list names it, and the fallback applies when it is not installed.
- The Windows 11 look reads no Windows accent colour and no wallpaper. The app does not detect WSL.
- Update the indexes and specs: TopBar, WindowButtons, IconSet, WebEntry, and the three new components (module app).
- Tests that open the desktop window go in the Electron e2e group (`npm run test:e2e:desktop`), never in the default e2e run. Knowledge base entry `electron-e2e-separate`.

## Human acceptance

### Scenario: The user switches to the Windows 11 look and back

- REQ → REQ-16, REQ-18, REQ-19, REQ-20, REQ-21, REQ-25, REQ-26, REQ-27
- Given → the client shows the current look, a session is open and its content is scrolled up
- When → the user presses the look switch next to the theme switch
- Then → the whole client shows the Windows 11 look at once, with the same session open at the same scroll position
- And → the look switch shows the Windows 11 look, and a second press brings back the current look

### Scenario: Look and theme change apart

- REQ → REQ-17, REQ-36, REQ-37, REQ-38
- Given → the client shows the Windows 11 look in the dark theme, with sessions in every state
- When → the user switches to the light theme
- Then → the client stays in the Windows 11 look, in light, with readable text
- And → the working, needs-input, error, waiting and ended states are still easy to tell apart

### Scenario: The look survives a restart

- REQ → REQ-22, REQ-23
- Given → the user chose the Windows 11 look in the desktop app
- When → the user quits and starts the desktop app again
- Then → the first frame already shows the Windows 11 look, with no flash of the current look

### Scenario: The first start shows the current look

- REQ → REQ-24, REQ-34
- Given → the user never chose a look
- When → the user opens the desktop app
- Then → the client looks exactly as on main today, with the macOS buttons at the left end

### Scenario: The Windows-style buttons drive the window

- REQ → REQ-28, REQ-29, REQ-30, REQ-31, REQ-40
- Given → the desktop app shows the current look
- When → the user switches to the Windows 11 look
- Then → minimize, maximize and close buttons show at the right end of the title bar, in place of the macOS buttons
- And → they minimize the window, maximize or restore it, and close it to the tray with every session still running

### Scenario: The title bar still moves the window

- REQ → REQ-32, REQ-33
- Given → the desktop window is at its smallest width, in either look
- When → the user drags an empty area of the top bar, then double clicks it
- Then → the window moves, then maximizes

### Scenario: The new controls work with the keyboard

- REQ → REQ-39
- Given → the desktop app shows the Windows 11 look
- When → the user moves with Tab through the look switch and the window buttons
- Then → each one shows a visible focus, and Enter acts on it

### Scenario: The browser shows no window buttons

- REQ → REQ-35
- Given → the client is open in a browser
- When → the user switches the look
- Then → the top bar shows no window buttons in either look

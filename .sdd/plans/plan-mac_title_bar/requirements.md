---
slug: mac_title_bar
date: 2026-11-06
spec: .sdd/analysis/mac_title_bar.md
status: validated
---

# Requirements — Mac-style title bar in the desktop app

Words used below:

- "Desktop window" → the window of the desktop app. "Browser client" → the client page opened in a browser.
- "Top bar" → the Vexel bar at the top of the client, with the brand and the controls.
- "Window buttons" → the three round buttons, red, yellow and green, at the left end of the top bar.
- "Empty area" → a part of the top bar with no control on it.
- "Close to the tray" → hide the window, as the native close button does today. The backend and every session keep running.

## Feature: Top bar as title bar

| ID | Requirement |
|----|-------------|
| REQ-1 | The desktop window shows no native title bar. |
| REQ-2 | The user can resize the desktop window from every edge and every corner. |
| REQ-3 | The desktop window keeps its name in the task switcher and in the dock. |
| REQ-4 | The desktop's window shortcuts keep working on the desktop window. |
| REQ-5 | The desktop's close shortcut closes the window to the tray. |
| REQ-6 | Dragging an empty area of the top bar moves the window. |
| REQ-7 | A double click on an empty area of the top bar maximizes the window, or restores it when it is maximized. |
| REQ-8 | A click or a double click on a control of the top bar acts on that control only, and does not move, maximize or restore the window. |
| REQ-9 | The top bar keeps an empty area to drag at every window width the app allows. |
| REQ-10 | The drag and the double click work while the client loads and on the backend error message. |
| REQ-11 | The drag and the double click work while a dialog is open. |
| REQ-12 | The top bar is dark in the dark theme and light in the light theme. |
| REQ-13 | The top bar changes theme at the same moment as the rest of the client. |
| REQ-14 | The browser client keeps its current top bar, with no drag. |

## Feature: Window buttons

| ID | Requirement |
|----|-------------|
| REQ-15 | The top bar shows three round buttons at its left end, in this order: red, yellow, green. |
| REQ-16 | The red button closes the window to the tray. |
| REQ-17 | The yellow button minimizes the window. |
| REQ-18 | The green button maximizes the window, and restores it when it is maximized. |
| REQ-19 | With the pointer over the group of window buttons, all three show their symbol: close, minimize, maximize or restore. |
| REQ-20 | With the pointer away from the group, the window buttons show only their colour. |
| REQ-21 | The symbol of the green button shows whether a click maximizes or restores the window. |
| REQ-22 | The window buttons keep their red, yellow and green colours in both themes. |
| REQ-23 | The window buttons work while the client loads and on the backend error message. |
| REQ-24 | The window buttons work while a dialog is open. |
| REQ-25 | The browser client shows no window buttons and keeps no space for them in the top bar. |
| REQ-26 | The symbols are readable on their coloured buttons in both themes. |
| REQ-27 | Each window button has an accessible name that says its action. |
| REQ-28 | The window buttons work with the keyboard, with a visible focus, like the other controls of the top bar. |

## Assumptions

The gatekeeper validated REQ-1 to REQ-28, "Window border" and "Order of the features" on 2026-11-06.

- **All three symbols together (REQ-19).** The pointer over any one button shows the symbols of all three, as on macOS. This comes from the spec's assumption.
- **Window focus (REQ-22).** The buttons keep their colours when the window loses focus. macOS greys them, but the spec does not ask for it.
- **No window title.** The top bar shows no window title. The Vexel brand takes its place.
- **Rest of the top bar.** Its content and order stay the same. It moves right only as much as the window buttons need.
- **Maximized window (REQ-6, REQ-7).** Dragging a maximized window and snapping it to a screen edge behave as the desktop does with a native title bar.
- **Order of the features.** "Top bar as title bar" comes first. Until "Window buttons" is done, the user closes, minimizes and maximizes the window with the desktop's shortcuts, the double click and the tray. Both features merge together.
- **Window border.** The plan adds no border around the window. Without the native frame, GNOME may draw no shadow, so this is a point to check by hand on GNOME.
- **Checked desktop.** The app is checked on GNOME. Other Linux desktops get the same bar without a specific check.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Linux only, like the rest of the desktop app.
- Every new text of the UI is in English.
- Out of scope: any change to the browser client beyond REQ-14 and REQ-25; full screen mode; the window menu of a right click on a native title bar; rounded window corners, a centred title and other parts of the macOS look; changes to the tray icon or to quitting; remembering the window size and position; operating systems other than Linux.
- Every requirement of `plan-desktop_app`, of `plan-light_theme` and of the other plans of this client stays true.

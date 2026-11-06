---
request_slug: mac_title_bar
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/desktop_app.md
---

# Analysis — Mac-style title bar in the desktop app

## Request

> Barra della finestra stile Mac nell'app desktop. Oggi la finestra ha la barra nativa di GNOME (titolo e pulsanti chiudi / riduci / massimizza) sopra la barra superiore di Vexel: due barre. La barra superiore di Vexel diventa la barra della finestra: niente più barra nativa; a sinistra i tre pallini stile macOS (rosso chiudi, giallo riduci a icona, verde massimizza / ripristina, col simbolo che appare al passaggio del mouse); la barra si trascina per spostare la finestra e il doppio clic massimizza o ripristina; il rosso chiude la finestra nel tray come fa oggi la X, le sessioni restano attive. La barra si adatta al tema: scura col tema scuro, chiara col tema chiaro. Il ridimensionamento dai bordi resta. Solo Linux, come il resto dell'app.

## Reference

[desktop_app.md](desktop_app.md) → the client runs in a desktop window. Closing the window leaves the backend and the sessions running, and a tray icon reopens the window or quits the app (lines 47-52). Today the window shows the native GNOME title bar above the Vexel top bar. [light_theme.md](light_theme.md) left the native title bar outside the themes (line 79).

Changes:
- The desktop window has no native title bar. The Vexel top bar becomes the title bar of the window.
- The top bar shows three macOS-style window buttons on its left end: close, minimize, maximize/restore.
- Dragging the top bar moves the window. A double click on it maximizes or restores the window.

## Summary

In the desktop app, the Vexel top bar replaces the native title bar. It carries macOS-style close, minimize and maximize buttons, moves the window, and follows the light or dark theme.

## Requirements

### Functional

Window frame
- The desktop window must not show the native title bar.
- The user must be able to resize the window from every edge and corner, as today.
- The window must keep its name in the task switcher and in the dock, as today.
- The desktop's window shortcuts must keep working as today. Its close shortcut must close the window to the tray, like the red button.

Window buttons
- The top bar must show three round buttons at its left end, in this order: red, yellow, green.
- The red button must close the window to the tray, like the native close button today. The backend and every session keep running.
- The yellow button must minimize the window.
- The green button must maximize the window, and restore it when it is maximized.
- With the pointer over the group of buttons, all three must show their symbol: close, minimize, maximize or restore.
- With the pointer away from the group, the buttons must show only their colour.
- The green button's symbol must show whether a click maximizes or restores the window.
- The buttons must keep their red, yellow and green colours in both themes.

Drag and double click
- Dragging an empty area of the top bar must move the window.
- A double click on an empty area of the top bar must maximize the window, or restore it when it is maximized.
- A click or double click on a control of the top bar must act on that control only, and must not move, maximize or restore the window.
- The top bar must keep an empty area to drag at every window width the app allows.

Every state of the window
- The window buttons and the drag must work while the client loads and on the backend error message.
- The window buttons and the drag must work while a dialog is open.

Theme
- The top bar must follow the active theme: dark in the dark theme, light in the light theme.
- The top bar must change theme at once with the rest of the client.

Browser
- The client opened in a browser must keep its current top bar, with no window buttons and no drag.

### Non-functional

- The symbols must be readable on their coloured buttons, in both themes.
- Each window button must have an accessible name that says its action.
- The window buttons must work with the keyboard, with a visible focus, like the other controls of the top bar.

## Assumptions

- This is an evolution, not a fix. A window without the native title bar was never specified, and [light_theme.md](light_theme.md) line 79 left the native bar out on purpose. The orchestrator decided this.
- The symbols show on all three buttons together when the pointer is over any of them, as on macOS. The request says only "on hover".
- The buttons keep their colours when the window loses focus. macOS greys them, but the request does not ask for it.
- The top bar shows no window title. The Vexel brand already in the top bar takes its place.
- The rest of the top bar keeps its content and order. It moves right only as much as the buttons need.
- Dragging a maximized window and snapping it to a screen edge behave as the desktop does with a native title bar.
- The app is checked on GNOME, the user's desktop. Other Linux desktops get the same bar without a specific check.

## Risks

- Without the native frame, GNOME may draw no shadow or border around the window. The window can then blend into the windows behind it.
- A control that becomes part of the drag area by mistake stops reacting to clicks.

## Scope

In scope:
- Removing the native title bar of the desktop window.
- The three window buttons in the top bar.
- Moving the window by drag, and maximize or restore by double click on the top bar.
- Resizing from the edges with the new frame.

Out of scope:
- Any change to the browser client.
- Full screen mode, which the green button opens on macOS.
- The window menu that a right click opens on a native title bar.
- Other parts of the macOS look, such as rounded window corners or a centred title.
- Changes to the tray icon or to quitting the app.
- Remembering the window size and position.
- Operating systems other than Linux.

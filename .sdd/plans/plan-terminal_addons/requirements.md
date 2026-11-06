---
slug: terminal_addons
date: 2026-11-06
spec: .sdd/analysis/terminal_addons.md
status: validated
---

# Requirements — Links, search, zoom and file drop in the hosted terminal

"The terminal" is the terminal of a hosted session. "In the terminal" means while the terminal has the keyboard focus. "Undo" is Claude Code's undo key, Ctrl+_ (Ctrl+Shift+- on US and Italian keyboards). "Ended session" is a hosted session whose header shows "Ended".

## Feature: Clickable links

| ID | Requirement |
|----|-------------|
| REQ-1 | Web addresses with the scheme `http` or `https` in the terminal output are links. |
| REQ-2 | Terminal hyperlinks (OSC 8) that Claude Code sends are links, also when their visible text is not the address. |
| REQ-3 | When the pointer is over a link, the link is underlined and the pointer changes. |
| REQ-4 | When the visible text of a link differs from its address, hovering the link shows the address. |
| REQ-5 | Ctrl+click on a link opens it. |
| REQ-6 | A plain click on a link does not open it and keeps today's behaviour: focus and text selection. |
| REQ-7 | An address that wraps over two or more rows opens as one full address. |
| REQ-8 | Punctuation that closes a sentence at the end of an address, such as `.`, `,` or `)`, is not part of the address. |
| REQ-9 | In the desktop app, a link opens in the system default browser. |
| REQ-10 | In the browser client, a link opens in a new tab. |
| REQ-11 | Opening a link never navigates the client window away from the client. |
| REQ-12 | A link whose scheme is not `http` or `https` does not open. |
| REQ-13 | Links are readable on the dark terminal panel, in the light and in the dark theme. |

## Feature: Search

| ID | Requirement |
|----|-------------|
| REQ-14 | Ctrl+Shift+F in the terminal opens a search box over the terminal. |
| REQ-15 | A visible search control opens the same search box. |
| REQ-16 | Ctrl+Shift+F does not open the search box while the focus is outside the terminal. |
| REQ-17 | Ctrl+Shift+F in the terminal sends nothing to Claude Code. |
| REQ-18 | Ctrl+Shift+L in the terminal still moves the focus to the list. |
| REQ-19 | The search covers all the text the terminal keeps, scrollback included. |
| REQ-20 | The search is plain text and ignores case. |
| REQ-21 | The results update while the user types. |
| REQ-22 | Every match is highlighted, and the current match looks different from the others. |
| REQ-23 | The terminal scrolls to show the current match. |
| REQ-24 | Enter and a "next" control go to the next match, and wrap from the last match to the first. |
| REQ-25 | Shift+Enter and a "previous" control go to the previous match, and wrap from the first match to the last. |
| REQ-26 | The search box shows the position of the current match and the total, such as "3 of 12", or "No results". |
| REQ-27 | Esc in the search box closes it, removes the highlights and gives the focus back to the terminal. |
| REQ-28 | Typing in the search box sends nothing to Claude Code. |
| REQ-29 | The search box closes when the user opens another session. |
| REQ-30 | The search box and its controls work with the keyboard, with a visible focus and an accessible name. |
| REQ-31 | Match highlights are readable on the dark terminal panel, in the light and in the dark theme. |

## Feature: Font zoom

| ID | Requirement |
|----|-------------|
| REQ-32 | Ctrl+= and Ctrl++ in the terminal make the terminal text 1 px larger. |
| REQ-33 | Ctrl+- in the terminal makes the terminal text 1 px smaller. |
| REQ-34 | Ctrl+0 in the terminal restores the default size of 12 px. |
| REQ-35 | Visible controls make the terminal text larger, smaller, or restore the default size. |
| REQ-36 | The zoom keys change nothing while the focus is outside the terminal. |
| REQ-37 | The zoom keys in the terminal send nothing to Claude Code. |
| REQ-38 | Undo in the terminal still reaches Claude Code. |
| REQ-39 | Zoom changes only the terminal text: the rest of the client keeps its size, in the browser and in the desktop app. |
| REQ-40 | The terminal text size stays between 8 px and 32 px. |
| REQ-41 | At 32 px the "larger" control is disabled, and at 8 px the "smaller" control is disabled. |
| REQ-42 | After a size change, the terminal fills its panel again and Claude Code receives the new number of rows and columns. |
| REQ-43 | One size applies to the terminals of all hosted sessions. |
| REQ-44 | The client remembers the size across reloads and restarts, where the user chose it. |
| REQ-45 | The zoom controls work with the keyboard, with a visible focus and an accessible name. |

## Feature: File drop

| ID | Requirement |
|----|-------------|
| REQ-46 | In the desktop app, dropping one or more files or folders from the file manager onto the terminal inserts their absolute paths at the input of the session. |
| REQ-47 | The drop does not press Enter. |
| REQ-48 | Several paths are separated by one space, in the order of the drop, with one space after the last path. |
| REQ-49 | A path with spaces or shell-special characters is wrapped in single quotes, so that it reads as one path. Other paths are not quoted. |
| REQ-50 | The paths reach Claude Code as a paste, as on a drop in a native terminal. |
| REQ-51 | In the desktop app, while a file is dragged over the terminal, the panel shows that it accepts the drop. |
| REQ-52 | A drop on the terminal of an ended session inserts nothing. |
| REQ-53 | In the desktop app, a file dropped anywhere in the window does not open the file and does not replace the page. |
| REQ-54 | In the browser client, a drop on the terminal inserts nothing and shows a short message: paths can be dropped only in the desktop app. |

## Assumptions

- **Shortcut check.** The terminal uses xterm.js 6. Today it sends nothing to Claude Code for Ctrl+-, Ctrl+=, Ctrl++, Ctrl+0 and Ctrl+Shift+F. So the spec's shortcuts take no key that Claude Code receives today. Undo is Ctrl+_: xterm.js sends it for Ctrl+Shift+-, and the zoom keys leave it alone (REQ-38). The spec's shortcuts stay as they are.
- **Keyboard layouts.** The zoom keys follow the character the key produces. On an Italian keyboard, Ctrl++ is the `+` key and Ctrl+= is Ctrl+Shift+0.
- **Page zoom.** The browser and the desktop window zoom the whole page on Ctrl+=, Ctrl+- and Ctrl+0. The desktop window does this through its hidden default menu. In the terminal the client takes these keys, so the page does not zoom (REQ-39). Outside the terminal the browser keeps its own page zoom (REQ-36).
- **Ended sessions.** Links, search and zoom also work on the terminal of an ended session. Only the drop does nothing there (REQ-52).
- **Zoom steps.** Steps of 1 px. The size is per browser and per desktop app, like the theme (spec assumption).
- **Quoting.** It follows the native terminal of the Linux desktop. A single quote inside a quoted path is written as `'\''`.
- **Browser drag.** In the browser client the panel shows no "accepts the drop" state: a drop there inserts nothing (REQ-54).
- **Position of the controls.** The search control and the three zoom controls sit in the subbar of the hosted session, next to "Interrupt". The search box sits at the top right of the terminal panel.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text is in English, like the rest of the client.
- These features read the terminal content and never change it. The keys that the features do not use still go to Claude Code, unchanged.
- External sessions show text, not a terminal. These features do not apply to them.
- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/terminal_addons.md`, "Scope").
- Every requirement of the earlier plans of this client stays true. This plan changes one thing: `SessionView` sent every key except Ctrl+Shift+L to Claude Code. Now Ctrl+Shift+F and the zoom keys are exceptions too.

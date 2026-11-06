---
request_slug: terminal_addons
date: 2026-11-06
type: evolution
size: ordinary
reference: .sdd/analysis/claude_sessions_client.md
---

# Analysis — Links, search, zoom and file drop in the hosted terminal

## Request

> Addon di xterm per il terminale delle sessioni ospitate: oggi è caricato solo l'adattamento alla dimensione (fit). Mancano: link cliccabili nell'output del terminale; ricerca nel testo del terminale; zoom del carattere del terminale (più grande / più piccolo); trascinare un file sul terminale per inserirne il percorso.

## Reference

[claude_sessions_client.md](claude_sessions_client.md) → a hosted session shows Claude Code's own terminal, with full interaction (line 150). Its Risks note that missing terminal features push the user back to the shells (line 142). The terminal text is 12 px ([claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md), line 87). Today the terminal only resizes to fit its panel.

Changes:
- The terminal of hosted sessions gets four features: clickable links, text search, font zoom, and file drop that inserts the file path.
- Every other requirement of the reference stays true.

## Summary

Give the terminal of hosted sessions four features that native terminals have: clickable links, search in the text, a larger or smaller font, and file drop that inserts the path. The user then has no reason to go back to a native terminal for these tasks.

## Requirements

### Functional

Common
- The four features apply to the terminal of hosted sessions, in the desktop app and in the browser client. File drop has a limit in the browser (see Constraints).
- The keyboard shortcuts of these features must act only while the terminal has the focus.
- A key that the client uses for these features must not reach Claude Code.
- The new shortcuts must not take the key that moves the focus from the terminal to the list.

Clickable links
- Web addresses (`http`, `https`) in the terminal output must be clickable.
- Hyperlinks that Claude Code sends as terminal hyperlinks (OSC 8) must be clickable too, also when their visible text is not the address.
- When the pointer is over a link, the link must be underlined and the pointer must change.
- When the visible text of a link differs from its address, hovering it must show the address.
- Ctrl+click on a link must open it.
- A plain click on a link must keep today's behaviour and must not open it.
- An address that wraps over two or more rows must open as one full address.
- Punctuation that closes a sentence, such as a final `.`, `,` or `)`, must not become part of the address.
- In the desktop app, a link must open in the system default browser. In the browser client, it must open in a new tab.
- Opening a link must never navigate the client window away from the client.
- A link with any scheme other than `http` or `https` must not open.

Search
- Ctrl+Shift+F, or a visible search control, must open a search box over the terminal.
- The search must cover all the text the terminal keeps, scrollback included.
- Results must update while the user types.
- Every match must be highlighted, and the current match must look different from the others.
- The terminal must scroll to show the current match.
- Enter and a "next" control must go to the next match. Shift+Enter and a "previous" control must go to the previous one. Both wrap at the ends.
- The box must show the position of the current match and the total, for example "3 of 12", or "No results".
- Esc must close the box, remove the highlights and give the focus back to the terminal.
- Typing in the search box must send nothing to Claude Code.

Font zoom
- Ctrl+= (and Ctrl++) must make the terminal text larger. Ctrl+- must make it smaller. Ctrl+0 must restore the default size.
- Visible controls must offer the same three actions.
- Zoom must change only the terminal text. The rest of the client must keep its size.
- The size must stay between a minimum and a maximum. At a limit, the control that goes further must be disabled.
- After a size change, the terminal must fill its panel again, and Claude Code must receive the new number of rows and columns, as on a window resize.
- One size must apply to the terminals of all hosted sessions.
- The client must remember the size across reloads and restarts.

File drop
- Dropping one or more files or folders from the file manager onto the terminal must insert their absolute paths at the input of the session.
- The drop must not press Enter. The user sends the message.
- Several paths must be separated by one space, in the order of the drop, with one space after the last.
- A path with spaces or shell-special characters must be quoted, so that it reads as one path.
- The paths must reach Claude Code as a paste, as a native terminal does on drop. Claude Code then handles them the same way, for example it attaches an image.
- While a file is dragged over the terminal, the panel must show that it accepts the drop.
- A drop on the terminal of an ended session must insert nothing.
- In the desktop app, a file dropped anywhere in the window must not open the file or replace the page.
- In the browser client, a drop on the terminal must insert nothing and show a short message: paths can be dropped only in the desktop app.

### Non-functional

- Every new text must be in English, like the rest of the client.
- The search box and the zoom controls must work with the keyboard, with a visible focus and an accessible name.
- Match highlights and links must be readable on the dark terminal panel, in the light and in the dark theme.

## Assumptions

- This is an evolution, not a fix. The hosted terminal never had these features, so no specified behaviour is broken. The orchestrator decided this.
- Links open with Ctrl+click, as in GNOME Terminal and VS Code. A plain click stays free for focus and text selection.
- Search uses Ctrl+Shift+F, the convention of Linux terminals. Ctrl+F is a terminal key, and the browser's own find cannot read the terminal.
- Search is plain text and ignores case. It has no options.
- The search box closes when the user opens another session.
- Zoom goes from 8 px to 32 px, in steps of 1 px. The default stays 12 px.
- The client remembers the size where the user chose it, like the theme. The desktop app and a browser can each keep a different size.
- Quoting follows the native terminal of the Linux desktop: single quotes, only when the path needs them.
- External sessions show their conversation as text, not a terminal. So these features do not apply to them.

## Constraints

- A browser never gives a page the absolute path of a dropped file. It gives the name and the content only ([Mozilla bug 512717](https://bugzilla.mozilla.org/show_bug.cgi?id=512717), [JS9 docs](https://js9.si.edu/js9/params/filepath.html)). So file drop works only in the desktop app.
- The terminal content belongs to Claude Code ([claude_sessions_client-ui_redesign.md](claude_sessions_client-ui_redesign.md), line 76). These features read it, and they never change it.

## Risks

- Search finds only the text that the terminal still keeps. Claude Code redraws its screen, so parts of a long conversation can be missing or repeated. The user can then think a text is absent.
- The browser or the desktop app can take Ctrl+-, Ctrl+= and Ctrl+0 for itself and zoom the whole page instead of the terminal.
- Claude Code may insert a dropped image path as text and not attach the image. Reports show this depends on how the terminal delivers the drop ([Warp issue](https://upd.dev/warpdotdev/warp/issues/9545), [iTerm2 issue](https://claudeissues.com/issue/62208-iterm2-image-drag-and-drop-pastes-file-path-instead-of-attaching-after-clearing)).
- A wrong end of an address opens a wrong page.
- A very large font leaves few columns, and Claude Code's screen can become hard to use. The maximum size limits this.

## Scope

In scope:
- Clickable web links in the terminal of hosted sessions.
- Text search in that terminal.
- Font zoom of that terminal, remembered.
- File drop that inserts paths, in the desktop app.

Out of scope:
- Zoom with Ctrl+mouse wheel.
- Search options: case, whole word, regular expressions.
- Opening file paths of the output in an editor or a file manager.
- Links or search in the conversation of external sessions.
- Dropping text, or files dragged from a web page.
- Sending the content of a dropped file from the browser client.
- Zoom of the whole client, or a different size per session.
- Search across sessions, or in history that the terminal no longer keeps.
- Any other terminal feature, such as image display.

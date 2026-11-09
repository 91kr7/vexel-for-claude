---
request_slug: keyboard_shortcuts
date: 2026-11-09
type: evolution
size: ordinary
reference: .sdd/analysis/session_list_width.md
---

# Analysis — Keyboard shortcuts and a shortcuts panel

## Request

> implementa un sistema di shortcut da nerd per interagire con l'interfaccia senza usare il mouse! affianco all'icona per cambiare il tema chiaro scuro metti un tasto che mostra le shortcut disponibili

## Reference

[session_list_width.md](session_list_width.md) → it left "A system of keyboard shortcuts" out of scope (line 150). There the human announced this request (line 117). It kept the key that moves the focus from the terminal to the list, without a visible hint (line 78).

Shortcuts that exist today:
- The terminal search (Ctrl+Shift+F) and the terminal zoom (Ctrl+= / Ctrl+- / Ctrl+0), active only while the terminal has the focus ([terminal_addons.md](terminal_addons.md), lines 33-35, 51, 62).
- Enter and Esc in dialogs ([claude_sessions_client-ui_redesign.md](claude_sessions_client-ui_redesign.md), line 111).

Changes:
- The client gets keyboard shortcuts for navigation and for the main session actions.
- Every shortcut is a combination with Ctrl and/or Alt.
- A button next to the Light/Dark switch opens a panel that lists every shortcut.

## Summary

The user can drive the client without the mouse. Ctrl/Alt combinations move between sessions, jump to the session that needs input, and run the main session actions. A button next to the Light/Dark switch, or a shortcut, opens a panel with every available shortcut.

## Requirements

### Functional

Navigation
- A shortcut must move the focus to the session list. The existing key that leaves the terminal must keep working.
- A shortcut must move the focus to the terminal or the conversation of the open session.
- Two shortcuts must open the previous and the next session, in the order of the list.
- Shortcuts must open the session at positions 1 to 9 of the list.
- A shortcut must open the next session that needs input, in list order. Pressed again, it must go to the following one, and wrap at the end.
- When no session needs input, that shortcut must open nothing and show a short message.
- A session opened by shortcut must behave as if the user clicked its entry.

Session actions
- A shortcut must open the new-session dialog.
- A shortcut must open the resume history dialog.
- A shortcut must stop the open hosted session. The confirmation for a working session must stay.
- A shortcut must start renaming the open session.
- On an open ended hosted session, shortcuts must run "Dismiss" and "Resume", with the rules of [session_list_improvements.md](session_list_improvements.md), lines 37-48.
- On an open external session, a shortcut must run "Resume here". The running-elsewhere warning must stay.
- A shortcut must switch between the light and the dark theme.

Rules for every shortcut
- Every shortcut must be a combination with Ctrl, Alt, or both. No shortcut may be a single character key. This is the human's decision of 2026-11-09.
- No shortcut may use a key that Claude Code uses in its terminal (see Constraints).
- No shortcut may use a system or desktop key of Ubuntu (see Constraints).
- No shortcut may use a key that the browser keeps for itself (see Constraints).
- Every shortcut must work the same in the desktop app and in the browser client.
- The shortcuts must work also while the terminal of a hosted session has the focus. A key the client uses must not reach Claude Code.
- Inside a text field, the field's own editing keys must keep working.
- While a dialog is open, the client shortcuts must do nothing. The dialog keeps its own keys.
- A shortcut whose action does not apply to the current state must do nothing. One example is "stop" with no open session.
- The existing shortcuts must keep their keys and behaviour.

Shortcuts panel
- The top bar must show a shortcuts button right beside the Light/Dark switch, in the same style.
- The button must have an accessible name and a tooltip that shows its shortcut.
- The button and a shortcut must open the panel.
- The panel must list every client shortcut, the existing ones included, grouped by area: navigation, sessions, terminal, general.
- Each row must show the keys in the mock's keyboard badge and the action in English.
- Every shortcut that works must appear in the panel. The panel must list no shortcut that does not work.
- Esc, the button, and the panel shortcut must close the panel. The focus must then go back where it was.
- Opening the panel must not interrupt sessions, or lose the open session or the scroll position.
- The panel must follow the active theme.
- Every new text must be in English, like the rest of the client.

### Non-functional

- Every shortcut must work on the Italian and on the US keyboard layouts. A key that needs AltGr on one of them is not allowed.
- A shortcut must act with no visible delay. Opening a session by shortcut must keep the one-second target of [claude_sessions_client.md](claude_sessions_client.md), line 112.
- The panel must work with the keyboard, with a visible focus.

## Assumptions

- This is an evolution of [session_list_width.md](session_list_width.md), not a fix. That analysis left shortcuts out of scope, and no specified behaviour is broken. The gatekeeper decided this.
- The later phases choose the exact keys, inside the rules above.
- Standard control keys are not shortcuts and stay as today: Tab, Enter and Space on a focused control, Esc in a dialog.
- Interrupting a turn needs no new shortcut. Esc and Ctrl+C already interrupt Claude Code in the terminal.
- The panel is a dialog in the style of the other dialogs of the client.
- The panel shows the same list in the desktop app and in the browser, because the keys are the same.

## Constraints

- Claude Code uses Ctrl with most letters, Alt+B/D/F/O/P/T/Y, Ctrl+X chords, Ctrl+Enter, Ctrl+Shift+-, Esc, Tab and Shift+Tab ([Claude Code interactive mode](https://code.claude.com/docs/en/interactive-mode)). The human requires no conflict with them.
- Ubuntu's GNOME desktop takes the Super key, Alt+Tab, Alt+F1, Alt+F2, Alt+F4, Ctrl+Alt+arrows, Ctrl+Alt+T, Ctrl+Alt+Del and similar ([GNOME help](https://help.gnome.org/users/gnome-help/stable/shell-keyboard-shortcuts.html.it), [Ubuntu wiki](https://help.ubuntu.com/community/KeyboardShortcuts)). The human requires no conflict with them. The final check is the user's own settings.
- A page cannot take some browser keys, such as Ctrl+T, Ctrl+W and Ctrl+N ([Chromium design doc](https://www.chromium.org/developers/design-documents/extensions/proposed-changes/apis-under-development/browser-keys/)).
- The desktop window shortcuts must keep working ([mac_title_bar.md](mac_title_bar.md), line 36).

## Risks

- After the rules above, few free combinations remain. Some shortcuts can end up hard to remember.
- A new Claude Code version can start to use a key that the client took. That key then stops reaching Claude Code.
- A user who changed the Ubuntu shortcuts can have a conflict that the defaults do not show.
- "Dismiss" has no confirmation. A wrong key can remove a session from the list, but it stays in the history.
- The panel can drift away from the real shortcuts when a later change adds or moves a key.

## Scope

In scope:
- Ctrl/Alt shortcuts for navigation, focus, the session actions and the theme.
- The shortcuts button next to the Light/Dark switch, and the shortcuts panel.

Out of scope:
- Single-key shortcuts, such as vim-style j/k or a bare "?".
- Key sequences, such as "g" then "s".
- A command palette.
- Changing or turning off the keys.
- Reordering the list with the keyboard. Reordering is drag and drop only, by the human's decision ([fixed_order](claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order.md), line 22).
- Shortcut hints in the tooltips of the other controls.
- System-wide shortcuts that act when the client window has no focus.
- Any change to Claude Code's own keys.

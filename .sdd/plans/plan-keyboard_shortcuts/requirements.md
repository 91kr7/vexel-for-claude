---
slug: keyboard_shortcuts
date: 2026-11-09
spec: .sdd/analysis/keyboard_shortcuts.md
status: validated
---

# Requirements — Keyboard shortcuts and a shortcuts panel

Words used below:

- "Shortcut" → a client shortcut: a key combination that this plan adds, or one that exists today (terminal search, terminal zoom, Ctrl+Shift+L).
- "List" → the session list. "List order" → the order in which the list shows its entries, from top to bottom.
- "Open session" → the session shown in the main area.
- "Main view" → the terminal of the open hosted session, or the conversation of the open external session.
- "Needs input" → the state of a session that waits for the user.
- "The switch" → the Light/Dark switch of the top bar.
- "Shortcuts button" and "shortcuts panel" → the new top bar button and the panel it opens.
- "The mock" → `.sdd/mockups/studio-dark/mock.html`.

## Feature: Navigation shortcuts

| ID | Requirement |
|----|-------------|
| REQ-1 | A shortcut moves the keyboard focus to the list. |
| REQ-2 | Ctrl+Shift+L in the terminal still moves the focus to the list. |
| REQ-3 | A shortcut moves the focus to the main view. |
| REQ-4 | A shortcut opens the session before the open session, in list order. |
| REQ-5 | A shortcut opens the session after the open session, in list order. |
| REQ-6 | Nine shortcuts open the session at positions 1 to 9 of the list. |
| REQ-7 | A shortcut opens the next session that needs input, in list order after the open session. |
| REQ-8 | Pressed again, that shortcut opens the following session that needs input, and wraps from the end of the list to its start. |
| REQ-9 | When no session needs input, that shortcut opens nothing and shows a short message. |
| REQ-10 | A session opened by a shortcut behaves as if the user clicked its entry. |
| REQ-11 | Opening a session by shortcut keeps the one-second target of `claude_sessions_client.md`, line 112. |

## Feature: Session action shortcuts

| ID | Requirement |
|----|-------------|
| REQ-12 | A shortcut opens the new-session dialog. |
| REQ-13 | A shortcut opens the resume history dialog. |
| REQ-14 | A shortcut stops the open hosted session, like "Terminate". |
| REQ-15 | On a working session, that shortcut still asks for the confirmation that "Terminate" asks today. |
| REQ-16 | A shortcut starts renaming the open session. |
| REQ-17 | On an open ended hosted session, a shortcut runs "Dismiss", with the rules of `session_list_improvements.md`, lines 37-48. |
| REQ-18 | On an open ended hosted session, a shortcut runs "Resume", with the rules of `session_list_improvements.md`, lines 37-48. |
| REQ-19 | On an open external session, a shortcut runs "Resume Here". |
| REQ-20 | That shortcut still shows the running-elsewhere warning when the session runs in another terminal. |
| REQ-21 | A shortcut switches between the light and the dark theme, like the switch. |

## Feature: Shortcuts panel

| ID | Requirement |
|----|-------------|
| REQ-22 | The top bar shows the shortcuts button right beside the switch, in the same style as the switch. |
| REQ-23 | The shortcuts button has an accessible name and a tooltip that shows its shortcut. |
| REQ-24 | The shortcuts button opens the shortcuts panel. |
| REQ-25 | A shortcut opens the shortcuts panel. |
| REQ-26 | The panel lists every shortcut, grouped by area: navigation, sessions, terminal, general. |
| REQ-27 | Each row shows the keys in the keyboard badge of the mock, and the action in English. |
| REQ-28 | The panel lists no shortcut that does not work. |
| REQ-29 | Esc, the shortcuts button and the panel shortcut close the panel. |
| REQ-30 | When the panel closes, the focus goes back where it was before the panel opened. |
| REQ-31 | Opening the panel does not interrupt any session, and keeps the open session and its scroll position. |
| REQ-32 | The panel follows the active theme. |
| REQ-33 | The panel works with the keyboard, with a visible focus. |

## Rules for every shortcut

These REQs apply to every shortcut of the three features above. They close in the last batch that adds a shortcut (see `batches.md`).

| ID | Requirement |
|----|-------------|
| REQ-34 | Every new shortcut is a combination with Ctrl, Alt or both, and none is a single character key. |
| REQ-35 | No new shortcut uses a key that Claude Code uses in its terminal. |
| REQ-36 | No new shortcut uses a default system or desktop key of Ubuntu GNOME. |
| REQ-37 | No new shortcut uses a key that the browser keeps for itself. |
| REQ-38 | Every shortcut works the same in the desktop app and in the browser client. |
| REQ-39 | Every new shortcut works also while the terminal of a hosted session has the focus. |
| REQ-40 | A key that the client uses as a shortcut does not reach Claude Code. |
| REQ-41 | Inside a text field, the editing keys of the field keep working. |
| REQ-42 | While a dialog is open, the shortcuts do nothing and the dialog keeps its own keys. The only exception is the panel shortcut, which closes the shortcuts panel. |
| REQ-43 | A shortcut whose action does not apply to the current state does nothing. |
| REQ-44 | The existing shortcuts keep their keys and their behaviour. |
| REQ-45 | Every shortcut works on the Italian and on the US keyboard layout, and none needs AltGr. |
| REQ-46 | A shortcut acts with no visible delay. |

## Assumptions

- **Key map (REQ-34 to REQ-37, REQ-45).** Gatekeeper decision, not a human decision (2026-11-09). The plan fixes the keys, because the spec leaves them to the later phases. All new keys use the left Alt key. The two actions that remove something also need Shift, so one wrong key cannot stop or dismiss a session. Letters B, D, F, O, P, T, Y (Claude Code, spec "Constraints"), M and V (Claude Code permission mode and image paste) are not used.

  | Area | Action | Keys |
  |------|--------|------|
  | Navigation | Focus the list | Alt+L |
  | Navigation | Focus the main view | Alt+C |
  | Navigation | Previous / next session | Alt+Up / Alt+Down |
  | Navigation | Session at position 1 to 9 | Alt+1 … Alt+9 |
  | Navigation | Next session that needs input | Alt+I |
  | Sessions | New session dialog | Alt+N |
  | Sessions | Resume history dialog | Alt+H |
  | Sessions | Rename the open session | Alt+E |
  | Sessions | "Resume" or "Resume Here" on the open session | Alt+R |
  | Sessions | Stop the open hosted session | Alt+Shift+Q |
  | Sessions | Dismiss the open ended session | Alt+Shift+W |
  | Terminal | Search (existing) | Ctrl+Shift+F |
  | Terminal | Larger / smaller / default text (existing) | Ctrl+= or Ctrl++ / Ctrl+- / Ctrl+0 |
  | Terminal | Focus the list (existing) | Ctrl+Shift+L |
  | General | Light/Dark theme | Alt+A |
  | General | Shortcuts panel | Alt+S |

- **Keys matched by position (REQ-45).** The client matches the physical key, not the typed character. So Alt+letter and Alt+digit act the same on the Italian and on the US layout.
- **Browser default actions (REQ-37, REQ-38).** The client cancels the default action of every key it takes. So the browser accelerators that a page can override do not fire, for example the Alt+E menu and Alt+1 … Alt+8 tab switch of Chromium on Linux.
- **Previous and next (REQ-4, REQ-5).** Gatekeeper decision, not a human decision (2026-11-09). They stop at the ends of the list and do not wrap: the spec asks for wrapping only for the needs-input shortcut. With no open session, "next" opens the first entry and "previous" opens the last one.
- **Needs input (REQ-7, REQ-8).** With no open session, the search starts at the top of the list. The open session itself is reached last, after the wrap.
- **Short message (REQ-9).** The text is "No session needs input". The client shows it the way it shows its other short messages, and it goes away by itself.
- **Positions (REQ-6).** Position 1 is the first entry of the list as shown, across the state groups. A position with no entry does nothing (REQ-43).
- **Resume key (REQ-18, REQ-19).** One key, Alt+R, runs "Resume" on an ended hosted session and "Resume Here" on an external session. The two cases never apply to the same session.
- **Stop and rename (REQ-14, REQ-16).** Stop applies only to an open hosted session that is not ended. Rename applies to every open session, hosted or external.
- **Text fields (REQ-41).** Gatekeeper decision, not a human decision (2026-11-09). The new shortcuts act also inside a text field, because no Alt combination of the key map is an editing key there.
- **Panel content (REQ-26).** Standard control keys are not shortcuts and are not listed: Tab, Enter and Space on a control, Enter and Esc in a dialog, and the keys inside the terminal search box (spec, "Assumptions"). Ctrl+click on a link is not listed, because it needs the mouse.
- **Panel shape (REQ-24, REQ-29).** The panel looks like the other dialogs of the client. The shortcuts button stays clickable while the panel is open, so a second click closes it.
- **Button text (REQ-23).** Accessible name "Keyboard Shortcuts". Tooltip "Keyboard Shortcuts (Alt+S)".

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text is in English, like the rest of the client.
- The desktop window shortcuts keep working (`mac_title_bar.md`, line 36).
- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/keyboard_shortcuts.md`, "Scope").
- Every requirement of the earlier plans of this client stays true. This plan changes none of them: Ctrl+Shift+L, the terminal search and the terminal zoom keep their keys.

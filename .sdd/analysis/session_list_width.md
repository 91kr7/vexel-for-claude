---
request_slug: session_list_width
date: 2026-11-06
type: evolution
size: narrow
reference: .sdd/analysis/claude_sessions_client-ui_redesign-material3_mock-studio_dark.md
---

# Analysis — Resizable session list, with remembered width

## Request

> fai in modo che la barra delle sessioni sia ridimensionabile. è possibile fare in modo che la larghezza sia salvata così se chiudo l'app me la propone larga uguale?

## Reference

[claude_sessions_client-ui_redesign-material3_mock-studio_dark.md](claude_sessions_client-ui_redesign-material3_mock-studio_dark.md) → the Studio restyle. It sets the list panel to a fixed 224 px width (lines 23 and 105).

Changes:
- The user can change the width of the list panel. 224 px becomes the default width.
- The client remembers the chosen width across reloads and restarts.
- Every other requirement of the reference stays true.

## Summary

The user can drag the right edge of the session list panel to make it wider or narrower. The app remembers the width and shows the panel at that width on the next start.

## Requirements

### Functional

- The user must be able to change the width of the list panel by dragging its right edge.
- The edge must show that the user can drag it, on hover and on keyboard focus.
- The panel width must stay between 180 px and 480 px.
- The main area must keep at least 700 px of width.
- When the window is too narrow for the saved width, the panel must show narrower. The saved width must not change.
- The saved width must change only when the user resizes the panel.
- With no saved width, the panel must be 224 px wide.
- The client must remember the width across page reloads and app restarts.
- On start, the panel must show the saved width from the first frame, with no jump.
- At every width, entry texts must keep their current lines and be cut with an ellipsis when they do not fit.
- After a resize, the terminal of the open hosted session must fill its panel again. Claude Code must receive the new number of columns, as after a window resize ([terminal_addons.md](terminal_addons.md), line 66).
- The user must be able to reach the edge with the keyboard and change the width with the arrow keys, with visible focus.
- Any new text, such as the accessible name of the edge, must be in English, like the rest of the UI.

### Non-functional

- While the user drags, the panel must follow the pointer with no visible lag.

## Assumptions

- This is an evolution, not a fix. The 224 px width was a deliberate choice from the mock. The orchestrator decided this.
- "Barra delle sessioni" means the session list panel. The 52 px rail does not change.
- The 180-480 px limits keep entries readable and the main area usable. The orchestrator decided this.
- The 700 px floor holds at the 1280 px minimum window width: 1280 − 52 − 480 leaves about 750 px.
- The client remembers the width where the user chose it, like the theme ([light_theme.md](light_theme.md), line 62) and the terminal font size ([terminal_addons.md](terminal_addons.md), line 95). The desktop app and a browser can each keep their own width.

## Risks

- Claude Code redraws its screen on each column change. Many changes during one drag can make the terminal flicker or show a broken frame for a moment.

## Scope

In scope:
- Resizing the session list panel with the mouse and the keyboard.
- Remembering the width across reloads and restarts.

Out of scope:
- Collapsing or hiding the panel.
- A reset action, such as a double-click to bring back the default width.
- Resizing any other area, including the rail.
- Remembering the window size and position.

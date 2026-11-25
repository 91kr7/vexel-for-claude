---
request_slug: terminal_overflow
date: 2026-11-23
type: fix
size: narrow
reference: .sdd/analysis/terminal_addons.md
---

# Analysis — Terminal text cut at the right edge

## Request

> Fix dell'overflow orizzontale nel terminale (shell) dell'app: ogni tanto, non sempre, il testo esce dal bordo destro e alcuni caratteri vengono tagliati/saltano (screenshot: /home/christian.mariani/Pictures/Screenshots/Screenshot from 2026-11-23 16-10-08.png, la riga "...i staging e le" è troncata al bordo destro del pannello).

## Reference

[terminal_addons.md](terminal_addons.md) → after a size change, the terminal must fill its panel again, and Claude Code must receive the new number of rows and columns (line 66). [session_list_width.md](session_list_width.md) asks the same after a drag of the list edge (line 59). [ui_transitions.md](ui_transitions.md) asks for the correct layout when the session cross-fade ends (line 46). The terminal panel has a 16px margin on all four sides ([ui_restyle.md](ui_restyle.md), line 82).

Changes:
- The terminal must never be wider than its panel, in any situation, not only after a size change.
- Every other requirement of the reference stays true.

## Summary

Sometimes the terminal of a hosted session has more columns than its panel can show. The end of long lines then goes past the right edge, and the user cannot read it. The terminal must always show every column inside its panel.

## Requirements

- The terminal of a hosted session must show every column inside its panel, in the desktop app and in the browser client.
- No character may go past the right edge of the panel or be hidden by it.
- The last column must stay fully visible, also when the scrollbar shows.
- Claude Code must receive the number of columns that the panel really shows, so that its lines end inside the panel.
- The width must be right in every situation that changes the space of the terminal or the size of its characters:
  - the first display of a session, at app start and after a reload;
  - a switch to another session, when the cross-fade ends;
  - a resize, maximize or restore of the window;
  - a drag of the list panel edge;
  - a change of the terminal text size.
- For any other cause that changes the space of the panel, the terminal must adapt with no action of the user.
- The number of columns must not change while the size of the panel and of the characters stays the same.

## Assumptions

- This is a fix in its own file, with `terminal_addons.md` as reference. The request reports a defect against a behaviour that line 66 of that analysis already requires. The separate file follows the precedent of `session_list_width.md` and the knowledge base entry `short-request-slugs`. The gatekeeper decided this.
- "Terminale (shell)" means the terminal of hosted sessions, where Claude Code runs. External sessions show their conversation as text, not in a terminal.
- The trigger of the defect is unknown. The request says only "ogni tanto, non sempre". So the requirements cover every situation that changes the space of the terminal. The gatekeeper decided this.
- The human works with the desktop app on Ubuntu. The browser client keeps the same requirements. The gatekeeper decided this.
- Text printed while the width was wrong can keep its old line breaks. The requirements cover what the terminal shows once its width is right.

## Risks

- The defect is intermittent. A test that does not recreate its trigger also passes on the broken app.

## Scope

In scope:
- The width of the terminal of hosted sessions.

Out of scope:
- Rows cut at the bottom edge of the panel.
- The conversation view of external sessions.
- Any change to the panel margins, the text size or its limits.
- New terminal features.

---
slug: terminal_clip
date: 2026-11-26
spec: .sdd/analysis/terminal_clip.md
status: validated
---

# Requirements — Terminal last column still cut at the right edge

Words used below:

- "The terminal" → the terminal of a hosted session, where Claude Code runs.
- "The panel" → the space that the terminal panel gives to the text, as in `plan-terminal_overflow`. The 16 px margin of the panel stays free (`plan-ui_restyle/REQ-34`).
- "Hidden" → a character hidden only in part counts as hidden (spec, "Changes").
- "Right width" → REQ-1 and REQ-2 hold.
- "Text size" and "list panel edge" → as in `plan-terminal_overflow`.

Every REQ holds in the desktop app and in the browser client. REQ-12 is about the desktop app only.

REQ-3 to REQ-10 are the situations of `plan-terminal_overflow` (its REQ-2 and REQ-4 to REQ-10), checked again with the right width of this plan.

## Feature: Terminal width

| ID | Requirement |
|----|-------------|
| REQ-1 | Every column of the terminal shows whole inside the panel: no character goes past the right edge of the panel or is hidden by it. |
| REQ-2 | Claude Code receives only the columns that the panel shows in full: a column that shows only in part does not count. |
| REQ-3 | The terminal has the right width at the first display of a session, at app start and after a reload. |
| REQ-4 | The terminal has the right width when the cross-fade of a switch to another session ends. |
| REQ-5 | The terminal has the right width after a resize, maximize or restore of the window. |
| REQ-6 | The terminal has the right width after a drag of the list panel edge. |
| REQ-7 | The terminal has the right width after a change of the text size. |
| REQ-8 | The terminal has the right width when the scrollbar shows, and the scrollbar hides no character. |
| REQ-9 | After any other change of the space of the panel or of the size of the characters, the terminal gets the right width with no action of the user. |
| REQ-10 | The number of columns does not change while the size of the panel and of the characters stays the same. |
| REQ-11 | After several size changes in a short time, the terminal has the right width for the final size of the panel. |
| REQ-12 | At the start of the desktop app, when the desktop maximizes the window and the app then restores it to 1280×800, the terminal has the right width for the restored window. |

## Assumptions

- **Trigger.** Gatekeeper decision, not a human decision. The trigger is still unknown, so REQ-3 to REQ-10 cover again every situation of the reference (spec, "Assumptions").
- **Earlier assumptions.** The assumptions of `plan-terminal_overflow/requirements.md` stay true: right margin, old line breaks, first display, reduced motion, other causes (spec, "Assumptions").
- **Short time (REQ-11).** The changes can follow each other at any speed, also faster than one frame. The width is checked after the last change, with no action of the user.
- **Start of the desktop app (REQ-12).** How the window gets its size at start does not change (spec, "Scope"). REQ-12 is only about the terminal width once the window has its restored size.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/terminal_clip.md`, "Scope").
- Every requirement of the earlier plans of this client stays true. This plan changes none of them. It makes explicit, for `plan-terminal_overflow/REQ-1` to `REQ-3`, that a character or a column shown only in part counts as hidden.

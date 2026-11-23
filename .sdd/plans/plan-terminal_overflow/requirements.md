---
slug: terminal_overflow
date: 2026-11-23
spec: .sdd/analysis/terminal_overflow.md
status: validated
---

# Requirements — Terminal text cut at the right edge

Words used below:

- "The terminal" → the terminal of a hosted session, where Claude Code runs.
- "Inside the panel" → inside the space that the terminal panel gives to the text. The 16 px margin of the panel stays free (`plan-ui_restyle/REQ-34`).
- "Right width" → REQ-1, REQ-2 and REQ-3 hold.
- "Text size" → the terminal text size of `plan-terminal_addons`.
- "List panel edge" → the edge of the "Sessions" list panel that the user drags (`plan-session_list_width`).

Every REQ holds in the desktop app and in the browser client.

## Feature: Terminal width

| ID | Requirement |
|----|-------------|
| REQ-1 | Every column of the terminal shows inside the panel: no character goes past the right edge of the panel or is hidden by it. |
| REQ-2 | The last column stays fully visible, also when the scrollbar shows. |
| REQ-3 | Claude Code receives the number of columns that the panel really shows, so its lines end inside the panel. |
| REQ-4 | The terminal has the right width at the first display of a session, at app start and after a reload. |
| REQ-5 | The terminal has the right width when the cross-fade of a switch to another session ends. |
| REQ-6 | The terminal has the right width after a resize, maximize or restore of the window. |
| REQ-7 | The terminal has the right width after a drag of the list panel edge. |
| REQ-8 | The terminal has the right width after a change of the text size. |
| REQ-9 | After any other change of the space of the panel or of the size of the characters, the terminal gets the right width with no action of the user. |
| REQ-10 | The number of columns does not change while the size of the panel and of the characters stays the same. |

## Assumptions

- **Right margin (REQ-1).** Gatekeeper decision, not a human decision. The text also stays out of the 16 px right margin of the terminal panel. The margin is a requirement that stays true (`plan-ui_restyle/REQ-34`), and the spec leaves margin changes out of scope.
- **Trigger.** Gatekeeper decision, not a human decision. The trigger of the defect is unknown, so REQ-4 to REQ-9 cover every situation (spec, "Assumptions").
- **Old line breaks.** Text printed while the width was wrong can keep its old line breaks. The REQs cover what the terminal shows once its width is right (spec, "Assumptions").
- **First display (REQ-4).** It also covers a session that the user starts, or opens for the first time since the page loaded.
- **Reduced motion (REQ-5).** When the system asks for reduced motion, a switch has no cross-fade. The width is then right as soon as the selected session shows.
- **Other causes (REQ-9).** The spec asks for the right width in every situation that changes the space of the terminal or the size of its characters (spec, "Requirements"). Examples: the Git Explorer panel opens or closes; the arrow keys change the width of the list panel.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/terminal_overflow.md`, "Scope").
- Every requirement of the earlier plans of this client stays true. This plan changes none of them. It extends `plan-terminal_addons/REQ-42`, `plan-session_list_width/REQ-11` and `plan-ui_transitions/REQ-13` to every situation, not only to a size change.

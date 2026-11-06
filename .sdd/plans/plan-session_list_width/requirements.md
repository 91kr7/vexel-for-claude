---
slug: session_list_width
date: 2026-11-06
spec: .sdd/analysis/session_list_width.md
status: validated
---

# Requirements — Resizable session list, and a lighter session header

Words used below:

- "List panel" → the "Sessions" panel between the rail and the main area.
- "Edge" → the right edge of the list panel, which the user drags.
- "Saved width" → the width the client remembers for the list panel.
- "Header" → the 40 px subbar above the open session.
- "Footer" → the new one-line bar under the terminal or the conversation of the open session. On a hosted session it takes the place of today's hint row.
- "Figures" → the context occupancy, the tokens consumed and the estimated cost of `plan-session_usage`.

## Feature: Resizable list panel

| ID | Requirement |
|----|-------------|
| REQ-1 | Dragging the edge changes the width of the list panel. |
| REQ-2 | On hover and on keyboard focus, the edge shows that it can be dragged. |
| REQ-3 | The list panel width stays between 180 px and 480 px. |
| REQ-4 | The main area keeps at least 700 px of width. |
| REQ-5 | When the window is too narrow for the saved width, the list panel shows narrower, and the saved width does not change. |
| REQ-6 | The saved width changes only when the user resizes the list panel. |
| REQ-7 | With no saved width, the list panel is 224 px wide. |
| REQ-8 | The client remembers the width across page reloads and app restarts, where the user chose it. |
| REQ-9 | On start, the list panel shows the saved width from the first frame, with no jump. |
| REQ-10 | At every width, the texts of a list entry keep their current lines and are cut with an ellipsis when they do not fit. |
| REQ-11 | After a resize, the terminal of the open hosted session fills its panel again, and Claude Code receives the new number of columns. |
| REQ-12 | The edge can be reached with the keyboard, with a visible focus and an accessible name. |
| REQ-13 | With the focus on the edge, the arrow keys change the width of the list panel. |
| REQ-14 | While the user drags, the list panel follows the pointer with no visible lag. |

## Feature: Lighter header and footer bar

| ID | Requirement |
|----|-------------|
| REQ-15 | The header of a hosted session shows only the folder name, the label or name, the state badge, "Search", "Interrupt" and "Terminate". |
| REQ-16 | The header of an external session shows only the folder name, the label or name, the state badge, the "Read-only" chip and "Resume Here". |
| REQ-17 | The header stays 40 px high and on one line at every main area width from 700 px up, and its items never overlap or wrap. |
| REQ-18 | A label or name that does not fit in the header is cut with an ellipsis, and its full text shows on hover and on keyboard focus. |
| REQ-19 | Every open session, hosted or external, shows a footer under its terminal or conversation. |
| REQ-20 | The footer shows the folder path, the context occupancy, the total tokens and the estimated cost. |
| REQ-21 | On an external session, the footer shows the text that says the session is open in another terminal, before the path. |
| REQ-22 | Withdrawn, human decision (2026-11-07): see assumption "Key hint". Was: ~~On a hosted session, the footer shows the key that moves the focus from the terminal to the list.~~ |
| REQ-23 | The four token parts (input, output, cache write, cache read) show in a tooltip on the token total, on hover and on keyboard focus. |
| REQ-24 | In the footer, the context occupancy stands out from 70% and stands out more from 90%. |
| REQ-25 | A path that does not fit in the footer is cut with an ellipsis, and the full path shows on hover. |
| REQ-26 | Before the first response, and when no `usage` can be read, the footer shows no figures. |
| REQ-27 | An ended session shows its last figures in the footer. |
| REQ-28 | The footer stays one line high, so the terminal keeps its number of rows. |
| REQ-29 | On a hosted session, the terminal text size controls show at the right end of the footer. |

## Assumptions

- **Narrow window (REQ-3, REQ-4, REQ-5).** The list panel shows the saved width when the main area keeps 700 px. Otherwise it shows the width that leaves 700 px, but never less than 180 px. Below a window of about 932 px, the 180 px minimum wins and the main area gets the rest. The desktop window cannot get that narrow (spec, "Assumptions").
- **Keyboard steps (REQ-13).** Left and Right arrows change the width by 16 px, within the limits of REQ-3. A keyboard change saves the width like a drag.
- **Accessible name (REQ-12).** "Resize Session List".
- **Where it is saved (REQ-8).** In `localStorage`, like the theme and the terminal text size. The desktop app and each browser keep their own width.
- **Cost label (REQ-20).** The footer shows the cost amount and its "incomplete" mark. The label "estimate at API list prices" becomes the tooltip of the cost, as in the list entry (`plan-session_usage`, "Label of the cost"). As text, the label does not fit on one line at 700 px.
- **Text of an external session (REQ-21).** It keeps today's words "Open in Another Terminal", then " · " and the path.
- **Footer layout (REQ-20, REQ-21, REQ-29).** The path, or the external text and the path, is on the left and shrinks first. The figures follow. On a hosted session the text size controls are at the right end. The figures and the text size controls are never cut.
- **Key hint (REQ-22).** Departing from the spec, human decision (2026-11-07): "nel footer mi aggiungi anche di togliere l'indicazione della shortcut per tornare al menù? è totalmente inutile e magari ti farò implementare in futuro un sistema di shortcut". The footer shows no key hint. Ctrl+Shift+L in the terminal still moves the focus to the list.
- **Search and text size controls (REQ-15, REQ-29).** Departing from the spec, human decision (2026-11-06): "lo zoom mettilo in basso a destra mentre il search va bene in alto". The spec lists the header items as "only ..." and leaves out "Search" and the text size controls. "Search" stays in the header. The text size controls move to the footer.
- **Footer height (REQ-28).** 40 px, the height of today's hint row.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text, the accessible name of the edge included, is in English, like the rest of the UI.
- The rail keeps its 52 px width.
- The figures are computed as today. The header and the footer show no new figure and no new action.
- Out of scope: the "Out of scope" list of the spec (`.sdd/analysis/session_list_width.md`, "Scope").
- Every requirement of the earlier plans of this client stays true, except what this plan changes:
  - `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-53` → 224 px is now the default width of the list panel, not a fixed width.
  - `plan-session_usage/REQ-2`, `plan-session_usage/REQ-8`, `plan-session_usage/REQ-13`, `plan-session_usage/REQ-23`, `plan-session_usage/REQ-29` → the figures, their highlights and the cost label move from the header to the footer. The four token parts move to a tooltip.
  - `plan-claude_sessions_client-ui_redesign/REQ-4`, `plan-claude_sessions_client-ui_redesign-material3_mock/REQ-33`, `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-35` → the hint row under the terminal goes, and the footer takes its place. The Ctrl+Shift+L key stays, with no on-screen hint.
  - `plan-terminal_addons`, assumption "Position of the controls" → the text size controls of `plan-terminal_addons/REQ-35` move from the header to the footer.

---
slug: cool_slate_light
date: 2026-11-20
requirements: requirements.md
status: validated
---

# Batches — Light theme recoloured as "Cool Slate · Full Light"

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| cool-slate-palette | Cool Slate palette | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-12, REQ-15, REQ-16 | — | implemented | The Light theme shows the Cool Slate colours |
| light-terminal | Light terminal | REQ-11, REQ-13, REQ-14, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25 | cool-slate-palette | todo | The hosted terminal turns light |

Execution order: cool-slate-palette, then light-terminal. Both change `src/web/theme/tokens.css`. The terminal frame and the external view also use the role tokens of the first batch.

## Assumptions and decisions

- **One source of colours.** Every style takes its colours from ThemeTokens (`src/web/theme/tokens.css`). So the plan changes the Light set there and points a few styles at new role tokens. No new component.
- **Roles that today share a token.** Table A gives the rail, the pills, the hover surface and the context pill a colour of their own. Today they share a level with another role. New role tokens split them. In Dark and Dark Blue they equal today's level, so nothing changes there (REQ-13).
- **Windows 11 look.** In the Windows 11 look, the Light theme keeps the Mica surfaces, borders, text and accent that `windows11.css` sets today. The tokens it does not set, such as status colours and the terminal, follow the new palette. Gatekeeper decision, 2026-11-20: the spec does not name the Windows 11 look and the mock shows the default look, so the least intervention wins. Flagged for the human's review.
- **Interrupt in Light.** Gatekeeper decision, 2026-11-20, from the table A row "warning (interrupt, needs input)": in Light "Interrupt" takes the warning colours, amber like needs input. Dark and Dark Blue keep the orange.
- **REQs completed in the second batch.** REQ-11 (every state), REQ-13 (Dark and Dark Blue unchanged) and REQ-14 (contrast) also concern the terminal and the external view. So they close in light-terminal.
- **Repository colours.** The six repository colours of the git explorer keep their light values. They are categories with no role in table A.
- **Tests.** Browser e2e group for the client. The startup page by a unit test on its HTML. Electron e2e only in their own group (knowledge base `electron-e2e-separate`).

## Departures

None.

## Coverage check

REQ → INT (each INT cited as `<batch>/INT-n`):

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | cool-slate-palette/INT-1, INT-2, INT-6 | cool-slate-palette |
| REQ-2 | cool-slate-palette/INT-1, INT-2, INT-6 | cool-slate-palette |
| REQ-3 | cool-slate-palette/INT-1 | cool-slate-palette |
| REQ-4 | cool-slate-palette/INT-3 | cool-slate-palette |
| REQ-5 | cool-slate-palette/INT-3 | cool-slate-palette |
| REQ-6 | cool-slate-palette/INT-4 | cool-slate-palette |
| REQ-7 | cool-slate-palette/INT-4 | cool-slate-palette |
| REQ-8 | cool-slate-palette/INT-4, INT-6 | cool-slate-palette |
| REQ-9 | cool-slate-palette/INT-6, INT-8 | cool-slate-palette |
| REQ-10 | cool-slate-palette/INT-1, INT-6 | cool-slate-palette |
| REQ-11 | cool-slate-palette/INT-5, INT-7, INT-8; light-terminal/INT-3 | light-terminal |
| REQ-12 | cool-slate-palette/INT-1, INT-8 | cool-slate-palette |
| REQ-13 | cool-slate-palette/INT-2, INT-3, INT-6, INT-7; light-terminal/INT-6 | light-terminal |
| REQ-14 | cool-slate-palette/INT-1, INT-3; light-terminal/INT-3 | light-terminal |
| REQ-15 | cool-slate-palette/INT-3 | cool-slate-palette |
| REQ-16 | cool-slate-palette/INT-1, INT-4 | cool-slate-palette |
| REQ-17 | light-terminal/INT-1 | light-terminal |
| REQ-18 | light-terminal/INT-1, INT-2, INT-4 | light-terminal |
| REQ-19 | light-terminal/INT-2, INT-4 | light-terminal |
| REQ-20 | light-terminal/INT-1 | light-terminal |
| REQ-21 | light-terminal/INT-6, INT-7 | light-terminal |
| REQ-22 | light-terminal/INT-6, INT-7 | light-terminal |
| REQ-23 | light-terminal/INT-4 | light-terminal |
| REQ-24 | light-terminal/INT-1, INT-2, INT-4, INT-5 | light-terminal |
| REQ-25 | light-terminal/INT-5 | light-terminal |

Result:

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. No enabling INT.
- REQ-11, REQ-13 and REQ-14 are served in both batches and close in light-terminal. Every other REQ closes in a single batch.
- The "REQ closed" column, this table and the `closed_req` of each batch file carry the same lists.
- No batch creates a new component.

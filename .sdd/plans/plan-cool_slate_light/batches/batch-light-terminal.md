---
batch: light-terminal
feature: Light terminal
closed_req: [REQ-11, REQ-13, REQ-14, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25]
depends: [cool-slate-palette]
---

# Batch light-terminal

Table B of `.sdd/plans/plan-cool_slate_light/requirements.md` gives the colours. The terminal tokens are in ThemeTokens. SessionView reads them into the xterm.js theme and already recolours the open terminal at once on a theme change. Today the terminal tokens are dark in Light too, and the ANSI colours are the xterm.js defaults in every theme.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Light set: terminal background, frame, text, cursor and selection take table B. The selection keeps the selected text at 4.5:1. Dark and Dark Blue keep their values. | REQ-17, REQ-18, REQ-20, REQ-24 | — |
| INT-2 | modify | `src/web/theme/tokens.css` | Add tokens for the 16 ANSI colours, set only in Light. Green, yellow, blue, black and bright black from table B. The others are slate-family tones at 4.5:1 on `#ffffff`, white and bright white included as mid-grey. | REQ-18, REQ-19, REQ-24 | — |
| INT-3 | modify | `src/web/theme/tokens.css` | Light search highlights: match, current match and its border from the warning tones of table A. Terminal text reaches 4.5:1 on both. The border reaches 3:1 on the background. | REQ-11, REQ-14 | INT-1 |
| INT-4 | modify | `src/web/sessions/SessionView.tsx` | The xterm.js theme also takes the ANSI tokens when they are set, and reads them again on a theme change. With no ANSI token set, the xterm.js defaults stay. | REQ-18, REQ-19, REQ-23, REQ-24 | INT-2 |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | In the Light theme only, the terminal raises the contrast of any text under 4.5:1 against the colour it is drawn on. Use the minimum contrast option of xterm.js. Other themes keep today's setting. | REQ-25, REQ-24 | INT-4 |
| INT-6 | modify | `src/web/theme/tokens.css` | Add tokens for the tool output block of external sessions: background, text and top line. Dark and Dark Blue keep today's values (canvas, secondary text, subtle border). Light gives the table B background, text and divider. | REQ-21, REQ-22, REQ-13 | INT-1 |
| INT-7 | modify | `src/web/external/ConversationView.tsx` | The open tool output block reads the tokens of INT-6 for its background, text and top line. | REQ-21, REQ-22 | INT-6 |

Notes:

- **Prompt band and divider.** In the hosted terminal Claude Code draws them with its own colours. INT-5 keeps that text readable, and the band may differ from the mock (requirements, assumptions). In the external view the client draws only the divider, as the top line of the tool output block. Its user message box is a card, and it takes table A through batch cool-slate-palette.
- **Code blocks.** In the external view the code of a tool call or result shows in the tool output block. Inline code in Claude text is a pill of table A.
- **Style files.** If the tool output block is styled in `src/web/styles.css`, change it there.
- **Invariants of ThemeTokens.** "The terminal tokens are the same in Dark and Light" and "the ANSI palette is the same in every theme" no longer hold. The implementer updates the ThemeTokens and SessionView specs.
- **Tests.** Light terminal checks go in the browser e2e group. The desktop app loads the same page, so no Electron test is needed (knowledge base `electron-e2e-separate`). Tests that check the dark terminal in Light change to table B.

## Human acceptance

### Scenario: the hosted terminal turns light

- REQ → REQ-17, REQ-18, REQ-19, REQ-23, REQ-25
- Given → the Light theme and an open hosted session, in the browser or the desktop app
- When → Claude Code writes coloured output in the terminal
- Then → the terminal shows a white background with dark slate text, a blue cursor and readable green, yellow, blue and red output
- And → text Claude Code draws in its own colours, the prompt band included, stays readable

### Scenario: selected text and search matches stay readable

- REQ → REQ-11, REQ-14, REQ-20
- Given → the Light theme and an open hosted session with output
- When → the user selects a line, then searches a word with "Search"
- Then → the selected text and every highlighted match stay readable on the light terminal

### Scenario: the tool output of an external session is light

- REQ → REQ-21, REQ-22
- Given → the Light theme and an open external session with a tool card
- When → the user opens the tool card
- Then → the output shows on white, in dark slate text, under a thin grey line

### Scenario: Dark and Dark Blue keep the dark terminal

- REQ → REQ-13, REQ-24
- Given → an open hosted session and an open external session in the Light theme
- When → the user switches to Dark, then to Dark Blue
- Then → the terminal and the tool output look exactly as before this plan, with no reconnection and no lost output

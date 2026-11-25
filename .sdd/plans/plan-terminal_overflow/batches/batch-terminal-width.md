---
batch: terminal-width
feature: Terminal width
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10]
depends: []
---

# Batch terminal-width — Terminal width

The REQs are in `.sdd/plans/plan-terminal_overflow/requirements.md`. "The terminal" is the xterm.js terminal of SessionView. "The box" is the box inside the padding of the terminal panel frame: the space the panel gives to the text.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionView.tsx` | Every fit gives the columns that the box can show, less the width of the scrollbar as drawn. It measures the box on the panel frame, not on the terminal's own parent box. One `resize` per change, and the columns stay the same when the scrollbar shows or hides. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | A fit skipped while the Git Explorer slides or the main area cross-fades always runs once, when the last of these effects ends. Today only `animationend` and `animationcancel` run it again, so a fit skipped during a CSS transition is lost. | REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-9 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | The terminal fits again when its cell size changes while the panel keeps its size: a new device pixel ratio (another screen, a new system scale), or a font load that ends after the terminal opened. | REQ-3, REQ-9 | INT-1 |

## Decisions

- **Unknown trigger.** The trigger of the defect is unknown (`requirements.md`, "Trigger"). Today the view can miss a fit in two ways, and INT-2 and INT-3 close them. INT-1 makes every fit match the panel. So REQ-1 also holds if the trigger is a third cause.
- **Box of INT-1.** FitAddon measures the parent box of the terminal. The plan did not check whether that box can grow with the terminal content. The frame is sized by the layout, so measuring on it gives the right columns in both cases.
- **No layout change.** The padding, the gap and the margin of the panel stay as they are (spec, "Scope").
- **Size for Claude Code (REQ-3).** The current path stays: each change of rows or columns sends `resize`, and the view sends it again when it connects. No server change. When one session is open in two clients, the pty takes the size that the last client sent, as today.
- **Specs.** The developer updates the SessionView spec, "Actions": the fit rules for a panel size change, a text size change, the Git Explorer slide, the cross-fade, and the new cell size rule.

## Tests

The defect is intermittent, so each test recreates its trigger (spec, "Risks").

- The check → the fake CLI prints a line as wide as the terminal, with a marker in the last column. The marker ends inside the box, and the columns the fake CLI reports after `resize` equal the columns of the terminal (it can report them since `plan-terminal_addons`, batch font-zoom).
- Browser e2e, default group:
  - first display, reload, and the end of the cross-fade of a switch;
  - many main area widths, 1 px apart over at least one cell width; text sizes from 8 to 32 px;
  - a viewport resize during the cross-fade and during the Git Explorer slide;
  - a size change while a CSS transition runs on the main area (a style the test adds);
  - a new device pixel ratio at the same window size (Chromium DevTools Protocol emulation);
  - list edge drag and arrow keys; Git Explorer open and close;
  - output longer than the panel, scrolled up: the marker is not under the scrollbar, and the columns do not change while output arrives and the scrollbar shows and hides (REQ-10).
- Electron group (`npm run test:e2e:desktop`, knowledge base `electron-e2e-separate`): maximize, then restore the window, with the check after each (REQ-6).

## Human acceptance

### Scenario: The user restores the window and reads every line to its end

- REQ → REQ-1, REQ-3, REQ-6
- Given → a hosted session is open in the maximized desktop window, and Claude Code shows its input box
- When → the user restores the window to its smaller size
- Then → Claude Code draws its lines again for the smaller panel. Every line ends inside the panel, the right border of the input box included, and no character is cut at the right edge.

### Scenario: The terminal has the right width after a reload and a switch

- REQ → REQ-4, REQ-5
- Given → two hosted sessions run, and one of them is open
- When → the user reloads the page
- And → the user selects the other session
- Then → after the reload, and again when the cross-fade ends, every line of Claude Code ends inside the panel

### Scenario: The terminal follows the list edge and the Git Explorer

- REQ → REQ-7, REQ-9
- Given → a hosted session is open, and Claude Code shows its input box
- When → the user drags the list panel edge to the right
- And → the user opens the Git Explorer
- Then → after each change, the terminal gets narrower with no other action, and every line ends inside the panel

### Scenario: The terminal follows the text size

- REQ → REQ-8
- Given → a hosted session is open, with the text at 12 px
- When → the user presses Ctrl+= three times in the terminal
- Then → the text is 15 px, and every line ends inside the panel

### Scenario: The last column stays visible beside the scrollbar

- REQ → REQ-2, REQ-10
- Given → a hosted session has more output than the panel shows
- When → the user scrolls up, so the scrollbar shows
- Then → the last character of each full line shows whole, and the scrollbar covers no text
- And → while the window keeps its size, the lines keep their breaks when the scrollbar shows and hides

---
batch: terminal-width
feature: Terminal width
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12]
depends: []
---

# Batch terminal-width — Terminal width

The REQs are in `.sdd/plans/plan-terminal_clip/requirements.md`. "The terminal" is the xterm.js terminal of SessionView. "The box" is the box inside the padding of the terminal panel frame, as in `plan-terminal_overflow`. "Cut" means that the right edge hides any part of a character.

The first fix (`plan-terminal_overflow`, batch terminal-width) passed its tests, but the defect survived. So this batch finds the cause first, and changes code only for a cause it can show.

## Before any change

Before INT-1 and INT-2, the developer reproduces the cut on the current code. The reproduction is a throwaway check in the scratchpad, never committed. It measures the drawn glyph of the last character of a full line against the box less the scrollbar, with no tolerance of a fraction of a cell. It tries these conditions, which can each cause the cut:

- a fractional device pixel ratio (for example 1.25, 1.5, 1.75), with the column count that `cellsThatFit` gives;
- a glyph that draws wider than the cell that xterm.js measured;
- the scrollbar over the last column;
- a cell measured before the font loads (a font file that arrives late);
- a first display while the viewport goes from 1920×1200 to 1280×800 in its first second, as at the start of the desktop app;
- several viewport sizes in a short time, ending on a final size.

Then:

- The developer names the cause in the final report: the condition that cuts the last character, and by how many pixels.
- No condition shows the cut → the developer changes no code. The batch stops and reports the conditions it tried.
- The cause is outside SessionView (for example in the desktop module) → the developer changes no code. The batch stops and reports, because the plan has no intervention there.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionView.tsx` | Remove the cause that the reproduction shows in the fit. The terminal then takes only the columns it draws whole inside the box less the scrollbar, with no rounding that lets a row pass the box. The columns stay the same while the box and the cells keep their size. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | After several size changes in a short time, the terminal fits once more on the final box, when the box stops changing. A fit that a newer change skipped or overtook is never lost. Code changes here only if the reproduction shows the cut after such a series. | REQ-5, REQ-11, REQ-12 | — |

## Decisions

- **Rounding of `cellsThatFit`.** It lets the drawn row pass the box by up to 0.5 px. That alone cannot hide half a character (about 3.6 px at 12 px). So the reproduction also compares the width that the terminal really draws with the width that the fit computes.
- **Desktop start (REQ-12).** The developer reproduces it in the browser, with the viewport sizes of the start. The Electron start runs only in the tester's Electron group (knowledge base `electron-e2e-separate`).
- **No layout change.** The padding, the gap and the margin of the panel stay as they are. The text size and its limits stay as they are (spec, "Scope").
- **Size for Claude Code (REQ-2).** The current path stays: each change of rows or columns sends one `resize`. No server change.
- **Specs.** If INT-1 or INT-2 changes the fit, the developer updates the "Fit" rule and the "Actions" of the SessionView spec.

## Tests

The tester writes them. The defect survived a first fix, so each test must show the cut on the code before the fix (spec, "Risks").

- The check → the fake CLI prints a line as wide as the columns it received, with a marker in the last column. The marker shows whole: its drawn right end is inside the box less the scrollbar. The tolerance is at most 1 device pixel, never a fraction of a cell.
- Proof → the developer's code commit is separate from the tests. The new tests run once on its parent commit, and the tests of the conditions where the developer found the cut fail there. The final report gives that run.
- Browser e2e, default group:
  - the regression test of the reproduction: the conditions of "Before any change", and the cause the developer named;
  - first display, reload, end of the cross-fade of a switch;
  - window sizes, list edge drag, Git Explorer open and close;
  - text sizes from 8 to 32 px, at device pixel ratios 1, 1.25, 1.5 and 1.75;
  - output longer than the panel, scrolled up: the marker is not under the scrollbar, and the columns do not change while the scrollbar shows and hides (REQ-8, REQ-10);
  - several viewport sizes in a short time: the check runs on the final size (REQ-11).
- Electron group (`npm run test:e2e:desktop`, knowledge base `electron-e2e-separate`):
  - start of the app: the test maximizes the window as the desktop does, then the app restores it to 1280×800, and the check runs (REQ-12);
  - maximize and restore, once and several times in a short time, with the check after each (REQ-5, REQ-11).

## Human acceptance

### Scenario: The user starts the desktop app and reads every last character whole

- REQ → REQ-1, REQ-2, REQ-11, REQ-12
- Given → a hosted session runs, the desktop maximizes new windows, and the desktop app is closed
- When → the user starts the desktop app, so the desktop maximizes the window and the app restores it to 1280×800
- Then → the open session shows every line of Claude Code inside the panel. The last character of each full line and the right border of the input box show whole.

### Scenario: The terminal stays whole after a quick series of window sizes

- REQ → REQ-5, REQ-11
- Given → a hosted session is open in the desktop window, and Claude Code shows its input box
- When → the user maximizes and restores the window three times in quick succession
- Then → once the window keeps its size, no character is cut at the right edge of the panel

### Scenario: The last character stays whole at every text size

- REQ → REQ-7
- Given → a hosted session is open, with the text at 12 px
- When → the user presses Ctrl+= in the terminal, one step at a time, up to 20 px
- Then → at each size, the right border of the input box shows whole inside the panel

### Scenario: The terminal stays whole after a reload and a switch

- REQ → REQ-3, REQ-4
- Given → two hosted sessions run, and one of them is open
- When → the user reloads the page
- And → the user selects the other session
- Then → after the reload, and again when the cross-fade ends, no character is cut at the right edge

### Scenario: The terminal stays whole when the list edge moves and the Git Explorer opens

- REQ → REQ-6, REQ-9
- Given → a hosted session is open, and Claude Code shows its input box
- When → the user drags the list panel edge to the right
- And → the user opens the Git Explorer
- Then → after each change, the terminal gets narrower with no other action, and no character is cut

### Scenario: The last column stays whole beside the scrollbar

- REQ → REQ-8, REQ-10
- Given → a hosted session has more output than the panel shows
- When → the user scrolls up, so the scrollbar shows
- Then → the last character of each full line shows whole, and the scrollbar covers no text
- And → while the window keeps its size, the lines keep their breaks when the scrollbar shows and hides

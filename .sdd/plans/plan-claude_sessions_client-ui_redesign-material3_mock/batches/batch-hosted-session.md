---
batch: hosted-session
feature: Hosted session
closed_req: [REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34]
depends: [session-list]
---

# Batch — Hosted session

The main area of an open hosted session: its header, the terminal panel and the hint under it. With batches `page-frame` and `session-list` done, the whole page matches board "Sessione ospitata".

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. The terminal keeps every feature: slash commands, Esc, Tab, permission answers and Ctrl+Shift+L. The client does not change the content that Claude Code writes in the terminal.

## Visual reference

Board file → `.sdd/mockups/vexel-material3/proposta-sessione-ospitata.html`, inside `main`:
- `header` → avatar, `h2`, state chip, label line, "Interrompi" and "Termina".
- `div role="region"` → the rounded terminal panel. Its content is sample data. The real xterm terminal goes inside the panel.
- the last row → the hint with the keys "Ctrl", "Maiusc", "L", and the snackbar on the right.

## What this batch builds

- No new component. It redraws the header, the actions and the terminal area of a hosted session.
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. Board: `proposta-sessione-ospitata.html`.

## Decisions for this batch

- **Terminal area** (gatekeeper decision) → the rounded panel and the hint row together fill the main area below the header. `plan-claude_sessions_client-ui_redesign/REQ-18` is read this way.
- **Header line** → "<label> · <folder path>", cut with an ellipsis. The full text is its tooltip. The `h2` is the folder name.
- **State chip** → the outlined chip of the board, with the state icon and text of StateBadge.
- **"Interrompi"** → it keeps today's action: Esc to the terminal, then the focus back to the terminal. It disappears on an ended session, like "Termina".
- **Focus** → the panel shows the focus ring while the terminal has the keyboard focus.
- **Hint** → it moves from the header to the row under the panel. The text is the board text: "Ctrl+Maiusc+L torna all'elenco", which matches the key the client uses.
- **Header reuse** → the external view uses the same header in batch `external-session`. The header takes the avatar variant, the chips and the line as inputs.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionHeader.tsx` | Board header: 48 px Avatar, folder name (`.title-l`), state chip, line "<label> · <folder>", actions on the right. The avatar, chips and line can be set by the caller. IDENTICAL to the board `header`. | REQ-29, REQ-34 | INT-2 |
| INT-2 | modify | `src/web/sessions/StateBadge.tsx` | Add the chip form for headers: outlined `.chip`, 16 px icon, `.label-l`. IDENTICAL to the board chip. | REQ-29, REQ-34 | — |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | "Interrompi" as the outlined board button, with the circle-stop icon. It is hidden on an ended session. Its action does not change. | REQ-30, REQ-31, REQ-34 | INT-1 |
| INT-4 | modify | `src/web/sessions/StopSessionButton.tsx` | "Termina" as the tonal error button of the board, with the power icon. It stays hidden on an ended session. | REQ-29, REQ-31, REQ-34 | — |
| INT-5 | modify | `src/web/sessions/SessionView.tsx` | The terminal sits in the rounded panel (28 px radius, `--term-bg`, the board padding). The panel and the hint row fill the area below the header. IDENTICAL to the board region. | REQ-32, REQ-34 | — |
| INT-6 | modify | `src/web/sessions/SessionView.tsx` | Move the hint under the panel, with `kbd` keys as the board. The snackbar of `page-frame` sits at the right of this row. | REQ-33, REQ-34 | INT-5 |

## Human acceptance

### Scenario: The user works in a hosted session laid out as the board

- REQ → REQ-29, REQ-32, REQ-33, REQ-34
- Given → a 1440 x 900 px window and sessions equal to the sample data of board "Sessione ospitata"
- When → the user opens session "billing-api"
- Then → the page matches the board in both themes, except for the light-blue and grey palette
- And → the header shows "billing-api", "In attesa", the label line, "Interrompi" and "Termina", and under the dark panel the hint "Ctrl+Maiusc+L torna all'elenco"

### Scenario: The user interrupts Claude's turn from the header

- REQ → REQ-30
- Given → an open hosted session in which Claude is working
- When → the user clicks "Interrompi"
- Then → Claude stops the current turn, as with Esc in the terminal, and the terminal has the focus

### Scenario: The user sees no stop actions on an ended session

- REQ → REQ-31
- Given → an open hosted session whose process has ended
- When → the user looks at its header
- Then → "Interrompi" and "Termina" are not there

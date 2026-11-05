---
batch: page-frame
feature: Page frame
closed_req: [REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15]
depends: [colours-type]
---

# Batch — Page frame

The frame of every page: the navigation rail, the head of the list panel, the page title and the snackbar. The entries inside the list panel are redrawn in batch `session-list`.

Constraint → every requirement of `plan-claude_sessions_client` and `plan-claude_sessions_client-ui_redesign` stays true. This includes the needs-input counter that is always visible, the 1280 px minimum width and Ctrl+Shift+L.

## Visual reference

Board file → `.sdd/mockups/vexel-material3/proposta-sessione-ospitata.html`:
- `nav aria-label="Navigazione principale"` → the rail.
- `section aria-label="Elenco sessioni"`, its first two rows → the brand, the title "Sessioni" and the chip.
- `div role="status"` at the bottom of `main` → the snackbar.

This board wins for the rail and the list panel. `proposta-sessione-esterna.html` shows the same rail.

## What this batch builds

- **Navigation rail** → the left column with the logo, the "Nuova sessione" button and the destinations "Sessioni" and "Riprendi".
- **Snackbar** → the in-page alert "<progetto> richiede il tuo input" with "Apri".
- To the developer: the result must be IDENTICAL to the mock board — open the board file and copy its layout, sizes, radii, spacing, typography, icons and texts; a description is not a substitute. Board: `proposta-sessione-ospitata.html`.

## Decisions for this batch

- **Rail "Sessioni"** (gatekeeper decision) → it always looks selected (`aria-current="page"`). A click moves the focus to the open session's entry in the list, or to the first entry when no session is open.
- **Rail "Riprendi"** → opens the resume history, as "Riprendi sessione" does today. The sidebar buttons "Nuova sessione" and "Riprendi sessione" leave the list panel. The EmptyState keeps its two buttons.
- **Ctrl+Shift+L with no list entry** → the focus moves to "Nuova sessione" in the rail.
- **Snackbar** (gatekeeper decision) → one at a time. It shows the session that most recently started to need input, and it replaces the previous one. Only a change seen after the first list load counts. "<progetto>" is the folder name, in bold.
- **Snackbar position** → bottom right of the main area, as in the board. In batch `hosted-session` it shares the row of the terminal hint.
- **Logo** → the SVG of the board (primary squares and one ember square), with `aria-label="Vexel"`.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area | Navigation rail: logo, "Nuova sessione" (56 px FAB), "Sessioni" (selected, badge with the needs-input count, hidden at zero) and "Riprendi". IDENTICAL to the board `nav`. | REQ-6, REQ-9 | — |
| INT-2 | modify | `src/web/AppLayout.tsx` | Rail actions: "Nuova sessione" opens FolderChooser, "Riprendi" opens ResumeDialog, "Sessioni" moves the focus to the list. | REQ-7, REQ-8 | INT-1 |
| INT-3 | modify | `src/web/AppLayout.tsx` | Three columns as the board: the rail, the rounded list panel (brand "Vexel" + "for Claude", `h1` "Sessioni", chip, list) and the main area. Remove the old sidebar title and buttons. IDENTICAL to the board. | REQ-6, REQ-10, REQ-11 | INT-1 |
| INT-4 | modify | `src/web/sessions/NeedsInputCounter.tsx` | The amber chip "N richiede input" with the alert icon, hidden at zero. It also gives the count for the rail badge. IDENTICAL to the board chip. | REQ-9, REQ-11 | — |
| INT-5 | modify | `src/web/index.html` | The page title becomes "Vexel for Claude". | REQ-12 | — |
| INT-6 | create | frontend, app area | Snackbar: shows when a session that is not open starts to need input, one at a time. It hides when that session opens or stops needing input. IDENTICAL to the board `role="status"` block. | REQ-13, REQ-15 | — |
| INT-7 | modify | `src/web/AppLayout.tsx` | Place the snackbar at the bottom right of the main area. "Apri" opens that session. | REQ-13, REQ-14 | INT-3, INT-6 |

## Human acceptance

### Scenario: The user opens a waiting session from the snackbar

- REQ → REQ-9, REQ-11, REQ-13, REQ-14, REQ-15
- Given → session "billing-api" is open, and session "web-dashboard" has just asked for a permission
- And → the snackbar "web-dashboard richiede il tuo input" shows, the rail badge reads 1 and the list panel shows "1 richiede input"
- When → the user clicks "Apri" in the snackbar
- Then → "web-dashboard" opens and the snackbar disappears

### Scenario: The user starts a new session from the rail

- REQ → REQ-6, REQ-7, REQ-10, REQ-12
- Given → the client is open in a 1440 px wide window
- When → the user clicks "Nuova sessione" in the rail
- Then → the new-session dialog opens
- And → the browser tab reads "Vexel for Claude", and the list panel shows "Vexel for Claude" and "Sessioni"

### Scenario: The user opens the resume history from the rail

- REQ → REQ-8
- Given → the client is open
- When → the user clicks "Riprendi" in the rail
- Then → the resume history opens

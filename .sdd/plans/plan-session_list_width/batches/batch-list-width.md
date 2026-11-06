---
batch: list-width
feature: Resizable list panel
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14]
depends: []
---

# Batch list-width — Resizable list panel

The requirements are in `.sdd/plans/plan-session_list_width/requirements.md`, with the assumptions "Narrow window", "Keyboard steps", "Accessible name" and "Where it is saved".

## What this batch builds

- **List width store** → keeps the saved width of the list panel, its limits and its default, in `localStorage`.
- **List panel edge** → the handle on the right edge of the list panel that the user drags or moves with the arrow keys.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, module app, beside AppLayout | List width store: default 224 px, kept between 180 and 480 px, saved in `localStorage` only when the user sets a width. It reads the saved value synchronously, so the first render already has it. | REQ-3, REQ-6, REQ-7, REQ-8, REQ-9 | — |
| INT-2 | create | frontend, module app, beside AppLayout | List panel edge, pointer part: a drag sets the width on every pointer move and saves it once, at the end of the drag. Resize cursor and a visible accent line on hover and while dragging. | REQ-1, REQ-2, REQ-14 | INT-1 |
| INT-3 | create | frontend, module app, beside AppLayout | List panel edge, keyboard part: reachable with Tab as a separator named "Resize Session List", with the focus ring and the accent line. Left and Right arrows change the width by 16 px within the limits and save it. | REQ-2, REQ-12, REQ-13 | INT-2 |
| INT-4 | modify | `src/web/AppLayout.tsx`, `src/web/styles.css` | The list panel shows the stored width in place of the fixed 224 px, cut so that the main area keeps 700 px, never under 180 px, and computed again on each window resize. The edge sits on its right border and gets the current maximum. | REQ-3, REQ-4, REQ-5, REQ-6, REQ-9, REQ-11 | INT-1, INT-2, INT-3 |
| INT-5 | modify | `src/web/sessions/SessionList.tsx`, `src/web/styles.css` | Check the entries at 180 px and at 480 px. Each line stays on one row: folder name, label and tool line shrink with an ellipsis, and the figures and the time stay inside the row. Change only what wraps or overflows. | REQ-10 | — |

Notes:

- REQ-11 → SessionView already fits the terminal to its panel with a `ResizeObserver` and sends `resize` to Claude Code. A narrower main area triggers it, as a window resize does. INT-4 needs no change in SessionView.
- REQ-8, app restart → the check goes in the Electron e2e group (`npm run test:e2e:desktop`), not in the default e2e run (knowledge base `electron-e2e-separate`). The default e2e run checks the page reload.

## Human acceptance

### Scenario: The user makes the list wider and finds the same width after a reload

- REQ → REQ-1, REQ-2, REQ-6, REQ-8, REQ-9, REQ-11, REQ-14
- Given → a hosted session is open, and the list panel is 224 px wide
- When → the user points at the right edge of the list panel and drags it about 100 px to the right
- Then → the edge shows the resize cursor, the panel follows the pointer, and the terminal fills the narrower main area again
- And → after a page reload, the panel shows the new width from the first frame, with no jump

### Scenario: The user changes the width with the keyboard

- REQ → REQ-2, REQ-3, REQ-12, REQ-13
- Given → the list panel is 470 px wide
- When → the user moves the focus to the edge with Tab and presses the Right arrow twice
- Then → the edge shows a visible focus, and the panel stops at 480 px

### Scenario: The narrowest list keeps its entries readable

- REQ → REQ-3, REQ-7, REQ-10
- Given → the client starts with no saved width, and the panel is 224 px wide
- When → the user drags the edge far to the left
- Then → the panel stops at 180 px
- And → every entry keeps its lines, and the texts that do not fit end with "…"

### Scenario: A narrow window makes the list narrower, but keeps the saved width

- REQ → REQ-4, REQ-5
- Given → the saved width is 480 px, and the window is 1440 px wide
- When → the user makes the window 1100 px wide
- Then → the panel is narrower, and the main area stays 700 px wide
- And → when the user makes the window 1440 px wide again, the panel is back to 480 px

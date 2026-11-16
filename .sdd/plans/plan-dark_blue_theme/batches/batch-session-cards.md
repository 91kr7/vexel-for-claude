---
batch: session-cards
feature: Session cards
closed_req: [REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-43]
depends: [shared-shapes, window-frame]
---

# Batch session-cards

Reference mock: `.sdd/mockups/dark_blue_theme/mock.html`, session list. Colours come from the role
tokens of batch shared-shapes: "session list" for the panel, "card" and "active card" for the
entries. This batch also serves REQ-1 and REQ-2, which close in batch session-view.

Content of the card lines, with the client's own data:
- line 1 → status dot, folder name, star, state name. "Rename" keeps its top-right corner.
- line 2 → the label of the entry.
- line 3 → context percentage, estimated cost and last activity time, with a top border.
- a working entry keeps its tool line and progress bar between line 2 and line 3.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/list-width-store.ts` | `DEFAULT_LIST_WIDTH` becomes 260. A saved width stays as it is. | REQ-16, REQ-17 | — |
| INT-2 | modify | `src/web/AppLayout.tsx` | The list panel takes the "session list" role surface. The rule "list panel 224 px wide" becomes 260 px. | REQ-1, REQ-2, REQ-16 | INT-1 |
| INT-3 | modify | `src/web/sessions/SessionList.tsx` | Every entry, rows and the needs-input card, becomes a card with 7 px corners and a 1 px border on the "card" role. The needs-input card keeps its amber border. External entries: see INT-9. | REQ-1, REQ-2, REQ-18 | — |
| INT-4 | modify | `src/web/sessions/SessionList.tsx` | The open card gets an accent border, a 3.5 px accent bar on its left edge, the "active card" surface and a soft shadow. | REQ-19 | INT-3 |
| INT-5 | modify | `src/web/sessions/SessionList.tsx` | An inactive card changes its surface and border on hover. | REQ-20 | INT-3 |
| INT-6 | modify | `src/web/sessions/SessionList.tsx` | Arrange the card lines as listed above. Line 3 holds the metrics, with a 1 px top border. | REQ-21 | INT-3 |
| INT-7 | modify | `src/web/sessions/SessionList.tsx` | Percentage, cost and time use the mono font with tabular figures. | REQ-22 | INT-6 |
| INT-8 | modify | `src/web/sessions/StateBadge.tsx` | The `working` dot pulses softly as in the mock. With reduced motion it does not pulse. | REQ-23, REQ-24 | — |
| INT-9 | modify | `src/web/sessions/SessionList.tsx` | External cards drop the dashed border and take the solid 1 px card border, also when open, ended or needing input. Their group heading and the "External" chip still tell them apart. Added in the fix round (human decision, 2026-11-16). | REQ-43 | INT-3 |

## Human acceptance

### Scenario: the session list shows cards like the mock

- REQ → REQ-16, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23
- Given → a first start with no saved list width, and two sessions, one working and one open
- When → the user looks at the session list and moves the pointer over the other card
- Then → the list is 260 px wide, each session is a card with three lines, the open card has the accent border and bar, and the working dot pulses softly
- And → the hovered card changes its surface and border

### Scenario: external sessions have the same card border

- REQ → REQ-43
- Given → a Claude Code session running in another terminal
- When → the user looks at its card in the session list
- Then → the card has the same solid border as the other cards, with no dashed border

### Scenario: a saved list width stays

- REQ → REQ-17
- Given → the user had set the session list to 320 px
- When → the user reloads the client
- Then → the session list is still 320 px wide

### Scenario: no pulse with reduced motion

- REQ → REQ-24
- Given → the system asks for reduced motion, and a session is working
- When → the user looks at its card
- Then → the status dot does not pulse

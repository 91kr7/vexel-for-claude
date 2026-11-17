---
batch: session-view
feature: Session view — header and terminal frame
closed_req: [REQ-1, REQ-2, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29]
depends: [shared-shapes, window-frame, session-cards]
---

# Batch session-view

Reference mock: `.sdd/mockups/dark_blue_theme/mock.html`, session header and terminal. Colours come
from the role tokens of batch shared-shapes. The header takes the "title bar, session header, bottom
bar" role. With this batch every element of the mock has its shapes, so REQ-1 and REQ-2 close here.

The line pill of the header shows the text the header shows today in its line chip.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/sessions/SessionHeader.tsx` | 44 px high on its role surface. Session name, then the line chip as a mono pill cut with an ellipsis. Actions and state pill stay. | REQ-1, REQ-2, REQ-25 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | The terminal panel becomes a frame: 12 px gap on all sides, 1 px border, 8 px corners, shadow. It keeps the `--term-*` colours, so it stays dark in Light. | REQ-1, REQ-2, REQ-26, REQ-29 | — |
| INT-3 | modify | `src/web/sessions/SessionView.tsx` | While the terminal or its search box has focus, the frame shows an accent border and an accent ring. The ring stays inside the 12 px gap. | REQ-27, REQ-28 | INT-2 |
| INT-4 | modify | `src/web/sessions/SessionView.tsx` | The git explorer panel keeps its place at the right of the frame, inside the same gap. | REQ-26 | INT-2 |

## Human acceptance

### Scenario: the open session shows the mock's header and terminal frame

- REQ → REQ-1, REQ-2, REQ-25, REQ-26, REQ-27, REQ-28
- Given → the client in the Dark theme, with a session open
- When → the user clicks in the terminal
- Then → the 44 px header shows the session name and the line in a mono pill, and the terminal sits in a framed box with a 12 px gap that shows an accent border and ring
- And → the ring touches neither the header nor the bottom bar

### Scenario: the terminal stays dark in Light

- REQ → REQ-29
- Given → the client in the Light theme, with a session open
- When → the user looks at the terminal
- Then → the terminal is dark inside its frame, as before

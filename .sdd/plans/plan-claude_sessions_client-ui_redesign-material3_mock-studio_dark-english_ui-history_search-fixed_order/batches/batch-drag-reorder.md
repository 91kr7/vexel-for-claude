---
batch: drag-reorder
feature: Reorder by drag and drop
closed_req: REQ-6, REQ-7, REQ-8, REQ-9, REQ-10
depends: fixed-order
---

# Batch — Reorder by drag and drop

The user moves a session to another place inside its group with the mouse. This batch creates no component. It adds a move action to the session order store of `batch-fixed-order` and drag and drop to SessionList. The server does not change.

## Decisions

- **Technique.** Native HTML5 drag and drop, with no new dependency. Every entry is draggable: the rows and the hosted needs-input card.
- **Landing place.** Over an entry, the upper half means "before it" and the lower half means "after it". A drop on the session's current place changes nothing.
- **Own group.** The group is the one the session is in at the moment of the drop. If a live update moved the session to another group during the drag, the drop does nothing (REQ-8). The session stays at the end of its new group.
- **Drag feedback.** The mock has no drag state, so the feedback uses the mock's parts. A 2 px `--accent-primary` line shows the landing place, between two entries. The dragged entry is dimmed while it moves. The line shows only over the dragged session's own group.
- **Click.** A click with no drag still opens the session, as today.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | the session order store of `batch-fixed-order/INT-3`, at the path the sessions index gives after that batch | Add a move action: session id, group id, new place. It does nothing when the session is not in that group now. The new order is saved like any other change. | REQ-6, REQ-7, REQ-8, REQ-9 | — |
| INT-2 | modify | `src/web/sessions/SessionList.tsx` | Make every entry draggable. A drop inside a group calls a new `onReorder` prop with the session, the group and the place. A drop on another group calls nothing. | REQ-6, REQ-7 | — |
| INT-3 | modify | `src/web/sessions/SessionList.tsx` | While the user drags over the dragged session's own group, show the drop line at the landing place and dim the dragged entry. Clear both at the end of the drag. | REQ-10 | INT-2 |
| INT-4 | modify | `src/web/styles.css` | The look of the drop line and of the dimmed entry (see "Drag feedback"). | REQ-10 | INT-3 |
| INT-5 | modify | `src/web/AppLayout.tsx` | Pass the move action of INT-1 to SessionList as `onReorder`. | REQ-6, REQ-9 | INT-1, INT-2 |

The developer updates the specs of the session order store, SessionList and AppLayout, and the sessions index.

## Human acceptance

### Scenario: The user moves a session with drag and drop

- REQ → REQ-6, REQ-10
- Given → the group "Running" shows A, B, C
- When → the user drags C and drops it on the upper half of A
- Then → during the drag, a line above A shows where C will land
- And → after the drop, the group "Running" shows C, A, B

### Scenario: The order set by the user survives a reload

- REQ → REQ-9
- Given → the user moved C to the top, and the group "Running" shows C, A, B
- When → the user reloads the page
- Then → the group "Running" still shows C, A, B

### Scenario: A drop on another group changes nothing

- REQ → REQ-7
- Given → the group "Running" shows A, B, C, and the group "Ended" shows F
- When → the user drags B and drops it on F
- Then → no line shows over "Ended" during the drag, and both groups keep their order

### Scenario: A session that changes group during the drag is not moved

- REQ → REQ-8
- Given → the group "Running" shows A, B, C, and the user is dragging B over "Running"
- And → during the drag, B asks for a permission, so it moves to "Needs Input"
- When → the user drops on A
- Then → B shows at the end of "Needs Input", and "Running" shows A, C

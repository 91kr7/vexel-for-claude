---
batch: popovers
feature: Popovers, snackbar, toasts
closed_req: [REQ-3, REQ-4]
depends: [modal-dialogs]
---

# Batch popovers

The motion base and the exit presence come from batch modal-dialogs.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/plan-usage/PlanUsagePopover.tsx` | Enter by sliding up from the bottom with a fade; leave with the reverse. Close button and Esc work from the first frame. | REQ-3, REQ-4, REQ-27 | — |
| INT-2 | modify | `src/web/NeedsInputSnackbar.tsx` | Enter by sliding up from the bottom with a fade; leave with the reverse. "Open" works from the first frame. | REQ-3, REQ-4, REQ-26 | — |
| INT-3 | modify | `src/web/ShortMessageToast.tsx` | Enter by sliding up from the bottom with a fade; leave with the reverse. A new text while it shows replaces the text, with no new enter effect. | REQ-3, REQ-4, REQ-28 | — |
| INT-4 | modify | `src/web/newer-version/NewerVersionNotice.tsx` | Enter by sliding up from the bottom with a fade; leave with the reverse. "Close Update Notice" works from the first frame. | REQ-3, REQ-4, REQ-26 | — |
| INT-5 | modify | `src/web/AppLayout.tsx` | Mount the four elements through the exit presence, so their close plays the exit effect. A leaving element takes no pointer input. | REQ-4, REQ-26, REQ-28 | INT-1, INT-2, INT-3, INT-4 |

Notes:

- The Plan Usage popover does not take the focus today, and it still does not. REQ-27 applies to the keys it already handles.
- With reduced motion the four elements appear and leave at once, through the rule of the motion base.

## Human acceptance

### Scenario: the popovers slide up on enter and slide down on leave

- REQ → REQ-3, REQ-4
- Given → the app is open, with a session
- When → the user opens the Plan Usage popover with its top-bar button, then closes it
- Then → the popover slides up from the bottom with a fade, and slides down while it fades out on close

### Scenario: the snackbar acts while it is still entering

- REQ → REQ-3, REQ-26, REQ-28
- Given → a session that is not open starts to need input
- When → the user clicks "Open" on the "needs input" snackbar while it slides in
- Then → that session opens, and the snackbar leaves with the reverse effect

### Scenario: the short-message toast enters and leaves

- REQ → REQ-3, REQ-4
- Given → no session needs input
- When → the user presses the shortcut "next session that needs input"
- Then → the toast "No session needs input" slides up with a fade, and after 4 s it slides down and fades out

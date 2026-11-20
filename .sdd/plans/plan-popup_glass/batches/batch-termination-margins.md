---
batch: termination-margins
feature: Termination popup margins
closed_req: [REQ-11, REQ-12, REQ-13]
depends: []
---

# Batch termination-margins

The termination popup is the WarningDialog that "Terminate" opens for a working session. "Terminate the Process?" in the Processes section of Settings is a WarningDialog too. Both use the shared Dialog frame in its `warning` tone, so one fix in the frame covers both.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/dialogs/Dialog.tsx` | Find why the `warning` tone, or its place on the page, gives other spacing than the `default` tone. Give it the same header, body and footer padding and gaps as the other dialogs. | REQ-11, REQ-13 | — |
| INT-2 | modify | `src/web/dialogs/Dialog.tsx` | The frame does not take text or layout styles from the element it is mounted in. Long text wraps inside the body, and the footer buttons stay inside the border at every frame width. | REQ-12, REQ-13 | INT-1 |

Notes:

- **Cause not known.** The request image did not reach the session. The specs of Dialog, WarningDialog, StopSessionButton and TerminateProcessDialog all describe the same spacing. So the fault is in the code, not in the contract. A likely cause is a style the confirmation takes from where it is mounted, such as the 44 px session header. If the cause sits in a caller (`src/web/sessions/StopSessionButton.tsx` or `src/web/settings/TerminateProcessDialog.tsx`), fix it there, and keep the frame as the one place that owns the spacing.
- **Reference.** The spacing to match is the Dialog contract: header padding 12 × 16 px, body padding 16 px with 14 px between items, footer padding 12 × 16 px with buttons 8 px apart.
- **Other warning dialogs.** Every WarningDialog gets the same fix, for example the running-elsewhere warning of "Resume". This is the shared style that REQ-13 names.

## Human acceptance

### Scenario: the termination popup has the same margins as the other dialogs

- REQ → REQ-11, REQ-12
- Given → an open session that is working
- When → the user presses "Terminate"
- Then → "Terminate the Session?" opens with its title, text and buttons away from the edges, and the same gaps as in the Settings dialog
- And → no text or button touches or crosses the border

### Scenario: the process confirmation has the same margins

- REQ → REQ-13
- Given → the Settings dialog is open on "Processes"
- When → the user presses "Terminate" on a process row
- Then → "Terminate the Process?" opens with the same margins as the termination popup, and nothing touches its border

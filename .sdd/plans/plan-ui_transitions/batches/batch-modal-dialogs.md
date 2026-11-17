---
batch: modal-dialogs
feature: Modal dialogs
closed_req: [REQ-1, REQ-2]
depends: []
---

# Batch modal-dialogs

This is the first batch. It also builds the motion base that the later batches use.

## What this batch builds

- **Motion base** → the shared durations and easing of every new effect, the same in every theme and look, and the reduced-motion rule for them.
- **Exit presence** → keeps a closing element on screen until its exit effect ends, so the effect can play after the owner has closed it.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, app area (global styles and theme) | Motion base: duration tokens (at most 300 ms per effect, 600 ms for a whole cascade) and easing. No theme or look overrides them. | REQ-31, REQ-32 | — |
| INT-2 | modify | `src/web/styles.css` | Extend the existing `prefers-reduced-motion: reduce` rule so it turns off every new effect, with the change applied at once. The existing effects keep their current rule. | REQ-25, REQ-30 | INT-1 |
| INT-3 | create | frontend, app area | Exit presence: keeps a closed element mounted for its exit effect, then removes it. A new open during the exit cancels it. No exit at all with reduced motion. | REQ-2, REQ-25, REQ-28 | INT-1 |
| INT-4 | modify | `src/web/dialogs/Dialog.tsx` | On open, the backdrop fades in and the frame enters with a slight zoom. The focus rules apply from the first frame, as today. | REQ-1, REQ-27 | INT-1 |
| INT-5 | modify | `src/web/dialogs/Dialog.tsx` | While leaving, play the reverse effect. The leaving dialog takes no pointer input, traps no focus and drops `aria-modal`, so shortcuts and the focus return work at once. | REQ-2, REQ-26 | INT-3, INT-4 |
| INT-6 | modify | `src/web/AppLayout.tsx` | Mount FolderChooser (the New session dialog), SessionNameDialog, ResumeDialog and SettingsDialog through the exit presence, so their close plays the exit effect. | REQ-2 | INT-5 |
| INT-7 | modify | `src/web/sessions/StopSessionButton.tsx`, `src/web/sessions/EndedEntryActions.tsx`, `src/web/history/ResumeDialog.tsx`, `src/web/external/ResumeHereButton.tsx`, `src/web/settings/ShortcutsSection.tsx` | Mount their warning dialog through the exit presence, so its close plays the exit effect. | REQ-2 | INT-5 |

Notes:

- No dialog is open when the app starts, so no dialog has an app-start case (REQ-29).
- Existing e2e tests that act on a dialog while it leaves are adapted in this batch. They wait for the dialog to leave; they do not turn off the effects for the whole suite.

## Human acceptance

### Scenario: a dialog opens with a zoom and closes with the reverse

- REQ → REQ-1, REQ-2, REQ-27
- Given → the app is open, with no dialog
- When → the user opens Settings with the gear button, then presses Esc
- Then → the backdrop fades in and the box zooms in slightly; Esc closes it at once, and the box zooms out while the backdrop fades out

### Scenario: closing a dialog while it opens ends with the dialog closed

- REQ → REQ-26, REQ-28
- Given → the app is open, with no dialog
- When → the user presses Alt+H and, at once, Esc
- Then → the Resume session dialog closes, and the keys typed next reach the page

### Scenario: with reduced motion the dialogs open and close at once

- REQ → REQ-25, REQ-30
- Given → the system asks for reduced motion
- When → the user opens and closes a Warning dialog, for example "Terminate" on a working session and then "Cancel"
- Then → the dialog appears and disappears with no fade or zoom, and the status-dot pulse stays still as today

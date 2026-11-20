---
batch: glass-popups
feature: Glass popups
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10]
depends: []
---

# Batch glass-popups

"Glass" below means the popup background of this plan: 60% opacity and an 8px blur of what lies behind the surface. The app already has a class `.vx-glass` (82–92% background, 14 px blur). This batch does not change it; see the notes.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/theme/tokens.css` | Add the glass tokens: the raised surface of the active set at 60% opacity, and the 8px blur. Derive them from the role tokens, so every theme and the Windows 11 look follow with no value of their own. Text tokens do not change. | REQ-1, REQ-2, REQ-3, REQ-4, REQ-6 | — |
| INT-2 | modify | `src/web/styles.css` | Add one shared popup glass class from INT-1: background and blur on the surface only. Where the browser has no backdrop blur, the class keeps the 60% background. | REQ-1, REQ-2, REQ-5, REQ-7 | INT-1 |
| INT-3 | modify | `src/web/dialogs/Dialog.tsx` | The frame takes the glass. The header and footer lose their own fills, so the whole frame is see-through. The backdrop keeps its dim and gets no blur. | REQ-1, REQ-2, REQ-5, REQ-8, REQ-9, REQ-10 | INT-2 |
| INT-4 | modify | `src/web/settings/SettingsDialog.tsx` | The menu column and the pane header lose their own fills, so the Settings frame shows the glass. Menu rows keep their hover and active looks. | REQ-1, REQ-5, REQ-9 | INT-3 |
| INT-5 | modify | `src/web/plan-usage/PlanUsagePopover.tsx` | The panel takes the glass in place of its raised fill. | REQ-1, REQ-2, REQ-10 | INT-2 |
| INT-6 | modify | `src/web/sessions/TerminalSearchBox.tsx` | The search box over the terminal takes the glass in place of surface 2. | REQ-1, REQ-2, REQ-6 | INT-2 |
| INT-7 | modify | `src/web/NavigationRail.tsx` | The rail tooltips take the glass in place of surface 3. The SettingsButton tooltip follows, as it uses the rail look. | REQ-1, REQ-2, REQ-10 | INT-2 |
| INT-8 | modify | `src/web/sessions/SessionHeader.tsx` | The tooltip of the line pill takes the glass. | REQ-1, REQ-2 | INT-2 |
| INT-9 | modify | `src/web/sessions/SessionFigures.tsx` | The tokens tooltip takes the glass. | REQ-1, REQ-2 | INT-2 |
| INT-10 | modify | `src/web/sessions/SessionView.tsx` | The address tooltip of a terminal hyperlink takes the glass in place of surface 3. | REQ-1, REQ-2, REQ-6 | INT-2 |
| INT-11 | modify | `src/web/NeedsInputSnackbar.tsx` | The snackbar takes the popup glass class in place of `.vx-glass`. | REQ-3, REQ-10 | INT-2 |
| INT-12 | modify | `src/web/ShortMessageToast.tsx` | The toast takes the popup glass class in place of `.vx-glass`. | REQ-3, REQ-10 | INT-2 |
| INT-13 | modify | `src/web/newer-version/NewerVersionNotice.tsx` | The notice takes the popup glass class in place of `.vx-glass`. | REQ-3, REQ-10 | INT-2 |

Notes:

- **Blur and the open effects (REQ-2, REQ-10).** In Chromium an ancestor with opacity below 1 limits what a child's backdrop blur can see. The Dialog backdrop fades in, so the frame blur must still reach the page behind it when the open effect ends.
- **Speed (REQ-9).** Blur only the popup surfaces, never the backdrop and never a scrolling child. The human removed the backdrop blur on 2026-11-06 because it made dialogs scroll slowly.
- **What stays opaque (REQ-5).** Text, icons, borders, buttons, fields, cards, rows and banners inside a popup keep their fills and colours. Only the frame background and the plain fills of its header, footer and side areas become see-through.
- **`.vx-glass` stays.** Its only other user is the "N new messages" button of the conversation view, a floating button and not a popup. It keeps its look.
- **Native tooltips.** Tooltips given by the `title` attribute are native browser tooltips. They are out of scope.
- **Ubuntu and WSL.** No path is WSL-only. The same CSS runs on Ubuntu and on WSL.
- **Tests.** The style checks run in the browser e2e group. REQ-9 is a manual check in the desktop app (knowledge base `electron-e2e-separate`: no Electron e2e for this batch).

## Human acceptance

### Scenario: popups show the terminal through a blurred, see-through background

- REQ → REQ-1, REQ-2, REQ-5, REQ-6, REQ-8
- Given → an open session whose terminal is full of text
- When → the user opens the Settings dialog
- Then → the terminal text shows through the dialog, blurred and not sharp, and the dialog text, buttons and borders stay fully solid
- And → the dark layer around the dialog has the same dim as before and is not blurred

### Scenario: every kind of popup has the same glass

- REQ → REQ-1, REQ-2, REQ-3, REQ-10
- Given → an open session, and a newer version available
- When → the user hovers a rail button, opens Plan Usage and the terminal search, and waits for the update notice
- Then → the tooltip, the popover, the search box and the notice all show the blurred content behind them, and they enter and leave with their usual effects

### Scenario: the glass looks the same in every theme

- REQ → REQ-4, REQ-6
- Given → the Settings dialog is open on "Appearance"
- When → the user chooses "Light", then "Dark", then "Dark Blue", and switches the window look to "Windows 11"
- Then → in each case the dialog stays see-through with a blurred background, and its text keeps the theme's text colour

### Scenario: long dialogs stay smooth in the desktop app

- REQ → REQ-9, REQ-10
- Given → the desktop app is open, with a running session
- When → the user opens the Settings dialog, scrolls the "Shortcuts" list to the end and back, and closes the dialog
- Then → opening, scrolling and closing show no visible stutter compared to today

### Scenario: without blur the popup keeps its see-through background

- REQ → REQ-7
- Given → a browser where backdrop blur is turned off
- When → the user opens the Settings dialog
- Then → the dialog background is see-through at the same level, and its text stays readable

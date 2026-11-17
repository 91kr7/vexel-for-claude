---
batch: tab-change
feature: Tab change
closed_req: [REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32]
depends: [modal-dialogs, popovers, git-explorer-panel, session-switch, theme-change, cascading-lists]
---

# Batch tab-change

The motion base comes from batch modal-dialogs. This is the last batch: it also closes the common rules REQ-25 to REQ-32, which every earlier batch served for its own effect.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/git/GitExplorerPanel.tsx` | When the selected tab changes, the new tab panel enters with a fade and a small slide. The hidden panel stays mounted, as today. | REQ-23 | — |
| INT-2 | modify | `src/web/settings/SettingsDialog.tsx` | When the chosen menu changes, the new panel enters with a fade and a small slide. Arrow keys and Tab move on at once, during the effect. | REQ-24, REQ-26, REQ-28 | — |
| INT-3 | create | test, frontend | Cross-check of the whole plan: every new effect, with reduced motion, applies at once; every effect stays within its limit; the existing effects behave as before. | REQ-25, REQ-29, REQ-30, REQ-31 | INT-1, INT-2 |

Notes:

- Only the entering panel plays the effect. The leaving panel hides at once, so two panels never show together.
- INT-3 changes no behaviour. The common rules need no code of their own here, but they close only when a check covers all seven effects together.
- REQ-29 needs no code: today no dialog or panel is open when the app starts. INT-3 checks that this stays true.

## Human acceptance

### Scenario: switching tabs fades in the new content

- REQ → REQ-23, REQ-24
- Given → an open session with the Git Explorer open, and the Settings dialog closed
- When → the user clicks "History" in the Git Explorer, then opens Settings and clicks "Shortcuts"
- Then → each time the new content fades in with a small slide

### Scenario: quick arrow keys in Settings end on the last section

- REQ → REQ-26, REQ-27, REQ-28
- Given → the Settings dialog open on "Appearance"
- When → the user presses the Down arrow twice in quick succession
- Then → the "Updates" section shows, and its item has the focus

### Scenario: with reduced motion every change is immediate

- REQ → REQ-25, REQ-29, REQ-30, REQ-31, REQ-32
- Given → the system asks for reduced motion, in any theme and window look
- When → the user starts the app, opens Settings, switches sections, changes the theme, opens the Git Explorer and switches session
- Then → every change happens at once with no effect, and the existing effects stay as they are today with reduced motion

---
batch: git-explorer-panel
feature: Git Explorer panel
closed_req: [REQ-5, REQ-6]
depends: [modal-dialogs]
---

# Batch git-explorer-panel

The motion base and the exit presence come from batch modal-dialogs. The panel sits at the right of the terminal panel and takes half of its width. So the slide changes the terminal size.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/web/git/GitExplorerPanel.tsx` | On open, slide in from the right edge; on close, slide out to it. Its controls take clicks and keys from the first frame. | REQ-5, REQ-6, REQ-26, REQ-27 | — |
| INT-2 | modify | `src/web/sessions/SessionView.tsx` | Mount the panel through the exit presence. The terminal fits its new size and sends one `resize` when the slide ends, not at each frame. | REQ-6, REQ-28 | INT-1 |
| INT-3 | modify | `src/web/external/ConversationView.tsx` | Mount the panel through the exit presence, so its close plays the slide out. | REQ-6 | INT-1 |

Notes:

- A second click on "Git Explorer" during the slide reverses it, and the panel ends in the state of the last click.
- The panel is closed when a session view opens. So no panel is open when the app starts, and no slide plays then (REQ-29).

## Human acceptance

### Scenario: the Git Explorer slides in and out

- REQ → REQ-5, REQ-6
- Given → an open session whose folder is a git repository
- When → the user clicks "Git Explorer", then clicks it again
- Then → the panel slides in from the right, then slides out to the right; the terminal keeps its text and fits the new width when each slide ends

### Scenario: a click during the slide wins

- REQ → REQ-26, REQ-28
- Given → an open session whose folder is a git repository, with the panel closed
- When → the user clicks "Git Explorer" twice in quick succession
- Then → the panel ends closed, and the terminal shows its full width

### Scenario: no slide when the app starts

- REQ → REQ-29
- Given → the app is closed
- When → the user starts the app and opens a session
- Then → no Git Explorer panel slides in until the user clicks "Git Explorer"

---
batch: session-actions
feature: Session action shortcuts
closed_req: [REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21]
depends: [navigation]
---

# Batch session-actions — Session action shortcuts

The requirements are in `.sdd/plans/plan-keyboard_shortcuts/requirements.md`. Read the assumptions "Key map", "Resume key", "Stop and rename" and "Text fields".

Batch `navigation` built the shortcut map and the key handler. Their paths are in `.sdd/modules/app/index.md`. Every key this batch adds must follow the rules REQ-34 to REQ-46. They close in batch `shortcuts-panel`.

## What this batch builds

- **Command channel** → lets a component that owns an action receive its shortcut command while it is on the page. Stop, dismiss, resume and rename stay in the components that run them today, so they keep their confirmations, warnings and errors.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, module app, beside the key handler | Command channel: a component subscribes to a command while it is mounted, and the key handler sends the command to it. A command with no subscriber does nothing. | REQ-14, REQ-16, REQ-17, REQ-18, REQ-19, REQ-43 | — |
| INT-2 | modify | the shortcut map of batch `navigation` (path in `.sdd/modules/app/index.md`) | Adds the six Sessions rows and the Light/Dark theme row (General) of the "Key map" assumption. | REQ-12, REQ-13, REQ-14, REQ-16, REQ-17, REQ-18, REQ-19, REQ-21, REQ-34, REQ-35, REQ-36, REQ-37, REQ-39, REQ-45 | — |
| INT-3 | modify | `src/web/AppLayout.tsx` | New session → opens FolderChooser. Resume history → opens ResumeDialog. Theme → `pageThemeStore().toggle()`. Each acts as its button does. The other session commands go to the channel. | REQ-12, REQ-13, REQ-21 | INT-1, INT-2 |
| INT-4 | modify | `src/web/sessions/StopSessionButton.tsx` | Subscribes to "stop". It acts as a press of "Terminate", with the confirmation for a working session. It does nothing while a stop runs. | REQ-14, REQ-15, REQ-43 | INT-1 |
| INT-5 | modify | `src/web/sessions/EndedEntryActions.tsx` | When its session is the open one, it subscribes to "dismiss", and to "resume" only when `resumable`. Each acts as a press of its button, with the warning and the errors. | REQ-17, REQ-18, REQ-43 | INT-1 |
| INT-6 | modify | `src/web/sessions/SessionList.tsx` | Tells EndedEntryActions whether its session is open. Subscribes to "rename": opens the name editor of the open session's entry, scrolled into view, with the focus in the field. | REQ-16, REQ-17, REQ-18 | INT-1, INT-5 |
| INT-7 | modify | `src/web/external/ResumeHereButton.tsx` | Subscribes to "resume". It acts as a click, so the running-elsewhere warning shows first. It does nothing while a request runs. | REQ-19, REQ-20 | INT-1 |

Notes:

- Alt+R sends "resume". EndedEntryActions subscribes only on an open ended hosted session, and ResumeHereButton shows only on an open external session. So at most one subscriber exists.
- Stop has no subscriber with no open session, on an external session and on an ended session: StopSessionButton shows nothing there. That is REQ-43.
- Dismissing the open session already returns the main area to its empty state (AppLayout). A resume already opens the new session. This batch does not change those paths.
- The confirmation, the warning and the name editor are dialogs or fields. While a dialog is open the key handler runs no command (REQ-42).

## Human acceptance

### Scenario: The user stops a working session from the keyboard, after the confirmation

- REQ → REQ-14, REQ-15
- Given → an open hosted session is working, and its terminal has the focus
- When → the user presses Alt+Shift+Q
- Then → the dialog "Terminate the Session?" shows, with "Cancel" focused
- And → "Terminate" in the dialog ends the session

### Scenario: The user resumes an ended session from the keyboard

- REQ → REQ-18
- Given → the open session is an ended hosted session with a saved conversation
- When → the user presses Alt+R
- Then → a new hosted session of that conversation is open, and the ended entry is no longer in the list

### Scenario: The user dismisses an ended session from the keyboard

- REQ → REQ-17
- Given → the open session is an ended hosted session
- When → the user presses Alt+Shift+W
- Then → the entry leaves the list at once, and the main area shows no open session

### Scenario: "Resume Here" by shortcut keeps its warning

- REQ → REQ-19, REQ-20
- Given → the open session is an external session
- When → the user presses Alt+R
- Then → the running-elsewhere warning shows, and nothing resumes before "Resume Anyway"

### Scenario: The user opens the session dialogs from the keyboard

- REQ → REQ-12, REQ-13
- Given → no dialog is open
- When → the user presses Alt+N
- Then → the new-session dialog opens
- And → after Esc, Alt+H opens the resume history dialog

### Scenario: The user renames the open session from the keyboard

- REQ → REQ-16
- Given → a session is open and its terminal has the focus
- When → the user presses Alt+E
- Then → the "Session Name" field shows in the entry of the open session, with the focus in it

### Scenario: The user switches the theme from the keyboard

- REQ → REQ-21
- Given → the client shows the dark theme
- When → the user presses Alt+A
- Then → the client shows the light theme, and the Light/Dark switch shows the sun

### Scenario: A shortcut that does not apply does nothing

- REQ → REQ-43
- Given → no session is open
- When → the user presses Alt+Shift+Q
- Then → nothing changes on the screen

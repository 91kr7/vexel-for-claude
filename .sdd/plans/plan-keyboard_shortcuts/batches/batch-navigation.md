---
batch: navigation
feature: Navigation shortcuts
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11]
depends: []
---

# Batch navigation — Navigation shortcuts

The requirements are in `.sdd/plans/plan-keyboard_shortcuts/requirements.md`. Read the assumptions "Key map", "Keys matched by position", "Browser default actions", "Previous and next", "Needs input", "Short message", "Positions" and "Text fields".

This batch also builds the key handling that the next two batches reuse. The rules REQ-34 to REQ-46 apply to every key it adds. They close in batch `shortcuts-panel`, which adds the last key.

## What this batch builds

- **Shortcut map** → the one list of the client shortcuts: keys, area, action text and command. The key handler and, later, the shortcuts panel both read it, so the panel cannot drift from the real keys.
- **Key handler** → the page-level listener that turns a key of the map into its command.
- **Navigation targets** → the function that picks the session to open for previous, next, position 1 to 9 and next needs input.
- **Short-message toast** → a small status box that shows one text for a few seconds.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | frontend, module app, beside AppLayout | Shortcut map: each entry has its physical key (`KeyboardEvent.code`), its modifiers, its area, its action text in English and its command. This batch adds the five navigation rows of the "Key map" assumption. | REQ-1, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-34, REQ-35, REQ-36, REQ-37, REQ-39, REQ-45 | — |
| INT-2 | create | frontend, module app, beside AppLayout | Key handler: one `keydown` listener on the window, in the capture phase. A key of the map, with exactly its modifiers and no AltGr, runs its command, cancels the browser default and stops the event. Every other key passes untouched. | REQ-38, REQ-39, REQ-41, REQ-45, REQ-46 | INT-1 |
| INT-3 | create | frontend, module app, beside AppLayout | Key handler, dialog rule: while an `aria-modal` dialog is on the page, it runs no command and leaves the key to the dialog. | REQ-42 | INT-2 |
| INT-4 | create | frontend, module sessions, beside `session-order.ts` | Navigation targets: from the list order (the groups of `groupSessions` with the saved order, top to bottom), the open session and a command, give the session to open, or none. Previous and next stop at the ends. Needs input starts after the open session and wraps. | REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-43 | — |
| INT-5 | create | frontend, module app | Short-message toast: a `role="status"` glass box at the bottom centre of the window, below the dialogs. It shows one text for 4 s. A new text replaces it and starts the 4 s again. | REQ-9 | — |
| INT-6 | modify | `src/web/AppLayout.tsx` | Mounts the key handler. "Focus the list" uses the focus rule of Ctrl+Shift+L. "Focus the main view" focuses the terminal or the conversation of the open session, and does nothing with no open session. | REQ-1, REQ-3, REQ-43 | INT-2, INT-9, INT-10 |
| INT-7 | modify | `src/web/AppLayout.tsx` | The open commands ask INT-4 for a target, then use the same open path as a click on the entry. No target → nothing happens, except for "next needs input", which shows the toast "No session needs input". | REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-43 | INT-4, INT-5, INT-6 |
| INT-8 | modify | `src/web/sessions/SessionView.tsx` | In the terminal, a key of the shortcut map is not processed and nothing goes to the pty. Ctrl+Shift+L, Ctrl+Shift+F and the zoom keys keep their behaviour. | REQ-2, REQ-39, REQ-40, REQ-44 | INT-1 |
| INT-9 | modify | `src/web/sessions/SessionView.tsx` | Lets AppLayout put the keyboard focus in the terminal. | REQ-3 | — |
| INT-10 | modify | `src/web/external/ConversationView.tsx` | Its message area can take the keyboard focus from AppLayout, and then shows the focus ring. | REQ-3 | — |

Notes:

- The map holds commands, not actions. AppLayout owns the open session, so it runs the navigation commands. Batch `session-actions` adds a channel for the commands that other components own.
- Keys by physical position: Alt+1 is `Digit1` and Alt+L is `KeyL` on the Italian and on the US layout. The handler ignores an event with AltGr (`getModifierState('AltGraph')`).
- Cancel the browser default of every key the handler takes. Then Chromium's Alt+1 … Alt+8 (tab switch on Linux) and its Alt+E menu do not fire.
- Focus after an open by shortcut → see `batches.md`, decision "Focus after an open by shortcut".
- The unit tests of the map check each row against the rules: Ctrl or Alt present, no letter of the "Key map" exclusion list, no key named in the spec "Constraints".

## Human acceptance

### Scenario: The user opens the next session from the terminal

- REQ → REQ-5, REQ-10, REQ-11
- Given → three hosted sessions are in the list, the second one is open, and its terminal has the focus
- When → the user presses Alt+Down
- Then → within a second the third session is open and its entry is highlighted in the list, as after a click
- And → back on the second session, its prompt shows no character typed by the shortcut

### Scenario: The user jumps to a session by its position

- REQ → REQ-4, REQ-6
- Given → three sessions are in the list and the third one is open
- When → the user presses Alt+1
- Then → the first session of the list is open
- And → Alt+Up opens nothing, because the first session is at the top of the list

### Scenario: The user moves the focus between the list and the session

- REQ → REQ-1, REQ-3
- Given → a hosted session is open and its terminal has the focus
- When → the user presses Alt+L
- Then → the entry of the open session shows the focus ring
- And → Alt+C puts the focus back in the terminal, and typed text reaches Claude Code

### Scenario: The existing key still leaves the terminal

- REQ → REQ-2
- Given → a hosted session is open and its terminal has the focus
- When → the user presses Ctrl+Shift+L
- Then → the entry of the open session shows the focus ring, as before this plan

### Scenario: The user goes through the sessions that need input

- REQ → REQ-7, REQ-8
- Given → the sessions at positions 1 and 3 need input, and the session at position 2 is open
- When → the user presses Alt+I
- Then → the session at position 3 is open
- And → a second Alt+I opens the session at position 1

### Scenario: No session needs input

- REQ → REQ-9
- Given → no session needs input
- When → the user presses Alt+I
- Then → the open session does not change, and the message "No session needs input" shows for a few seconds

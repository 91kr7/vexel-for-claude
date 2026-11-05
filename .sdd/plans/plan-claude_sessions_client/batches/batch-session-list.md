---
batch: session-list
feature: Session list
closed_req: [REQ-11, REQ-12, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22]
depends: [session-interaction]
---

# Batch — Session list

REQ-13 (label) starts here and closes in batch `resume-session`, which adds the label of resumed sessions.

## What this batch builds

- **Hooks settings file** (backend) → a Claude Code settings file with hooks only. The hooks report each session event to the client.
- **Hook route** (backend) → receives the hook events.
- **State tracker** (backend) → state, label and last activity of each hosted session.
- **List route** (backend) → the hosted sessions with their data.
- **Event channel** (backend, WebSocket) → pushes every change of the list to the page.
- **List ordering** (frontend) → the order of the entries.
- **Live session store** (frontend) → the list in the page, kept current.
- **Session list panel** (frontend) → the list on the page.
- **Needs-input counter** (frontend) → the number of sessions in "needs input", in the header.

## Decisions for this batch

- State names in the GUI → working "In lavorazione", needs input "Richiede input", idle "In attesa", ended "Terminata".
- Event → state:
  - `UserPromptSubmit`, `PreToolUse` (any tool except `AskUserQuestion`), `PostToolUse` → working.
  - `PermissionRequest`, `Notification` of type `permission_prompt` or `elicitation_dialog`, `PreToolUse` of `AskUserQuestion` → needs input.
  - `Stop`, `Notification` of type `idle_prompt` → idle.
  - Process exit → ended. A new session starts in idle.
- Claude Code fires no hook on an interrupt. So an Esc or Ctrl+C typed while working or needs input sets idle. Esc means the byte `\x1b` alone, not the start of an arrow-key sequence.
- `idle_prompt` is a safety net: it corrects a session left in working when a turn ends without `Stop`.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Hooks settings file: at server start, write a settings file that contains only the hooks of the events above. Write it outside every project and outside `~/.claude`. Each hook posts its JSON input to the hook route of the running server. | REQ-14 | — |
| INT-2 | modify | session registry created by `batch-session-interaction/INT-1` | Start the CLI with `--settings` pointing to the INT-1 file. Put the client session id in the process environment, so each hook names its session. | REQ-14 | INT-1 |
| INT-3 | create | backend, sessions area | State tracker: applies the event → state table above to each hosted session. It sets ended when the process exits. It notifies a change to its listeners. | REQ-14 | — |
| INT-4 | create | backend, sessions area | Hook route: receives a hook event, finds the session by the client session id and passes the event to INT-3. | REQ-14 | INT-3 |
| INT-5 | modify | attach route created by `batch-session-interaction/INT-5` | Pass the user's input to INT-3. Esc or Ctrl+C alone sets idle, as decided above. | REQ-14 | INT-3 |
| INT-6 | create | backend, sessions area | The state tracker (INT-3) also keeps the label and the last activity. The label is the first 80 characters of the first `UserPromptSubmit` prompt, and the folder name until then. Last activity is the time of the latest event or user input. | REQ-12 | INT-3 |
| INT-7 | create | backend, sessions area | List route: returns the hosted sessions with id, folder, label, state and last activity. Ended sessions stay in it until the server stops. | REQ-11, REQ-12, REQ-20 | INT-6 |
| INT-8 | create | backend, sessions area | Event channel (WebSocket): pushes each change of INT-3 to every connected page. It covers new sessions too. | REQ-15 | INT-3 |
| INT-9 | modify | `src/server/main.ts` | Register INT-4, INT-7 and INT-8. The local-address check from batch `session-interaction` covers them too. | REQ-14, REQ-15 | INT-4, INT-7, INT-8 |
| INT-10 | create | frontend, session list area | List ordering: "needs input" first, then the most recent activity first. | REQ-16 | — |
| INT-11 | create | frontend, session list area | Live session store: loads INT-7 when the page loads, then applies the INT-8 events. | REQ-11, REQ-15, REQ-20 | — |
| INT-12 | create | frontend, session list area | Session list panel: one entry per session with folder, label, state name and last activity. Entries are in the INT-10 order, "Richiede input" entries are highlighted, and the list scrolls to show all of them. | REQ-11, REQ-12, REQ-16, REQ-22 | INT-10, INT-11 |
| INT-13 | create | frontend, session list area | Needs-input counter in the header: the number of sessions in "needs input", always visible. | REQ-17 | INT-11 |
| INT-14 | modify | page layout created by `batch-session-interaction/INT-10` | Place the list panel beside the open-session area and the counter in the header. A click on an entry opens that session in the session view. | REQ-17, REQ-18, REQ-19 | INT-12, INT-13 |
| INT-15 | modify | session view created by `batch-session-interaction/INT-9` | On a switch, close the previous attach. Clear the terminal, write the snapshot of the new session, then its live output, and fit the size. | REQ-18, REQ-19, REQ-21, REQ-22 | — |

## Human acceptance

### Scenario: The user sees which session needs input

- REQ → REQ-11, REQ-12, REQ-13, REQ-14, REQ-16, REQ-17
- Given → three hosted sessions: one working, one idle, one waiting for a permission answer
- When → the user opens the page
- Then → the list shows the three sessions with folder, label, state and last activity, and the "Richiede input" one is first and highlighted
- And → the counter shows 1

### Scenario: The list follows the state without a reload

- REQ → REQ-14, REQ-15
- Given → the list shows a session "In attesa"
- When → the user sends a message to that session
- Then → its entry goes to "In lavorazione" and then back to "In attesa" when Claude ends the turn, without a reload

### Scenario: The user switches between sessions

- REQ → REQ-17, REQ-18, REQ-19, REQ-21
- Given → session A is open with Claude working, and session B waits for a permission answer
- When → the user clicks the entry of session B
- Then → B opens with its full conversation within one second, and the counter is still visible
- And → back on A, Claude's turn has gone on

### Scenario: Sessions survive a page reload

- REQ → REQ-20
- Given → a session is working
- When → the user reloads the page
- Then → the list shows the session still working, and opening it shows its conversation

### Scenario: Ten sessions at once

- REQ → REQ-22, REQ-21
- Given → 10 sessions are active
- When → the user switches from one session to another
- Then → the list shows all 10 sessions, and the conversation appears within one second

### Scenario: An ended session stays in the list

- REQ → REQ-14
- Given → an open session
- When → the user types `/exit`
- Then → its entry shows "Terminata" and stays in the list

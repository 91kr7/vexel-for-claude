---
batch: session-interaction
feature: Session interaction
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10]
depends: []
---

# Batch — Session interaction

## What this batch builds

- **Session registry** (backend) → starts the Claude Code CLI in a pty and keeps every session the client hosts.
- **Terminal mirror** (backend) → a headless terminal per session, so a page that attaches gets the current screen and scrollback.
- **Start route** (backend) → starts a session in a folder.
- **Attach route** (backend, WebSocket) → connects the page to the pty of a session.
- **Folder route** (backend) → lists subfolders for the folder chooser.
- **Page layout** (frontend) → header and open-session area. Later batches add to it.
- **Folder chooser** (frontend) → picks the project folder of a new session.
- **Session view** (frontend) → xterm.js terminal of the open session.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, sessions area | Session registry: spawns the Claude Code CLI in a node-pty with the chosen folder as cwd, with no permission flag and no extra settings. It keeps each session by id. A viewer that disconnects never stops the process. | REQ-1, REQ-6, REQ-7, REQ-10 | — |
| INT-2 | create | backend, sessions area | The registry reads the CLI executable from an environment variable, default `claude`. The tests use this variable to start a fake CLI. | — (enabling) | INT-1 |
| INT-3 | create | backend, sessions area | Terminal mirror: one headless xterm per session that receives all pty output. It gives a serialized snapshot of screen and scrollback (10 000 lines). | REQ-1, REQ-4 | INT-1 |
| INT-4 | create | backend, sessions area | Start route: takes an absolute folder path. It rejects a folder that does not exist, starts the session through INT-1 and returns its id. | REQ-1 | INT-1 |
| INT-5 | create | backend, sessions area | Attach route (WebSocket): sends the INT-3 snapshot, then the live output. It forwards the user's keystrokes and terminal size to the pty. Nothing else writes to the pty. | REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-8 | INT-1, INT-3 |
| INT-6 | create | backend, folders area | Folder route: lists the subfolders of an absolute path. The default path is the user's home. | REQ-1 | — |
| INT-7 | modify | `src/server/main.ts` | Register INT-4, INT-5 and INT-6. Reject HTTP and WebSocket requests whose `Host` or `Origin` is not `localhost` or `127.0.0.1`. Keep the `127.0.0.1` binding. | REQ-9 | INT-4, INT-5, INT-6 |
| INT-8 | create | frontend, folders area | Folder chooser: browse with INT-6 or type a path. Confirm calls INT-4 and opens the new session. A rejected folder shows an error in Italian. | REQ-1 | INT-6 |
| INT-9 | create | frontend, session area | Session view: xterm.js terminal fitted to its container and attached to INT-5. Every key goes to the pty, Esc included. A button "Interrompi" sends Esc. | REQ-2, REQ-3, REQ-4, REQ-5, REQ-8 | INT-5 |
| INT-10 | create | frontend, app shell | Page layout: a header with the action "Nuova sessione" (opens INT-8) and the open-session area (INT-9). | REQ-1 | INT-8, INT-9 |
| INT-11 | modify | `src/web/main.tsx` | Render the INT-10 layout in place of the placeholder title. | REQ-1 | INT-10 |
| INT-12 | modify | `src/web/index.html` | Set `lang="it"` and an Italian page title. | — (enabling) | — |

## Human acceptance

### Scenario: The user starts a session in a project folder

- REQ → REQ-1
- Given → the client runs and hosts no session
- When → the user clicks "Nuova sessione", chooses a project folder and confirms
- Then → the session opens in the page with the Claude Code prompt of that folder

### Scenario: The user works with Claude and answers a permission request

- REQ → REQ-2, REQ-4, REQ-5, REQ-6
- Given → an open session in a project with no permission rule for file edits
- When → the user sends "crea un file prova.txt"
- Then → the response appears while Claude produces it, with the file-edit tool call
- And → Claude waits on the permission request until the user answers it in the page

### Scenario: The user runs a slash command

- REQ → REQ-3
- Given → an open session
- When → the user types `/help` and presses Enter
- Then → the Claude Code help appears, as in the terminal

### Scenario: The project permission rules apply

- REQ → REQ-7
- Given → a project whose Claude Code settings allow `Bash(ls:*)`
- When → the user asks Claude to list the files of the folder with `ls`
- Then → the command runs without a permission request

### Scenario: The user interrupts a turn

- REQ → REQ-8
- Given → Claude is producing a long answer in the open session
- When → the user clicks "Interrompi"
- Then → Claude stops the turn and waits for the next message

### Scenario: The client is not reachable from another machine

- REQ → REQ-9
- Given → the client runs
- When → a user on another machine of the network opens the client address
- Then → the page does not load

### Scenario: A client session continues in the terminal

- REQ → REQ-10
- Given → a session started from the client, with one message exchanged, then closed with `/exit`
- When → the user runs `claude --resume` in a terminal in the same folder
- Then → the session is in the Claude Code list and continues with its conversation

### Scenario: The chosen folder does not exist

- REQ → REQ-1
- Given → the folder chooser is open
- When → the user types a path that does not exist and confirms
- Then → the chooser shows an error and no session starts

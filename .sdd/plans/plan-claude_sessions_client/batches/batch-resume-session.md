---
batch: resume-session
feature: Resume a past session
closed_req: [REQ-13, REQ-25, REQ-26, REQ-27, REQ-28]
depends: [session-list]
---

# Batch — Resume a past session

REQ-13 (label) starts in batch `session-list` and closes here, with the label of resumed sessions.

## What this batch builds

- **History reader** (backend) → reads the past Claude Code sessions of the machine. It never writes.
- **External-terminal check** (backend) → tells if a past session still runs in a terminal.
- **Past sessions route** (backend) → the past sessions grouped by project folder.
- **Resume route** (backend) → resumes a past session in the client.
- **Resume dialog** (frontend) → choice of the session to resume, with the warning.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, history area | History reader: lists the session files under `~/.claude/projects`. For each one it gives the session id, the project folder (`cwd` of the entries), the first user message and the time of the last change. It opens files read-only. | REQ-25, REQ-26, REQ-28 | — |
| INT-2 | create | backend, history area | External-terminal check: a session runs elsewhere when its `sessionId` is in a `~/.claude/sessions/<digits>.json` file of a live pid (`/proc/<pid>` exists) that the client does not host. It never reads the `<pid>.<hash>.key` files in that folder, because they hold credentials. | REQ-27 | — |
| INT-3 | modify | state tracker created by `batch-session-list/INT-3` | Keep the Claude Code session id of each hosted session, taken from the `session_id` field of its hook events. | REQ-25 | — |
| INT-4 | create | backend, history area | Past sessions route: past sessions grouped by folder, the most recent first. Each has label, date and the INT-2 flag. It leaves out sessions the client hosts and that have not ended (INT-3). | REQ-25, REQ-26, REQ-27 | INT-1, INT-2, INT-3 |
| INT-5 | modify | session registry created by `batch-session-interaction/INT-1` | Start a session with `--resume <id>` in its project folder. The new session has the same data as the other hosted sessions. | REQ-25, REQ-26 | — |
| INT-6 | modify | state tracker created by `batch-session-list/INT-3` | A resumed session takes as label the first 80 characters of the first user message from INT-1, instead of the folder name. | REQ-13 | INT-1 |
| INT-7 | create | backend, history area | Resume route: checks that the id is in INT-1, starts the session through INT-5 and returns the client session id. | REQ-25, REQ-26 | INT-1, INT-5 |
| INT-8 | modify | `src/server/main.ts` | Register INT-4 and INT-7. | REQ-25 | INT-4, INT-7 |
| INT-9 | create | frontend, resume area | Resume dialog, opened by an action "Riprendi sessione" in the header of the page layout. It shows INT-4 grouped by folder. A choice calls INT-7 and opens the session. | REQ-25, REQ-26 | INT-4, INT-7 |
| INT-10 | create | frontend, resume area | Warning in the resume dialog (INT-9): when the chosen session runs elsewhere, show a warning about the risk to the conversation. Resume only on "Riprendi comunque". | REQ-27 | INT-9 |

## Human acceptance

### Scenario: The user resumes a session started in the terminal

- REQ → REQ-13, REQ-25, REQ-26
- Given → a Claude Code session started and closed in a terminal, in a project folder
- When → the user clicks "Riprendi sessione" and chooses that session under its folder
- Then → the session opens with its previous conversation
- And → its list entry shows as label the start of its first user message

### Scenario: The session still runs in a terminal

- REQ → REQ-27
- Given → a Claude Code session still runs in a terminal
- When → the user chooses that session in the resume dialog
- Then → the page shows a warning and resumes the session only after "Riprendi comunque"

### Scenario: The history stays intact for the terminal

- REQ → REQ-28
- Given → a session resumed in the client, with one new message exchanged, then stopped
- When → the user runs `claude --resume` on that session in a terminal
- Then → the terminal shows the earlier conversation and the new message, with nothing missing or changed

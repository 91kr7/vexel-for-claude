---
batch: external-sessions
feature: External sessions
closed_req: [REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36]
depends: [resume-session]
---

# Batch — External sessions

## What this batch builds

- **External session scanner** (backend) → finds the Claude Code sessions that run in other terminals.
- **Transcript reader** (backend) → turns the transcript of a session into read-only text items.
- **Conversation stream route** (backend, WebSocket) → sends those items to the page, live.
- **Read-only conversation view** (frontend) → shows the conversation of an external session.
- **"Riprendi qui" action** (frontend) → resumes an external session in the client.

## Decisions for this batch

- **Sources.** The client reads only two kinds of file, both read-only:
  - `~/.claude/sessions/<pid>.json` → `pid`, `sessionId`, `cwd`, `kind`, `status`, `updatedAt`.
  - The transcript `~/.claude/projects/<cwd with "/" replaced by "-">/<sessionId>.jsonl`.
  These files are internal to Claude Code and not documented. A new Claude Code version can break this batch.
- **Never read the `<pid>.<hash>.key` files** in `~/.claude/sessions/`. They hold peer tokens, which are credentials. The scanner lists only names that match `<digits>.json`.
- **State** (human decision, 2026-11-05) → `busy` gives "In lavorazione" and `idle` gives "In attesa". "Richiede input" does not exist for an external session. A session that waits for a permission answer reports `busy`, so it shows "In lavorazione". The client adds no hook to the user's `~/.claude/settings.json`. The needs-input counter and the "needs input first" order count only hosted sessions.
- **External marker** → "Esterna". Its tooltip says: "Sessione in un altro terminale: lo stato «Richiede input» non è disponibile".
- **Which processes count** (gatekeeper decision) → only `kind: interactive`, with a live pid (`/proc/<pid>` exists), and not a process the client hosts.
- **End of an external session** (gatekeeper decision) → its entry leaves the list. It stays resumable from the past-sessions list.
- **Read-only view** (gatekeeper decision) → it shows these items:
  - user messages;
  - Claude's text replies;
  - each tool call, by name, with a one-line summary of its input;
  - each tool result, cut to its first 5 lines.
- **Polling** → the scanner reads `~/.claude/sessions/` every 2 seconds. The stream route checks the transcript size every second and reads only the new lines.

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | create | backend, external area | External session scanner: every 2 seconds, reads the `<digits>.json` files of `~/.claude/sessions/`. It keeps the processes that the decisions above count. It notifies when an entry is added, changed or removed. | REQ-29, REQ-32, REQ-36 | INT-2 |
| INT-2 | modify | session registry created by `batch-session-interaction/INT-1` | Give the pids of the hosted processes, so INT-1 can leave them out. | REQ-29 | — |
| INT-3 | create | backend, external area | External entry data: folder from `cwd`, state from `status`, last activity from `updatedAt`. The label is the first 80 characters of the first user message, read with the history reader of `batch-resume-session/INT-1`. Until the first message, the label is the folder name. | REQ-30, REQ-31 | INT-1 |
| INT-4 | modify | list route created by `batch-session-list/INT-7` | Add the external entries, marked as external, with the INT-3 data. | REQ-29, REQ-30 | INT-3 |
| INT-5 | modify | event channel created by `batch-session-list/INT-8` | Push the additions, changes and removals of external entries notified by INT-1. | REQ-32 | INT-1 |
| INT-6 | create | backend, external area | Transcript reader: finds the transcript from `cwd` and `sessionId`. It opens the file read-only and turns its lines into the items of the read-only view. | REQ-33, REQ-36 | — |
| INT-7 | create | backend, external area | Conversation stream route (WebSocket): sends all the INT-6 items of the session, then each new item as Claude Code appends lines to the transcript. | REQ-33, REQ-34 | INT-6 |
| INT-8 | modify | `src/server/main.ts` | Register INT-7. The local-address check covers it too. | REQ-33 | INT-7 |
| INT-9 | modify | live session store created by `batch-session-list/INT-11` | Keep the external entries from the list route and the events, removals included. | REQ-29, REQ-32 | INT-4, INT-5 |
| INT-10 | modify | session list panel created by `batch-session-list/INT-12` | Show the external entries with the "Esterna" marker and its tooltip. | REQ-29, REQ-30 | INT-9 |
| INT-11 | create | frontend, external area | Read-only conversation view: shows the INT-7 items, adds new ones live and scrolls to the latest. It has no input field and sends nothing to the session. | REQ-33, REQ-34, REQ-36 | INT-7 |
| INT-12 | modify | page layout created by `batch-session-interaction/INT-10` | A click on an external entry opens INT-11 in the open-session area, in place of the terminal view. | REQ-33 | INT-11 |
| INT-13 | create | frontend, external area | "Riprendi qui" action in INT-11. It shows the warning of `batch-resume-session/INT-10`, then calls the resume route of `batch-resume-session/INT-7` with the `sessionId`. Then it opens the hosted session. | REQ-35 | INT-11 |

## Human acceptance

### Scenario: The user sees a session that runs in another terminal

- REQ → REQ-29, REQ-30, REQ-31
- Given → a Claude Code session runs in a terminal and has received one message
- When → the user opens the page
- Then → the list shows the session with the "Esterna" marker, its folder, the start of its first message, its state and its last activity
- And → the marker says that the session has no "Richiede input" state

### Scenario: The external state follows the terminal

- REQ → REQ-31, REQ-32
- Given → the list shows an external session "In attesa"
- When → the user sends a message to that session in its terminal
- Then → the entry goes to "In lavorazione" and back to "In attesa" when Claude ends the turn, without a reload

### Scenario: A waiting external session shows as working

- REQ → REQ-31
- Given → an external session waits for a permission answer in its terminal
- When → the user looks at the list
- Then → the entry shows "In lavorazione", and the needs-input counter does not count it

### Scenario: An external session leaves the list when it ends

- REQ → REQ-32
- Given → the list shows an external session
- When → the user types `/exit` in that terminal
- Then → the entry leaves the list without a reload

### Scenario: The user follows an external session

- REQ → REQ-33, REQ-34, REQ-36
- Given → the list shows an external session
- When → the user clicks its entry
- Then → the page shows its conversation as text, with no input field
- And → while Claude works in the terminal, the new messages and tool calls appear in the page

### Scenario: The user takes over an external session

- REQ → REQ-35
- Given → an external session is open in the read-only view
- When → the user clicks "Riprendi qui"
- Then → the page shows the warning, and after "Riprendi comunque" the session opens in the client terminal with its conversation

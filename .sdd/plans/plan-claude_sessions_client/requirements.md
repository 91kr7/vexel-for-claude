---
slug: claude_sessions_client
date: 2026-11-09
spec: .sdd/analysis/claude_sessions_client.md
status: validated
---

# Requirements — Client for active Claude sessions

## Feature: Session interaction

Start a session from the page and work with it as in the terminal.

| ID | Requirement |
|----|-------------|
| REQ-1 | The user can start a new session by choosing a project folder, and the new session opens in the page. |
| REQ-2 | The user can send a message to the open session. |
| REQ-3 | The user can use the Claude Code slash commands in the open session as in the terminal. |
| REQ-4 | Claude's response appears progressively while it is produced, including the tool calls it runs. |
| REQ-5 | The user can answer from the page a permission request or a question that Claude asks. |
| REQ-6 | The client never answers a permission request on the user's behalf. |
| REQ-7 | The Claude Code permission rules and settings of the session's project apply as they do in the terminal. |
| REQ-8 | The user can interrupt the current turn of the open session. |
| REQ-9 | By default the client is reachable only from the local machine. |
| REQ-10 | A session started from the client can be resumed from the terminal with the standard Claude Code commands. |

## Feature: Session list

One list of the sessions hosted by the client, with their state, to reach the session that needs attention.

| ID | Requirement |
|----|-------------|
| REQ-11 | The page shows every session hosted by the client in one list. |
| REQ-12 | Each list entry shows the project folder, a session label, the current state and the time of the last activity. |
| REQ-13 | The label of a session is by default the start of the first user message in the session. |
| REQ-14 | The state of a session is "working" while Claude produces a turn, "needs input" while Claude waits for a permission answer or an answer to a question, "idle" when the turn ended and Claude waits for the next message, and "ended" when the session has stopped. |
| REQ-15 | The list updates by itself when a state changes, without a manual reload. |
| REQ-16 | Sessions in "needs input" stand out visually and appear before the other sessions in the list. |
| REQ-17 | The page shows how many sessions need input, also while a session is open. |
| REQ-18 | A click on a list entry opens the session in the same page, with the full conversation so far. |
| REQ-19 | The user can switch to another session at any time without losing the state of the first one. |
| REQ-20 | Sessions keep running when the page is closed or reloaded. |
| REQ-21 | Opening a session or switching between sessions shows its conversation within one second. |
| REQ-22 | With 10 sessions active at the same time, the list shows all of them and REQ-21 still holds. |

## Feature: Stop a session

| ID | Requirement |
|----|-------------|
| REQ-23 | The user can stop a session hosted by the client. |
| REQ-24 | When the session is "working", the client asks the user for confirmation before it stops the session. |

## Feature: Resume a past session

| ID | Requirement |
|----|-------------|
| REQ-25 | The user can resume a past Claude Code session of the machine, chosen from a list grouped by project folder. |
| REQ-26 | A session started from the terminal can be resumed from the client. |
| REQ-27 | Before it resumes a session that still runs in an external terminal, the client warns the user. |
| REQ-28 | The client does not change the content of the Claude Code session history beyond what Claude Code itself writes. |

## Feature: External sessions

The Claude Code sessions that run in other terminals of the same machine, seen from the client.

| ID | Requirement |
|----|-------------|
| REQ-29 | The list also shows the Claude Code sessions that run in other terminals of the same machine, marked as external. |
| REQ-30 | An external entry shows the project folder, a label, the state and the time of the last activity, and its label is by default the start of the first user message. |
| REQ-31 | The state of an external session is "working" while Claude Code reports it busy, and "idle" while Claude Code reports it idle. |
| REQ-32 | External sessions enter the list, change state and leave the list by themselves, without a manual reload. |
| REQ-33 | A click on an external session shows its conversation read-only, as text. |
| REQ-34 | The conversation of an open external session updates live while the session runs. |
| REQ-35 | An external session offers a "Riprendi qui" action that resumes it in the client, with the warning of REQ-27. |
| REQ-36 | The client writes nothing to an external session. |

## Feature: Local access

Fix of 2026-11-06. Only pages served by the client itself can drive the sessions from a browser.

| ID | Requirement |
|----|-------------|
| REQ-37 | The client accepts a browser request whose Origin is its own origin: `http://localhost` or `http://127.0.0.1` on the port where the client listens. |
| REQ-38 | In development only, the client also accepts the Origin of the Vite dev server. |
| REQ-39 | The client rejects a loopback Origin on any other port, for example `http://localhost:8080`. |
| REQ-40 | The client rejects an Origin whose host is not loopback, also on the client's port. |
| REQ-41 | The client rejects the Origin `null` and a malformed Origin. |
| REQ-42 | The client accepts a request without an Origin, as before the fix. |
| REQ-43 | A rejected connection receives no session data and writes nothing to any session terminal. |
| REQ-44 | The Origin rule applies to every request that the access check covers before the fix, HTTP requests included. |
| REQ-45 | The page opened on the client's port, the desktop app and the hook forwarder work as before the fix. |

## Feature: Backend reconnection

Fix of 2026-11-09. The page recovers by itself when the backend comes back after a disconnection.

| ID | Requirement |
|----|-------------|
| REQ-46 | While the backend is unreachable, the client keeps trying to reconnect by itself. |
| REQ-47 | The backend-disconnected error disappears within 5 seconds of the backend being reachable again, without a manual reload. |
| REQ-48 | After the reconnection, the session list, the states and the needs-input count show the current data of the backend. |
| REQ-49 | After the reconnection, the open hosted session reconnects and accepts input again. |
| REQ-50 | After the reconnection, the open external session shows its conversation updated live again. |
| REQ-51 | When the open session ended while the backend was unreachable, the page shows it as ended. |
| REQ-52 | The error appears again at every new disconnection and disappears again at every return of the backend. |
| REQ-53 | REQ-46 to REQ-52 hold in the browser page and in the desktop window. |

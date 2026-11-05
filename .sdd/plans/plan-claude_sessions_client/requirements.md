---
slug: claude_sessions_client
date: 2026-11-05
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

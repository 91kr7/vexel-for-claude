---
slug: claude_sessions_client
date: 2026-11-05
status: validated
---

# Batches — Client for active Claude sessions

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [session-interaction](batches/batch-session-interaction.md) | Session interaction | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — | todo | The user starts a session in a project folder |
| [session-list](batches/batch-session-list.md) | Session list | REQ-11, REQ-12, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | session-interaction | todo | The user sees which session needs input |
| [stop-session](batches/batch-stop-session.md) | Stop a session | REQ-23, REQ-24 | session-list | todo | The user stops an idle session |
| [resume-session](batches/batch-resume-session.md) | Resume a past session | REQ-13, REQ-25, REQ-26, REQ-27, REQ-28 | session-list | todo | The user resumes a session started in the terminal |

Execution order: session-interaction → session-list → stop-session and resume-session. The last two are independent of each other.

## Assumptions and decisions

- **No indexes or component specs yet.** `.sdd/modules/` does not exist. The `modify` points of batch `session-interaction` come from the structure in `.sdd/.archi`. A later batch cites a component built by an earlier one by its INT id, for example `batch-session-interaction/INT-1`. Its path is in the indexes once that batch is done.
- **The page shows Claude Code's own terminal.** The client runs the interactive CLI in a node-pty and shows it with xterm.js, as `.sdd/.archi` sets. So slash commands, permission dialogs and interrupts work as in the terminal (REQ-3, REQ-5, REQ-8).
- **Terminal mirror.** The server keeps a headless xterm per session and sends a snapshot when the page attaches (REQ-18, REQ-21). New dependencies → `@xterm/headless`, `@xterm/addon-serialize`. The mirror keeps 10 000 lines of scrollback (gatekeeper decision, see below).
- **States come from Claude Code hooks.** The client passes a settings file that contains only hooks with `--settings`. It writes no file in a project or in `~/.claude` (REQ-7, REQ-28). The event → state table is in `batch-session-list.md`, "Decisions for this batch".
- **The CLI comes from `PATH`** (`claude`). An environment variable can replace it. Automated tests use this variable to run a fake CLI, because the real one needs a login and uses the plan quota.
- **GUI text in Italian**, as the spec states. This replaces the "GUI language" assumption in `.sdd/.archi`.
- **Label** → the first 80 characters of the first user message.
- **External-terminal check** → a `claude` process that the client does not host, running in the session's folder. Another session in the same folder also triggers the warning. This is acceptable for a warning.
- **The client stops → its sessions end**, as the spec assumes. The pty processes end with the server. No INT is needed.

Gatekeeper decisions taken at requirements validation. These are not human decisions.

- **Ended sessions stay in the list as "ended" until the client stops.** There is no remove action. The spec has no remove requirement, so this is the smallest scope.
- **A session with no user message yet takes the project folder name as label.** REQ-12 needs a label, and the folder name is the only one available.
- **After the "needs input" sessions, the list shows the most recent activity first.** This serves the spec's goal: reach the session that needs attention.
- **The terminal mirror keeps 10 000 lines of scrollback.** REQ-21 and REQ-22 are measured. A 50 000-line buffer per session costs tens of MB and serializes slowly. Older parts of the conversation stay in Claude Code's own history.

## Departures

None.

## Coverage check

Each INT is cited as `batch/INT-n`. The batches are abbreviated: `si` = session-interaction, `sl` = session-list, `ss` = stop-session, `rs` = resume-session.

| REQ | Served by | Closes in |
|-----|-----------|-----------|
| REQ-1 | si/INT-1, si/INT-3, si/INT-4, si/INT-6, si/INT-8, si/INT-10, si/INT-11 | session-interaction |
| REQ-2 | si/INT-5, si/INT-9 | session-interaction |
| REQ-3 | si/INT-5, si/INT-9 | session-interaction |
| REQ-4 | si/INT-3, si/INT-5, si/INT-9 | session-interaction |
| REQ-5 | si/INT-5, si/INT-9 | session-interaction |
| REQ-6 | si/INT-1, si/INT-5 | session-interaction |
| REQ-7 | si/INT-1 | session-interaction |
| REQ-8 | si/INT-5, si/INT-9 | session-interaction |
| REQ-9 | si/INT-7 | session-interaction |
| REQ-10 | si/INT-1 | session-interaction |
| REQ-11 | sl/INT-7, sl/INT-11, sl/INT-12 | session-list |
| REQ-12 | sl/INT-6, sl/INT-7, sl/INT-12 | session-list |
| REQ-13 | sl/INT-6 (new sessions), rs/INT-6 (resumed sessions) | resume-session |
| REQ-14 | sl/INT-1, sl/INT-2, sl/INT-3, sl/INT-4, sl/INT-5, sl/INT-9 | session-list |
| REQ-15 | sl/INT-8, sl/INT-9, sl/INT-11 | session-list |
| REQ-16 | sl/INT-10, sl/INT-12 | session-list |
| REQ-17 | sl/INT-13, sl/INT-14 | session-list |
| REQ-18 | sl/INT-14, sl/INT-15 | session-list |
| REQ-19 | sl/INT-14, sl/INT-15 | session-list |
| REQ-20 | sl/INT-7, sl/INT-11 | session-list |
| REQ-21 | sl/INT-15 | session-list |
| REQ-22 | sl/INT-12, sl/INT-15 | session-list |
| REQ-23 | ss/INT-1, ss/INT-2, ss/INT-3 | stop-session |
| REQ-24 | ss/INT-4 | stop-session |
| REQ-25 | rs/INT-1, rs/INT-3, rs/INT-4, rs/INT-5, rs/INT-7, rs/INT-8, rs/INT-9 | resume-session |
| REQ-26 | rs/INT-1, rs/INT-4, rs/INT-5, rs/INT-7, rs/INT-9 | resume-session |
| REQ-27 | rs/INT-2, rs/INT-4, rs/INT-10 | resume-session |
| REQ-28 | rs/INT-1 | resume-session |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. The exceptions are two enabling INTs: si/INT-2 (CLI executable from an environment variable, for the tests) and si/INT-12 (`lang="it"` on the page).
- REQ-13 is the only REQ that spans two batches. It closes in resume-session.

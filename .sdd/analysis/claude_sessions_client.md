---
request_slug: claude_sessions_client
date: 2026-11-05
type: new
size: broad
reference: none
---

# Analysis — Client for active Claude sessions

## Request

> partendo da sdd-init e decidendo tutti in autonomia mi puoi creare un client per gestire le sessioni attive di claude? mi immagino di non dover più usare 10000 shell ma di avere una pagina con le varie sessioni attive e cliccandoci sopra posso interagire con esse

## Summary

A local client that replaces many terminal windows with one page. The page lists the user's Claude Code sessions. The user clicks a session to open it and work with it as in the terminal.

## Human decisions

- 2026-11-05 → The human asked to show the sessions that run in other shells too. They chose "yes, in this cycle": external sessions are listed, readable live and can be taken over with "Riprendi qui".

## Business goal

The user runs many Claude Code sessions in parallel, each in its own shell. With many shells open, the user loses track of which session works, which waits for an answer, and which project each one belongs to. Time goes into searching for windows instead of working. The value of the client is one place to see every session and its state, and to act on the session that needs attention.

## Requirements

### Functional

Session list
- The page must show every session hosted by the client in one list.
- The list must also show the Claude Code sessions that run in other terminals of the same machine, marked as external.
- Each list entry must show the project folder, a session label, the current state and the time of the last activity.
- The label must default to the start of the first user message in the session.
- The state must be one of: working, needs input, idle, ended.
  "Needs input" means Claude waits for a permission answer or a question to the user. "Idle" means the turn ended and Claude waits for the next message.
- The list must update by itself when a state changes, without a manual reload.
- Sessions in "needs input" must stand out visually and appear before the others.
- The page must show how many sessions need input, also when another session is open.

Session interaction
- A click on a list entry must open the session in the same page, with the full conversation so far.
- The user must be able to send a message to the open session.
- The user must be able to use slash commands as in the terminal.
- Claude's response must appear progressively while it is produced, including the tool calls it runs.
- The user must be able to answer permission requests from the page.
- The client must never answer a permission request on the user's behalf.
- The user must be able to interrupt the current turn of a session.
- The user must be able to switch to another session at any time, without losing the state of the first one.

External sessions
- A click on an external session must show its conversation read-only, as text.
- The conversation of an external session must update live while the session runs.
- An external session must offer a "Riprendi qui" action that resumes it in the client, with the warning for a session still running in a terminal.
- The client must not write anything to an external session.

Session lifecycle
- The user must be able to start a new session by choosing a project folder.
- The user must be able to stop a session. The client must ask for confirmation if the session is working.
- The user must be able to resume a past Claude Code session of the same machine, chosen from a list grouped by project folder.
- Sessions must keep running when the page is closed or reloaded.
- A session started from the client must stay resumable from the terminal with the standard Claude Code commands, and the reverse.

### Non-functional

- Access to the client must be limited to the local machine by default, because a session can run commands on it.
- Opening a session or switching between sessions must feel immediate, at most about one second.
- The client must stay usable with at least 10 sessions active at the same time.
- The client must not change the content of the Claude Code session history beyond what Claude Code itself writes.

## Assumptions

- "Claude sessions" means Claude Code CLI sessions on the user's own machine. The request speaks of shells, and Claude Code is the tool used in shells.
- The human delegated every decision to the agents. The open points below are decided as defaults.
- One user, one machine. The request describes a personal tool.
- The machine runs Linux. This is the user's working environment.
- Claude Code is already installed and logged in. The client uses the user's existing login and does not manage credentials.
- The client warns the user before resuming a session that runs in an external terminal. Two writers on one conversation can corrupt it.
- When the client itself stops, its sessions end. The user can resume them later from the history.
- User interface text is in Italian, the language of the request.
- "Starting from sdd-init" is an instruction for the workflow, not a product requirement.

## Constraints

- The client depends on Claude Code and drives it. It does not replace Claude Code or call the model on its own.
- Claude Code permission rules and settings of each project stay in force. The client must not bypass them.
- Usage limits of the user's Claude plan apply to every session. Many parallel sessions use the quota faster.

## Market trends

Several tools solve the same problem, in three families:

- Terminal managers. Claude Squad and Claude Deck run each session in tmux and show live status per session. Claude Squad also gives each agent its own git workspace. ([Claude Squad](https://nathan-norman.vercel.app/ai-stacks/claude-squad), [Claude Deck](https://docs.rs/crate/claude-deck-cli/latest/source/README.md))
- Desktop and web apps. Conductor is a Mac app with one git worktree and branch per session, plus a review flow ([Conductor](https://www.conductor.build/docs/guides/parallel-agents/run-multiple-claude-code-sessions)). ClawUI starts, streams and resumes sessions in a browser, and a session stays resumable with `claude -r` ([ClawUI](https://www.producthunt.com/products/clawui)).
- Observe-only dashboards. One public dashboard reads Claude's local files and shows activity and cost, but cannot interact with sessions ([ksred.com](https://www.ksred.com/managing-multiple-claude-code-sessions-building-a-real-time-dashboard/)). Its author describes the same pain as this request: sessions spread across terminal tabs, and time spent searching for them.
- Anthropic's Remote Control (research preview, February 2026) continues one local session from a browser or phone through claude.ai. It needs a subscription login, and the sources disagree about its limits on parallel sessions ([TechRadar](https://www.techradar.com/pro/anthropic-reveals-remote-control-a-mobile-version-of-claude-code-to-keep-you-productive-on-the-move?rand=141), [Verdent guide](https://www.verdent.ai/guides/claude-code-remote-control-guide)).

What this means for the request:
- A per-session state, and above all "needs input", is the common core of these tools. It is the main value here too.
- Interoperability with `claude --resume` is standard. Sessions must not be locked inside the client.
- Mac-only apps and observe-only dashboards leave room for a local, interactive tool on Linux.
- Git isolation per session is common, but the request does not ask for it.

## Risks

- Claude Code can change its behaviour or its session format in a new version. The client can then stop working without warning.
- A client reachable from the network gives anyone who reaches it command execution on the machine.
- A missed permission request leaves a session blocked for a long time. The "needs input" state exists to prevent this.
- A wrong state shown in the list (for example "idle" when Claude waits for a permission) breaks the main value of the tool.
- Interaction from the page that misses terminal features (slash commands, interrupts, long outputs) pushes the user back to the shells.
- Many sessions together can use a lot of memory on the machine and a lot of the plan quota.
- The list of external sessions, their state and their conversation come from internal Claude Code files. These files are not documented, so a new Claude Code version can break this feature.

## Scope

In scope:
- One page with the list of sessions, their state and an attention indicator.
- Full interaction with a session hosted by the client: messages, slash commands, permission answers, interrupt.
- Start, stop and resume of sessions on the local machine.
- Interoperability with the terminal through the standard Claude Code resume.
- External sessions in the list, their read-only live conversation, and "Riprendi qui".

Out of scope:
- Typing into a session that keeps running in another terminal. Only that terminal has its keyboard.
- Remote access from other machines or from a phone.
- More than one user, user accounts and authentication.
- Operating system notifications outside the page.
- Git worktree or branch isolation per session.
- Token usage and cost reports.
- Code review, diff views and pull request flows.
- Claude sessions outside Claude Code (claude.ai chats, Claude Code on the web).

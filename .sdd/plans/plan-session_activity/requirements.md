---
slug: session_activity
date: 2026-11-26
spec: .sdd/analysis/session_activity.md
status: validated
---

# Requirements — Live activity of sessions and subagents

Words used below:

- "Entry" → a row of the session list.
- "At work" → defined by REQ-1. It is not a new state: the states, groups and order of the list do not change. "Working" keeps its meaning: the existing state of the list.
- "Main conversation" → the conversation of the session itself, without its subagents. The spec also calls it "the main agent".
- "Turn" → starts with a message that the user sends, and lasts until the next one. A message that Claude Code adds by itself, for example when a background subagent completes, starts no turn.
- "Current turn" → the latest turn of the session, running or ended.
- "Text" → a text that Claude writes in a conversation. Thinking is not text (REQ-5).
- "Step" → a text of Claude, or a tool call.
- "Subagent type" → the agent type that Claude Code records for the subagent, for example "sdd-developer".
- "Running-tool line" → the line of an entry that shows the running tool. `plan-session_list_improvements` calls it "tool line".
- "Main argument" → the argument that the running-tool line shows for a tool call, for example "npm test" for Bash.
- "Latest-text line" → the new line of an entry with the latest text.
- "Stall signal" → the new line of an entry that says the session had no activity for some minutes.
- "Turn panel" → the new panel next to the session view, with the tree of the turn.
- "Subagent conversation" → the conversation of one subagent, opened from the turn panel.

## Feature: Latest text on the list entry

| ID | Requirement |
|----|-------------|
| REQ-1 | A session is at work while it is working, or while at least one of its subagents runs, also after its turn ended. |
| REQ-2 | The entry of a session at work, hosted or external, shows a latest-text line with the latest text that Claude wrote in the current turn. |
| REQ-3 | The latest text comes from the main conversation or from a running subagent, whichever wrote last. |
| REQ-4 | A text from a subagent starts with the subagent type, for example "sdd-developer: Overwriting the whole CommonServiceImpl class…". |
| REQ-5 | Thinking never counts as text. |
| REQ-6 | The text shows as plain text, without markdown. |
| REQ-7 | A text longer than two lines of the entry is cut with an ellipsis at the end of the second line. |
| REQ-8 | The latest-text line ends with the time since that text was written, for example "· 3 min". |
| REQ-9 | The time on the latest-text line counts up. |
| REQ-10 | Before the first text of the current turn, the entry shows no latest-text line, and it never shows a text of an earlier turn. |
| REQ-11 | The latest-text line does not show on a session that needs input, has ended, or is not at work. |
| REQ-12 | The latest-text line changes within 2 seconds of a new text, or of the change that hides it, for hosted and external sessions. |
| REQ-13 | A missing or unknown field in Claude Code's data hides only the part of the latest-text line that uses it, and the rest of the entry keeps working. |
| REQ-14 | A subagent with thousands of steps, or a run of 16 hours, does not slow down the session list. |
| REQ-15 | Every duration of this plan uses a short form: "42 s", "3 min", "1 h 05 min". |

## Feature: Stall signal

| ID | Requirement |
|----|-------------|
| REQ-16 | When a session at work has no activity for 5 minutes, its entry shows a stall signal with the time since the last activity, for example "No activity for 8 min · mvn test running". |
| REQ-17 | Activity is any new message, tool call or tool result in the main conversation or in any subagent of the session. |
| REQ-18 | The stall signal names what the session waits for: the running tool with its main argument, or Claude's response when no tool runs. |
| REQ-19 | A running tool of a subagent carries the subagent type, for example "sdd-tester: mvn test". |
| REQ-20 | When several tools run, the stall signal names the one that started first and the count of the others, for example "+2". |
| REQ-21 | The time in the stall signal counts up while the silence lasts. |
| REQ-22 | The stall signal disappears within 2 seconds of the next activity, or of the moment the session is no longer at work, for hosted and external sessions. |
| REQ-23 | A session that needs input never shows the stall signal. |
| REQ-24 | The stall signal looks different from the latest-text line. |
| REQ-25 | The stall signal changes neither the state of the session, nor its group, nor its place in the list. |
| REQ-26 | A missing or unknown field in Claude Code's data hides only the part of the stall signal that uses it. |

## Feature: Turn panel

| ID | Requirement |
|----|-------------|
| REQ-27 | The user can open and close a turn panel next to the view of a hosted or an external session, as with the git explorer. |
| REQ-28 | The turn panel shows the tree of the current turn. |
| REQ-29 | The tree lists the steps of the main conversation in order: each text of Claude, and each tool call with its name and main argument. |
| REQ-30 | Each tool call in the tree shows whether it runs or has finished. |
| REQ-31 | A subagent appears in the tree at the step that started it. |
| REQ-32 | Each subagent in the tree shows its type, its task description and its model. |
| REQ-33 | Each subagent shows its state: running, finished or stopped. "Stopped" means that it ended before it finished its task, for example after an interrupt. |
| REQ-34 | The duration of a subagent counts up while it runs, and shows the full run time once it ends. |
| REQ-35 | Each subagent shows its latest text with the rules of REQ-5, REQ-6 and REQ-7, and no text before its first one. |
| REQ-36 | Each subagent shows the tool it runs now as the running-tool line shows a tool, and an empty field when it runs no tool. |
| REQ-37 | Subagents that run at the same time appear side by side, as one group. |
| REQ-38 | A subagent started by another subagent appears under its parent. |
| REQ-39 | A subagent that still runs stays in the turn panel after its turn ends, also when a new turn starts. |
| REQ-40 | When no turn runs, the turn panel shows the last turn, marked as ended. |
| REQ-41 | Before the first turn of the session, the turn panel says that there is no turn yet. |
| REQ-42 | While the turn runs, the turn panel keeps the latest step visible, unless the user scrolled up. |
| REQ-43 | The turn panel shows a new event within 2 seconds, for hosted and external sessions. |
| REQ-44 | A missing or unknown field in Claude Code's data hides only that field in the turn panel, and the rest of the panel keeps working. |
| REQ-45 | A subagent with thousands of steps, or a run of 16 hours, does not slow down the turn panel. |
| REQ-46 | The turn panel stays usable with 20 subagents that run at once. |
| REQ-47 | The turn panel is usable with the keyboard, with visible focus. |
| REQ-48 | The turn panel works in the browser page and in the desktop window. |

## Feature: Subagent conversation

| ID | Requirement |
|----|-------------|
| REQ-49 | A click on a subagent in the turn panel opens its conversation read-only, from its task to its latest step. |
| REQ-50 | The subagent conversation shows as the conversation of an external session does. |
| REQ-51 | While the subagent runs, its conversation shows a new step within 2 seconds. |
| REQ-52 | The subagent conversation opens for running and for ended subagents. |
| REQ-53 | Opening a subagent conversation keeps the open session open. |
| REQ-54 | One action returns from the subagent conversation to the tree. |
| REQ-55 | The subagent conversation is usable with the keyboard, with visible focus. |

## Assumptions

- **Text of a subagent from an earlier turn (REQ-3, REQ-10).** A text belongs to the turn in which Claude writes it. A subagent started in an earlier turn that still runs can write the latest text of the current turn.
- **Plain text (REQ-6).** The markdown marks are removed. Line breaks become spaces.
- **Durations (REQ-15).** Units are whole, rounded down. Under one minute → seconds. Under one hour → minutes. Then hours, and minutes on two digits, for example "16 h 00 min".
- **Text of the stall signal (REQ-16, REQ-18 to REQ-20). Gatekeeper decision, 2026-11-26.** As in the examples of the spec: a tool shows its main argument, or its name when it has no main argument. Then "running", then "+N". A subagent tool starts with the subagent type. Examples: "No activity for 8 min · mvn test running", "No activity for 8 min · sdd-tester: mvn test running +2". With no running tool: "No activity for 8 min · waiting for Claude's response".
- **The call that starts a subagent (REQ-18, REQ-20). Gatekeeper decision, 2026-11-26.** For the stall signal, the tool call that started a running subagent is not a running tool. The tools of that subagent count instead. Reason: that call always started first, so the signal would always name it and hide the tool that really runs.
- **Both lines on one entry (REQ-24).** An entry can show the latest-text line and the stall signal at the same time.
- **At the same time (REQ-37). Gatekeeper decision, 2026-11-26.** Subagents run "at the same time" when they were started at the same step. Subagents started at different steps stay at their own steps, also when their runs overlap. Reason: REQ-31 places each subagent at the step that started it, and Claude Code starts parallel subagents with calls in one message.
- **Stopped (REQ-33).** A subagent with no record that it finished also counts as stopped once its session has ended.
- **Latest text in the turn panel (REQ-35).** No subagent type before it and no time after it: the subagent already shows its type and its duration (REQ-32, REQ-34).
- **Shape of the turn panel (REQ-27, REQ-48). Gatekeeper decision, 2026-11-26.** As the git explorer: a panel at the right of the session content, opened and closed by a button in the session header. The turn panel and the git explorer use the same place: opening one closes the other. Reason: two panels of 50 % would leave too little room for the terminal.
- **Place of the subagent conversation (REQ-49, REQ-53, REQ-54).** It opens inside the turn panel, in place of the tree. A "Back" action returns to the tree.
- **Risks accepted by the spec** (section "Risks"). The latest text shows as written, private content included: no masking. A subagent killed with no record of its end can show as running.

## Constraints on the whole plan

These are not REQs. They apply to every REQ above.

- Every new text of the UI is in English.
- The client writes nothing to any session, transcript or Claude Code file.
- The feature uses no network.
- The feature needs no new permission: no change to Claude Code settings and no new system permission.
- The latest-text line, the stall signal and the subagent conversation work in the browser page and in the desktop window, as the rest of the page.
- Every requirement of `plan-session_list_improvements` and of the plans before it stays true. The running-tool line keeps the tools of the main conversation only.
- Out of scope, as in the spec: changes to the running-tool line; changes to session states, groups and order; notifications, sounds or tray signals for a stall, and a setting for its threshold; actions on a subagent; turns before the last one and a history of turns; tokens and cost per subagent.

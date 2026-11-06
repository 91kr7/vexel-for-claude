---
batch: running-tool
feature: Running tool
closed_req: [REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24]
depends: []
---

# Batch running-tool — Running tool

REQ ids refer to `plan-session_list_improvements/requirements.md`. "Tool line" is the new line of a list entry, as defined there.

## What this batch builds

- **Running tool rule** → a pure function: from the open tool calls of a session, the tool that the tool line shows.
- **Running tool monitor** → follows the main transcript of each working session, hosted or external, and tells which tool runs now.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | Export the main-argument rule: the `value` of the "Tool call summary" rule, without its JSON fallback. Nothing found → no main argument. The `summary` of the cards does not change. | REQ-15, REQ-16 | — |
| INT-2 | create | backend, sessions area | Running tool rule: open calls in start order → `{ name, argument?, others }`. The last call, the first line of its INT-1 main argument (trimmed, absent when empty), and the number of the other calls. | REQ-15, REQ-16, REQ-18, REQ-19 | INT-1 |
| INT-3 | create | backend, sessions area | Monitor: reads the new lines of the main transcript (TranscriptReader `locate`, `readFrom`) of each `working` session, at least once per second. A call is open until its result. A user item clears the open calls. | REQ-14, REQ-20, REQ-22, REQ-24 | INT-2 |
| INT-4 | create | backend, sessions area | Same monitor: applies INT-2, keeps a shown tool for at least 1 s unless another replaces it or the session leaves `working`, and notifies each change by session id. | REQ-21, REQ-22 | INT-3 |
| INT-5 | modify | `src/server/sessions/session-list-route.ts` | Each hosted and external entry gets `runningTool` from the monitor, when the monitor has one for it. | REQ-14 | INT-4 |
| INT-6 | modify | `src/server/sessions/session-events-route.ts` | Each `session` frame carries the current `runningTool`. A monitor change sends a `session` frame with the current summary of that session. | REQ-14, REQ-24 | INT-4 |
| INT-7 | modify | `src/server/main.ts` | Create the monitor on the tracker, the scanner and the TranscriptReader. Start it with the server, stop it on shutdown, pass it to the two routes. | REQ-14 | INT-5, INT-6 |
| INT-8 | modify | `src/web/sessions/SessionList.tsx` | A `working` entry with `runningTool` shows the tool line below the label: "<name>: <argument>", or "<name>", then "+N" when `others` > 0. One line, cut with an ellipsis. No tool line in any other state. | REQ-14, REQ-15, REQ-16, REQ-17, REQ-19, REQ-22, REQ-23 | INT-5, INT-6 |

## Decisions

- **The transcript is the source for hosted and external sessions.** The main transcript holds only the calls of the main conversation. Subagent calls are in their own files, or in lines with `isSidechain`, which `itemsOf` already skips (REQ-20). Hooks do not tell a subagent call apart in a way the specs document. So hooks are not used for the tool line.
- **Session state decides when to read.** The monitor reads only sessions in `working` (tracker state for hosted, scanner state for external). The Claude Code session id of a hosted session comes from `claudeSessionId`. A hosted session with no known id has no tool.
- **Same data path as today.** `runningTool` travels inside the existing `session` frames and list entries. LiveSessionStore replaces the whole entry, so it needs no change. The tracker and the scanner do not change, so AttentionMonitor sees no new changes.
- **Shape of `runningTool`** → `{ name, argument?, others }`. The page builds the text. The server gives only the first line of the argument, so a command on several lines never reaches the page whole.
- **Look of the tool line.** Third line of the entry, 16 px in like the label, mono 10 px in `--text-muted`, as the other mono texts of the studio-dark row. A working entry with a tool line is taller than 48 px.
- **Assumption → write timing.** Claude Code writes the `tool_use` line to the transcript when the call starts, before the tool runs. REQ-24 depends on it. The developer checks it with a real session. If it does not hold, the batch stops and asks the human.
- **Risk accepted by the spec.** The tool line shows arguments as they are, secrets included. No masking.
- **Tests.** Vitest for INT-1 to INT-6, with fake transcripts and a fake clock. Playwright e2e in the browser with a fake CLI that writes a transcript. No Electron e2e (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: A working session shows its running tool

- REQ → REQ-14, REQ-15, REQ-24
- Given → a hosted session is working
- When → Claude starts `npm test` with the Bash tool
- Then → within 2 seconds the entry shows the tool line "Bash: npm test", with the same argument as the tool card of the conversation

### Scenario: An external session shows its running tool

- REQ → REQ-14, REQ-24
- Given → a Claude Code session works in another terminal and its entry is in the list
- When → Claude starts reading a file with the Read tool
- Then → within 2 seconds the external entry shows "Read: <file path>"

### Scenario: Several tools at once

- REQ → REQ-19
- Given → a session is working
- When → Claude starts three tools at the same time
- Then → the tool line shows the last tool that started, followed by "+2"

### Scenario: Long and multi-line commands

- REQ → REQ-17, REQ-18
- Given → a session is working
- When → Claude runs a Bash command of three lines, whose first line is longer than the entry
- Then → the tool line shows only the first line, cut on one line with an ellipsis

### Scenario: A tool with no main argument

- REQ → REQ-16
- Given → a session is working
- When → Claude starts a tool whose input has no main argument
- Then → the tool line shows only the tool name

### Scenario: Subagent tools stay hidden

- REQ → REQ-20
- Given → Claude runs a subagent in a working session
- When → the subagent runs its own tools
- Then → the tool line shows the subagent call of the main conversation, never the subagent's own tools

### Scenario: A fast tool does not blink

- REQ → REQ-21
- Given → a session is working
- When → Claude runs a tool that ends in 0.2 seconds, and starts no other tool
- Then → the tool line shows that tool for about 1 second

### Scenario: No tool line when no tool runs

- REQ → REQ-22, REQ-23
- Given → a session is working with no tool running, and other sessions need input, are idle or have ended
- When → the user looks at the list
- Then → none of these entries shows a tool line

---
batch: latest-text
feature: Latest text on the list entry
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15]
depends: []
---

# Batch latest-text — Latest text on the list entry

REQ ids refer to `plan-session_activity/requirements.md`. The words "at work", "turn", "current turn", "text", "subagent type", "running-tool line" and "latest-text line" are defined there.

## What this batch builds

- **Module `activity`**, backend and frontend → holds every new component of this plan. The implementer writes its index and specs, and adds its row to `modules.md`.
- **Turn rule** → tells which user message starts a turn.
- **Subagent state rule** → tells whether a subagent runs, has finished or was stopped.
- **Turn model** → the state of the current turn of one session, built from its main transcript, its subagent files and their metadata. The later batches extend it.
- **Live activity rule** → from the turn model and the session state: whether the session is at work, and its latest text.
- **Activity monitor** → follows the transcripts of every hosted and external session and notifies its live activity.
- **Short duration format** → "42 s", "3 min", "1 h 05 min".
- **Elapsed time** → a time since a moment, in the short form, that counts up.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | `itemsOf` gets an option that also converts lines with `isSidechain`, for the lines of a subagent file. Without the option nothing changes. | REQ-3 | — |
| INT-2 | modify | `src/server/external/transcript-reader.ts` | New exported reader of the metadata file `agent-<id>.meta.json` of a subagent file: agent type, description, `toolUseId`, model, `finished`. A field of an unexpected type is absent. No file or bad JSON → no field. | REQ-1, REQ-4, REQ-13 | — |
| INT-3 | modify | `src/server/sessions/plain-excerpt.ts` | Optional maximum length. Without it the limit stays 100 characters. | REQ-6 | — |
| INT-4 | create | backend, module `activity` | Turn rule: a user item of `userMessageOf` starts a turn, except the interrupt marker ("[Request interrupted by user") and the messages that Claude Code adds by itself, for example a background task notification. | REQ-10 | — |
| INT-5 | create | backend, module `activity` | Subagent state rule: `finished` in the metadata → finished. Else, session ended or an interrupt recorded for the subagent → stopped. Else → running. | REQ-1, REQ-3, REQ-11 | — |
| INT-6 | create | backend, module `activity` | Turn model of one session. From the parsed lines of the main transcript and of each subagent file (items by INT-1), it keeps the start of the current turn and the latest text of each conversation, with the `timestamp` of its line. A new turn drops the older texts. | REQ-2, REQ-3, REQ-5, REQ-10 | INT-1, INT-4 |
| INT-7 | create | backend, module `activity` | Same model: for each subagent it keeps its metadata (INT-2), its interrupt marks and its state (INT-5). It keeps no list of items, so its size per subagent does not grow with the run. | REQ-1, REQ-14 | INT-2, INT-5, INT-6 |
| INT-8 | create | backend, module `activity` | Live activity rule → `{ atWork, latestText? }`. `atWork` → state `working`, or not `ended` with a running subagent. `latestText` → `{ text, subagentType?, at? }`: the last text of the main conversation or of a running subagent, plain and cut at 400 characters (INT-3). | REQ-1, REQ-2, REQ-3, REQ-4, REQ-6, REQ-13 | INT-3, INT-7 |
| INT-9 | create | backend, module `activity` | Activity monitor, reading: for each hosted and external session, the new complete lines of the main transcript, then of each subagent file (`subagentFilesOf`), and their metadata. Every 500 ms, at most 4 MiB per session per poll (`readEntriesFrom`), as UsageMonitor. | REQ-2, REQ-12, REQ-14 | INT-7 |
| INT-10 | create | backend, module `activity` | Same monitor: `get(id)` gives the live activity (INT-8), `onChange` notifies each session whose value changed. It follows the state changes and removals of the tracker and the scanner. A session that ends loses `atWork` at once. | REQ-1, REQ-11, REQ-12 | INT-8, INT-9 |
| INT-11 | modify | `src/server/sessions/session-list-route.ts` | Each hosted and external entry gets `liveActivity` from the monitor, when the monitor has one for it. | REQ-2 | INT-10 |
| INT-12 | modify | `src/server/sessions/session-events-route.ts` | Each `session` frame carries the current `liveActivity`. A monitor change sends a `session` frame with the current summary of that session. | REQ-2, REQ-12 | INT-10 |
| INT-13 | modify | `src/server/main.ts` | Create the monitor on the tracker, the scanner and the TranscriptReader. Start it with the server, stop it on shutdown, pass it to the two routes. | REQ-2 | INT-11, INT-12 |
| INT-14 | create | frontend, module `activity` | Short duration format: under 1 min → "N s", under 1 h → "N min", then "H h MM min". Whole units, rounded down. A negative duration counts as 0. | REQ-15 | — |
| INT-15 | create | frontend, module `activity` | Elapsed time: the short duration (INT-14) from a given moment to now. One shared timer of the page refreshes every shown time once per second. | REQ-8, REQ-9 | INT-14 |
| INT-16 | modify | `src/web/sessions/SessionList.tsx` | Latest-text line of an entry with `liveActivity.atWork` and `latestText`, not in `needs_input` or `ended`: "<subagent type>: " when known, the text, then " · " and the elapsed time (INT-15) when `at` is known. At most two lines with an ellipsis. The time is never cut. | REQ-2, REQ-4, REQ-7, REQ-8, REQ-9, REQ-11, REQ-13 | INT-11, INT-12, INT-15 |

## Decisions

- **New module `activity`.** The plan adds one domain area: the live activity of a session's turn. The list entry only shows it, so SessionList stays in the module `sessions`.
- **The transcript is the source**, for hosted and external sessions alike (spec assumption). Hooks are not used, as for the running-tool line.
- **Claude Code data to check.** The developer checks these points on a real session, with a foreground subagent, a background subagent, a nested subagent and an interrupt, and records them in the specs. If one does not hold, the batch stops and asks the human.
  - Nested subagents write their files in the same `subagents/` folder as the others.
  - The metadata file exists while the subagent runs, and `finished` becomes true when it completes.
  - Each line of a subagent file has a `timestamp`.
  - The markers of an interrupt and of the messages that Claude Code adds by itself (INT-4, INT-5).
- **Every session is read, in any state**, as UsageMonitor does, because `batch-turn-panel` shows the last turn of any session. An ended session is read to the end of its files once. It is read again only when its state changes.
- **Name `liveActivity`.** The summary already has `lastActivity`: the time of the tracker, which orders the list. `liveActivity` is a new field. It never changes `lastActivity`, the state or the group.
- **Time of a text** → the `timestamp` of its line. No `timestamp` → no time on the line (REQ-13).
- **The 2 seconds of REQ-12** count from the moment the line reaches its file, or from the state change in the tracker or the scanner.
- **Plain text** → `plainExcerpt` with a 400-character limit. The page cuts at two lines.
- **Look and place of the latest-text line.** It sits under the running-tool line, or under the label when there is no running-tool line, and above the progress bar, 16 px in. Text 11.5/16 px in `--text-secondary`. The subagent type has weight 600. The time is mono 10 px in `--text-muted`, with tabular figures. It is the one entry text that wraps, on two lines at most: the rule "No entry text wraps" of the SessionList spec gets this exception.
- **No masking.** The text shows as Claude wrote it (risk accepted by the spec).
- **Tests.** Vitest for INT-1 to INT-15, with fake transcripts, subagent files, metadata and a fake clock. Playwright e2e in the browser, with fixture files in the e2e Claude Code folder. No Electron e2e (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: A working session shows Claude's latest text

- REQ → REQ-2, REQ-6, REQ-8, REQ-9, REQ-12, REQ-15
- Given → a hosted session is working on a turn
- When → Claude writes "I am **reading** the `config` files"
- Then → within 2 seconds the entry shows "I am reading the config files · 0 s", and the time counts up: "· 42 s", then "· 3 min"
- And → a text written 65 minutes ago shows "· 1 h 05 min"

### Scenario: The text of a subagent wins when it writes last

- REQ → REQ-3, REQ-4, REQ-12
- Given → an external session at work runs an sdd-developer subagent
- When → the subagent writes "Overwriting the whole CommonServiceImpl class" after the last text of the main conversation
- Then → within 2 seconds the entry shows "sdd-developer: Overwriting the whole CommonServiceImpl class · 0 s"

### Scenario: A background subagent keeps the session at work

- REQ → REQ-1, REQ-11
- Given → a session whose turn ended while a background subagent still runs
- When → the user looks at the idle entry
- Then → the entry shows the latest text of the subagent
- And → when the subagent finishes, the line disappears

### Scenario: Thinking and old turns never show

- REQ → REQ-5, REQ-10
- Given → a session whose previous turn ended with a text of Claude
- When → the user sends a new message, and Claude only thinks
- Then → the entry shows no latest-text line

### Scenario: A long text stays on two lines

- REQ → REQ-7, REQ-8
- Given → a session at work in a narrow list panel
- When → Claude writes a text of 300 characters
- Then → the line shows two lines of text that end with "…", and the time stays visible at its end

### Scenario: No line on sessions that need input or have ended

- REQ → REQ-11
- Given → a session that needs input, a session that ended and an idle session with no running subagent, each with texts in its last turn
- When → the user looks at the list
- Then → none of these entries shows a latest-text line

### Scenario: Missing data hides only its part

- REQ → REQ-13
- Given → a subagent whose metadata has no agent type, and whose last text line has no timestamp
- When → that subagent writes the latest text of a session at work
- Then → the entry shows the text with no "type: " before it and no time after it, and the rest of the entry shows as usual

### Scenario: A huge subagent does not slow the list

- REQ → REQ-14
- Given → a session with a subagent file of thousands of steps, written over 16 hours
- When → the user scrolls the list and opens other sessions
- Then → the list reacts at once, and the entry shows the latest text of that subagent

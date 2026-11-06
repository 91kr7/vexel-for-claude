---
batch: context-occupancy
feature: Context occupancy
closed_req: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12]
depends: []
---

# Batch context-occupancy — Context occupancy

REQ ids refer to `plan-session_usage/requirements.md`. "Response", "main conversation" and "context occupancy" are defined there.

## What this batch builds

- **Response rule** → a pure function: one transcript line to the response it records, with its model and its token counts.
- **Context window table** → the window size of a model id.
- **Context rule** → a pure function: from the lines of the main transcript, the used tokens and the window size of the session now.
- **Usage monitor** → follows the transcript of every hosted and external session, in any state, and tells its usage figures. The two later batches extend it.
- **Usage format** → page functions: the short form of a token count, the percentage, and its level (normal, warning, error).

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | Add `readEntriesFrom(file, offset, maxBytes?)`: the parsed JSON objects of the complete lines after `offset`, with the offset rule of `readFrom`. It reads at most `maxBytes` per call. Invalid lines give nothing. | REQ-3, REQ-21 | — |
| INT-2 | create | backend, sessions area | Response rule: an `assistant` line with `message.usage` → `{ key, model, input, output, cacheWrite, cacheRead, sidechain }`. `key` = `message.id`, else the line `uuid`. Model `<synthetic>`, or no `usage` → no response. | REQ-3, REQ-6 | — |
| INT-3 | create | backend, sessions area | Context window table: known model ids with their window size. An id with the "[1m]" marker → 1,000,000. Any other id → 200,000. Used tokens above 200,000 → 1,000,000. | REQ-4, REQ-5 | — |
| INT-4 | create | backend, sessions area | Context rule, lines in file order: each response with `sidechain` false sets `{ used: input + cacheWrite + cacheRead, window }` (INT-2, INT-3). A `system` line with `subtype` `compact_boundary` clears it. Nothing set → no context. | REQ-3, REQ-6, REQ-7, REQ-9 | INT-2, INT-3 |
| INT-5 | create | backend, sessions area | Usage monitor: finds the main transcript of every hosted and external session, in any state, with the RunningToolMonitor rules (`locate`, change of Claude Code session id). Every 1 s it reads the new lines (INT-1) and applies INT-4. | REQ-1, REQ-2, REQ-9, REQ-12 | INT-1, INT-4 |
| INT-6 | create | backend, sessions area | Same monitor: `get(id)` → `usage` `{ context? }`. `onChange` per session id, only when the value changes. An ended session keeps its last value until it leaves the tracker. | REQ-10, REQ-12 | INT-5 |
| INT-7 | create | backend, sessions area | Same monitor: at most a fixed number of bytes per file per poll. A large transcript is read over several polls. Reads never run on the path of a request. | REQ-21 | INT-5 |
| INT-8 | modify | `src/server/sessions/session-list-route.ts` | New optional argument: the usage monitor. Each hosted and external entry gets `usage` from monitor `get(id)` when it gives one. | REQ-1, REQ-2 | INT-6 |
| INT-9 | modify | `src/server/sessions/session-events-route.ts` | New optional argument: the usage monitor. Each `session` frame carries the current `usage`. A monitor change sends a `session` frame with the current summary, its `runningTool` and its `usage`. | REQ-1, REQ-12 | INT-6 |
| INT-10 | modify | `src/server/main.ts` | Create the usage monitor on the tracker, the scanner and the TranscriptReader. Start it with the server, stop it on shutdown, pass it to the two routes. | REQ-1, REQ-12 | INT-8, INT-9 |
| INT-11 | create | frontend, sessions area | Usage format: short form of a token count (rule in requirements, "Short form"). Percentage rounded to a whole number. Level: `warning` from 70 %, `error` from 90 %, else `normal`. | REQ-2, REQ-8, REQ-11 | — |
| INT-12 | modify | `src/web/sessions/SessionList.tsx` | Every entry with `usage.context` shows the percentage (INT-11) on line 2, before the time. On the needs-input card, it shows at the right of the label. No `usage.context` → nothing. | REQ-1, REQ-8, REQ-9, REQ-10 | INT-11 |
| INT-13 | modify | `src/web/sessions/SessionHeader.tsx` | `SessionHeaderSummary` gets an optional `usage`. With `usage.context` → a `.mono-chip` "Context 45.2k / 200k · 23%" before the state pill, coloured by its level. No `usage.context` → no chip. | REQ-2, REQ-8, REQ-9, REQ-11 | INT-11 |

## Decisions

- **Reuse.** The monitor follows the RunningToolMonitor pattern and its rules for finding the transcript of a session. The hosted transcript comes from `tracker.claudeSessionId`, the external one from the scanner id. RunningToolMonitor does not change. It reads only working sessions and only conversation items. The usage figures need every session, and the `usage` field that `itemsOf` drops.
- **No change to SessionView or ConversationView.** AppLayout gives both views the whole summary from LiveSessionStore. They pass it to SessionHeader as `SessionHeaderSummary`. A new optional field on that type reaches the header. A parallel cycle edits `SessionView.tsx`.
- **Page type.** The page summary type that declares `runningTool` also gets the optional `usage`. LiveSessionStore replaces the whole entry, so its logic does not change.
- **Shape of `usage`** → `{ context?: { used, window } }`. The page computes the percentage. The later batches add `tokens` and `cost` to the same object.
- **A new Claude Code session id starts again.** When the hosted id changes (`/clear` sends a new id with its hooks), the monitor drops the old transcript and its values. An external session gets a new scanner entry after `/clear`. In both cases the new transcript has no response yet (REQ-9).
- **Window table content.** The developer fills it from Anthropic's model docs on the delivery date: the models whose default window is 1,000,000. The spec accepts this risk: a 1M session with less than 200,000 tokens and an unknown model shows too high a percentage.
- **Look.** List: mono 10 px in `--text-muted`, 6 px before the time. Header: the chip "Context" in `--text-muted`, then the value. Level `warning` uses the amber status colour. Level `error` uses the rose status colour, in both places. A 48 px row stays 48 px.
- **Tests.** Vitest for INT-1 to INT-9, INT-11 and the two components, with fake transcripts and a fake clock. Playwright e2e in the browser, with the fake CLI writing `usage` lines. No Electron e2e (knowledge base `electron-e2e-separate`). Existing tests to run (knowledge base `narrow-batch-tests`): those of `transcript-reader`, `session-list-route`, `session-events-route`, `main`, `SessionList`, `SessionHeader`. The direct users of SessionHeader are `SessionView` and `ConversationView`, so their tests run too.

## Human acceptance

### Scenario: A session shows how full its context is

- REQ → REQ-1, REQ-2, REQ-3, REQ-11
- Given → a hosted session whose last response used 45,200 input, cache write and cache read tokens, plus some output tokens
- When → the user opens the session
- Then → the list entry shows "23%" and the header shows "Context 45.2k / 200k · 23%"

### Scenario: An external session updates in the list

- REQ → REQ-1, REQ-12
- Given → a Claude Code session works in another terminal and its entry is in the list
- When → Claude answers a new prompt in that terminal
- Then → within 2 seconds the external entry shows the new percentage

### Scenario: A full context stands out

- REQ → REQ-8
- Given → one session is at 75 % of its window and another at 92 %
- When → the user looks at the list and opens each session
- Then → the first shows its percentage in amber, the second in rose, in the entry and in the header

### Scenario: A large context uses the large window

- REQ → REQ-4, REQ-5
- Given → a session with 300,000 used tokens, and another one on an extended-context model with 150,000 used tokens
- When → the user opens each session
- Then → the headers show "Context 300k / 1M · 30%" and "Context 150k / 1M · 15%"

### Scenario: Subagents and compaction

- REQ → REQ-6, REQ-7
- Given → an open session at "Context 80k / 200k · 40%"
- When → a subagent of the session answers, and later the session compacts its context
- Then → the subagent answer does not change the chip, and after the compaction the chip disappears until the next answer of the session

### Scenario: No figures before the first response

- REQ → REQ-9
- Given → the user starts a new session
- When → the user looks at the entry and the header before Claude answers
- Then → neither shows a percentage, and neither shows "0%"

### Scenario: An ended session keeps its figures

- REQ → REQ-10
- Given → an open hosted session at 40 %
- When → the session ends
- Then → its entry in the ended group and its header still show 40 %

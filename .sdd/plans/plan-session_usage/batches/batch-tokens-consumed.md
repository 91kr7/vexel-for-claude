---
batch: tokens-consumed
feature: Tokens consumed
closed_req: [REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21]
depends: [context-occupancy]
---

# Batch tokens-consumed — Tokens consumed

REQ ids refer to `plan-session_usage/requirements.md`. "Response" and "tokens consumed" are defined there.

Components built by `batch-context-occupancy` are named as in its "What this batch builds" section. Their paths are in `.sdd/modules/sessions/index.md`, where that batch records them.

## What this batch builds

- **Response ledger** → the responses of one session, one record per response, with the sums of their tokens.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | `src/server/external/transcript-reader.ts` | Add `subagentFilesOf(file)`: the `.jsonl` files in the folder `<file without ".jsonl">/subagents/`. No folder → `[]`. Read-only. | REQ-14 | — |
| INT-2 | create | backend, sessions area | Response ledger: one record per response `key` (Response rule), from any file. A repeated key keeps the line with more output tokens, the later one on a tie. It gives the sums of input, output, cache write and cache read. | REQ-14, REQ-15 | — |
| INT-3 | create | backend, sessions area | Same ledger: a replaced record replaces its counts in the sums. It never sums every record again. | REQ-21 | INT-2 |
| INT-4 | modify | Usage monitor (`batch-context-occupancy`) | At each poll, also read the subagent files of each session (INT-1), new files included, with their own offsets. Feed every response, main and sidechain, to one ledger per session. | REQ-14, REQ-15, REQ-20 | INT-1, INT-2 |
| INT-5 | modify | Usage monitor (`batch-context-occupancy`) | `usage.tokens` = `{ input, output, cacheWrite, cacheRead }` when the ledger has a response. A new Claude Code session id starts a new ledger. A session read for the first time is read from the start of every file. | REQ-16, REQ-17, REQ-18, REQ-19 | INT-4 |
| INT-6 | modify | Usage monitor (`batch-context-occupancy`) | The subagent files share the byte limit per poll of the main transcript. | REQ-21 | INT-4 |
| INT-7 | modify | `src/web/sessions/SessionHeader.tsx` | With `usage.tokens` → a focusable `.mono-chip` "1.3M tokens" (sum of the four parts) after the context chip. Hover or focus shows a popover: "Input", "Output", "Cache write", "Cache read", each in short form. | REQ-13, REQ-18 | — |

## Decisions

- **Where the subagent responses are.** Recent Claude Code versions write them to `<session>/subagents/*.jsonl`, next to the main transcript. Older versions write them to the main transcript, with `isSidechain`. The ledger takes both (INT-4). The developer checks the folder with a real session that runs a subagent. If the files are elsewhere, the batch stops and asks the human.
- **Final values (REQ-15).** Claude Code writes one line per content block of a response, and each line carries `usage`. The early lines carry low output counts. So the line with more output tokens wins. The other counts are the same on every line.
- **Resume (REQ-16).** A resumed session is read from the start of its transcript, so the responses from before the resume count. If Claude Code copies the old lines into a new file, the key keeps each response once. The developer checks a real `--resume`. If the new file holds neither the old lines nor the old responses, the batch stops and asks the human.
- **`/clear` (REQ-17).** `/clear` gives a new Claude Code session id and a new transcript. The monitor already drops the old transcript then (`batch-context-occupancy`, "A new Claude Code session id starts again"). Here the ledger goes with it.
- **No change to the routes.** `usage` already travels in the list entries and the `session` frames. The new `tokens` field rides inside it.
- **Header only.** The list entry shows no tokens, as the spec asks. The popover keeps the 40 px header on one row. It opens on hover and on keyboard focus, so the four parts are reachable without a mouse.
- **Tests.** Vitest for INT-1 to INT-7, with fake main and subagent transcripts and repeated lines. Playwright e2e in the browser for the header. No Electron e2e (knowledge base `electron-e2e-separate`). Existing tests to run (knowledge base `narrow-batch-tests`): those of `transcript-reader`, the usage monitor, `SessionHeader`, `SessionView`, `ConversationView`.

## Human acceptance

### Scenario: The header shows the tokens of the session

- REQ → REQ-13, REQ-14, REQ-20
- Given → an open session where Claude answered twice and ran one subagent
- When → the user moves the pointer over the tokens chip
- Then → the chip shows the total of all the answers, subagent included, and the popover shows input, output, cache write and cache read

### Scenario: Repeated lines count once

- REQ → REQ-15
- Given → a session with one answer of 3 content blocks, written on 3 transcript lines
- When → the user opens the session
- Then → the tokens chip counts that answer once, with its final output count

### Scenario: A resumed session keeps its old tokens

- REQ → REQ-16
- Given → an ended session that shows "12.4k tokens"
- When → the user resumes it and Claude answers once
- Then → the chip shows more than 12.4k, not only the new answer

### Scenario: `/clear` starts again from zero

- REQ → REQ-17, REQ-18
- Given → an open session that shows "45k tokens"
- When → the user types `/clear` in the terminal
- Then → the tokens chip disappears, and after the next answer it shows only that answer

### Scenario: An ended session keeps its tokens

- REQ → REQ-19
- Given → an open hosted session that shows "45k tokens"
- When → the session ends
- Then → the header still shows "45k tokens"

### Scenario: A long session opens fast

- REQ → REQ-21
- Given → a session whose transcript holds thousands of answers
- When → the user opens the session and then another one
- Then → the list and the session open without a visible delay, and the figures appear within a few seconds

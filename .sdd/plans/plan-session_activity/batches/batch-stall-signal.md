---
batch: stall-signal
feature: Stall signal
closed_req: [REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26]
depends: [latest-text]
---

# Batch stall-signal — Stall signal

REQ ids refer to `plan-session_activity/requirements.md`. The words "at work", "activity", "main argument", "latest-text line" and "stall signal" are defined there.

The turn model, the live activity rule, the activity monitor and the elapsed time come from `batch-latest-text`. Their paths are in the index of the module `activity`.

## What this batch builds

- **Waiting-for rule** → from the open tool calls of the main conversation and of the running subagents, the thing the session waits for.
- **Stall signal text** → the text of the signal, from the time of silence and the waiting-for value.

## Interventions

| ID | Type | Where | What | REQ | Depends |
|----|------|-------|------|-----|---------|
| INT-1 | modify | backend, module `activity`: the turn model of `batch-latest-text/INT-6` | Keeps the time of the last activity: the latest `user` or `assistant` line of the main transcript or of any subagent file. The time is the `timestamp` of the line, else the moment the monitor read it. | REQ-17, REQ-26 | — |
| INT-2 | modify | backend, module `activity`: the turn model of `batch-latest-text/INT-6` | Keeps the open tool calls of the main conversation and of each subagent, in start order, with name, raw input and the subagent type. A result closes its call. A user message or the end of a subagent closes every call of that conversation. | REQ-18, REQ-19, REQ-20 | — |
| INT-3 | create | backend, module `activity` | Waiting-for rule. The open calls of INT-2, without the calls that started a running subagent → the first one started: `{ subagentType?, name, argument?, others }`. `argument` → first line of `mainArgumentOf`, trimmed. No open call → "response". | REQ-18, REQ-19, REQ-20, REQ-26 | INT-2 |
| INT-4 | modify | backend, module `activity`: the live activity rule of `batch-latest-text/INT-8` | `liveActivity` gets `lastEventAt` (INT-1) and `waitingFor` (INT-3). A change of either is a monitor change. It never changes `lastActivity`, the state or the group. | REQ-16, REQ-18, REQ-22, REQ-25 | INT-1, INT-3 |
| INT-5 | modify | `src/web/icons/Icons.tsx` | Adds the Lucide `clock` icon, when the set does not have it. | REQ-24 | — |
| INT-6 | create | frontend, module `activity` | Stall signal text: "No activity for <short duration> · ", then "<subagent type>: " when known, the argument (else the tool name), " running", and " +N" when others > 0. With "response" → "waiting for Claude's response". | REQ-16, REQ-18, REQ-19, REQ-20, REQ-26 | — |
| INT-7 | modify | `src/web/sessions/SessionList.tsx` | Stall signal of an entry with `atWork`, not in `needs_input` or `ended`, from 5 min after `lastEventAt`: the `clock` icon and the INT-6 text with the elapsed time. Under the latest-text line, one line with an ellipsis, full text as tooltip. | REQ-16, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25 | INT-4, INT-5, INT-6 |

## Decisions

- **Text of the signal.** Gatekeeper decision of 2026-11-26, recorded in the requirements ("Text of the stall signal"). INT-6 follows it.
- **The call that starts a subagent** is not a running tool for the signal. Gatekeeper decision of 2026-11-26, recorded in the requirements. INT-3 follows it.
- **What counts as activity.** Every `user` and `assistant` line holds a message, a tool call or a tool result. A thinking block is an assistant message, so it counts. Lines of other types (for example a summary or a file snapshot) do not count.
- **The page decides when the signal shows.** The server sends `lastEventAt`. The shared timer of the elapsed time (`batch-latest-text/INT-15`) shows the signal at 5 minutes and counts up. A new activity reaches the page within one poll of the monitor (500 ms) and one frame, so the signal goes within 2 seconds (REQ-22).
- **Threshold.** 5 minutes, fixed, with no setting (spec assumption).
- **Look.** Mono 10/15 px in amber-400, with the 12 px `clock` icon before the text, 16 px in. The latest-text line is sans in `--text-secondary`, so the two look different (REQ-24). The signal is one line of text, never a card or a tag, so it does not look like a needs-input entry. Both lines can show together (requirements, "Both lines on one entry").
- **Order of the entries.** The signal changes nothing that `groupSessions` or `orderSessions` read (REQ-25).
- **Risk accepted by the spec.** A long and healthy command, for example a full test run, also shows the signal.
- **Tests.** Vitest for INT-1 to INT-4 and INT-6, with fake files and a fake clock. Playwright e2e in the browser, with fixture files whose last line is older than 5 minutes. No Electron e2e (knowledge base `electron-e2e-separate`).

## Human acceptance

### Scenario: A silent session shows what it waits for

- REQ → REQ-16, REQ-18, REQ-19, REQ-21, REQ-24
- Given → a hosted session at work, whose sdd-tester subagent runs `mvn test` with the Bash tool, and nothing new written for 8 minutes
- When → the user looks at the list
- Then → the entry shows "No activity for 8 min · sdd-tester: mvn test running" with a clock icon, in a colour different from the latest-text line
- And → one minute later it shows "No activity for 9 min"

### Scenario: Any activity removes the signal

- REQ → REQ-17, REQ-22
- Given → an external session at work shows the stall signal
- When → one of its subagents writes a tool result
- Then → within 2 seconds the signal disappears

### Scenario: Several tools run

- REQ → REQ-20
- Given → a session at work where the main conversation runs one tool and two subagents run one tool each, with no activity for 6 minutes
- When → the user looks at the list
- Then → the signal names the tool that started first, followed by "+2"

### Scenario: No tool runs

- REQ → REQ-18
- Given → a session at work with no running tool and no activity for 6 minutes
- When → the user looks at the list
- Then → the entry shows "No activity for 6 min · waiting for Claude's response"

### Scenario: The signal stays out of the order and of needs-input entries

- REQ → REQ-23, REQ-25
- Given → two sessions at work with no activity for 7 minutes, one of them waiting for a permission
- When → the user looks at the list
- Then → only the session that does not need input shows the signal
- And → both entries keep their state, their group and their place

### Scenario: Missing data hides only its part

- REQ → REQ-26
- Given → a subagent with no agent type in its metadata runs a tool with no input, with no activity for 6 minutes
- When → the user looks at the list
- Then → the signal shows the tool name with no "type: " before it, for example "No activity for 6 min · WebSearch running"

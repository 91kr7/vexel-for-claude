---
status: validated
---

# Batches — Context, tokens and cost per session

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [context-occupancy](batches/batch-context-occupancy.md) | Context occupancy | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12 | — | certified | A session shows how full its context is |
| [tokens-consumed](batches/batch-tokens-consumed.md) | Tokens consumed | REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21 | context-occupancy | todo | The header shows the tokens of the session |
| [estimated-cost](batches/batch-estimated-cost.md) | Estimated cost | REQ-22, REQ-23, REQ-24, REQ-25, REQ-26, REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35 | tokens-consumed | todo | Every session shows its estimated cost |

Execution order: `context-occupancy`, `tokens-consumed`, `estimated-cost`.

## Assumptions and decisions

- **Three batches, one per feature, in a chain.** `context-occupancy` builds the data path: the usage monitor, the `usage` field in list entries and `session` frames, and the usage chips of the header. `tokens-consumed` adds the response ledger to that monitor. `estimated-cost` prices the ledger records, so the cost covers the same responses as the tokens (REQ-24).
- **Reuse of the transcript readers.** TranscriptReader gets two read-only functions: raw lines (`batch-context-occupancy/INT-1`) and subagent files (`batch-tokens-consumed/INT-1`). The usage monitor copies the RunningToolMonitor rules for finding a transcript. RunningToolMonitor does not change.
- **New components.** Each batch names its new components in "What this batch builds". There are eight, all in the sessions area: the response rule, the context window table, the context rule, the usage monitor, the usage format, the response ledger, the price list and the cost rule.
- **Later batches change components of earlier ones.** Their `where` names the component and the batch that built it. The path is in `.sdd/modules/sessions/index.md`, where the earlier batch records it.
- **`SessionView.tsx` does not change.** The header figures reach SessionHeader through `SessionHeaderSummary`, which AppLayout fills with the whole summary (`batch-context-occupancy`, Decisions). A parallel cycle edits `SessionView.tsx`.
- **Checks on real Claude Code.** The transcript layout is not documented (spec risk). The developer checks three points with real sessions: the subagent files folder, the files a `--resume` writes, and the new session id after `/clear` (`batch-tokens-consumed`, Decisions). If a point does not hold, the batch stops and asks the human.
- **Gatekeeper decisions.** These are the window table with the "[1m]" marker, the cost label as a tooltip in the list, "—" when no price is known, and the amber and rose levels. They are recorded in `requirements.md`, "Assumptions".
- **Tests.** Vitest and browser Playwright only. No batch plans Electron e2e (knowledge base `electron-e2e-separate`). Each batch file lists the existing tests to run (knowledge base `narrow-batch-tests`).

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT. Every REQ closes in the batch that serves it, except REQ-21, which two batches serve.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-context-occupancy/INT-5`, `INT-8`, `INT-9`, `INT-10`, `INT-12` | context-occupancy |
| REQ-2 | `batch-context-occupancy/INT-5`, `INT-8`, `INT-11`, `INT-13` | context-occupancy |
| REQ-3 | `batch-context-occupancy/INT-1`, `INT-2`, `INT-4` | context-occupancy |
| REQ-4 | `batch-context-occupancy/INT-3` | context-occupancy |
| REQ-5 | `batch-context-occupancy/INT-3` | context-occupancy |
| REQ-6 | `batch-context-occupancy/INT-2`, `INT-4` | context-occupancy |
| REQ-7 | `batch-context-occupancy/INT-4` | context-occupancy |
| REQ-8 | `batch-context-occupancy/INT-11`, `INT-12`, `INT-13` | context-occupancy |
| REQ-9 | `batch-context-occupancy/INT-4`, `INT-5`, `INT-12`, `INT-13` | context-occupancy |
| REQ-10 | `batch-context-occupancy/INT-6`, `INT-12` | context-occupancy |
| REQ-11 | `batch-context-occupancy/INT-11`, `INT-13` | context-occupancy |
| REQ-12 | `batch-context-occupancy/INT-5`, `INT-6`, `INT-9`, `INT-10` | context-occupancy |
| REQ-13 | `batch-tokens-consumed/INT-7` | tokens-consumed |
| REQ-14 | `batch-tokens-consumed/INT-1`, `INT-2`, `INT-4` | tokens-consumed |
| REQ-15 | `batch-tokens-consumed/INT-2`, `INT-4` | tokens-consumed |
| REQ-16 | `batch-tokens-consumed/INT-5` | tokens-consumed |
| REQ-17 | `batch-tokens-consumed/INT-5` | tokens-consumed |
| REQ-18 | `batch-tokens-consumed/INT-5`, `INT-7` | tokens-consumed |
| REQ-19 | `batch-tokens-consumed/INT-5` | tokens-consumed |
| REQ-20 | `batch-tokens-consumed/INT-4` | tokens-consumed |
| REQ-21 | `batch-context-occupancy/INT-1`, `INT-7`; `batch-tokens-consumed/INT-3`, `INT-6` | tokens-consumed |
| REQ-22 | `batch-estimated-cost/INT-5`, `INT-7` | estimated-cost |
| REQ-23 | `batch-estimated-cost/INT-5`, `INT-8` | estimated-cost |
| REQ-24 | `batch-estimated-cost/INT-4` | estimated-cost |
| REQ-25 | `batch-estimated-cost/INT-1`, `INT-3` | estimated-cost |
| REQ-26 | `batch-estimated-cost/INT-1`, `INT-2`, `INT-3` | estimated-cost |
| REQ-27 | `batch-estimated-cost/INT-2` | estimated-cost |
| REQ-28 | `batch-estimated-cost/INT-1`, `INT-3` | estimated-cost |
| REQ-29 | `batch-estimated-cost/INT-7`, `INT-8` | estimated-cost |
| REQ-30 | `batch-estimated-cost/INT-3`, `INT-4`, `INT-6`, `INT-7`, `INT-8` | estimated-cost |
| REQ-31 | `batch-estimated-cost/INT-4` | estimated-cost |
| REQ-32 | `batch-estimated-cost/INT-6`, `INT-8` | estimated-cost |
| REQ-33 | `batch-estimated-cost/INT-5`, `INT-7`, `INT-8` | estimated-cost |
| REQ-34 | `batch-estimated-cost/INT-5`, `INT-7`, `INT-8` | estimated-cost |
| REQ-35 | `batch-estimated-cost/INT-5` | estimated-cost |

Every INT serves at least one REQ. There is no enabling intervention.

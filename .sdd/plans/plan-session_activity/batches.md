---
status: validated
---

# Batches — Live activity of sessions and subagents

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [latest-text](batches/batch-latest-text.md) | Latest text on the list entry | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15 | — | certified | A working session shows Claude's latest text |
| [stall-signal](batches/batch-stall-signal.md) | Stall signal | REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26 | latest-text | certified | A silent session shows what it waits for |
| [turn-panel](batches/batch-turn-panel.md) | Turn panel | REQ-27, REQ-28, REQ-29, REQ-30, REQ-31, REQ-32, REQ-33, REQ-34, REQ-35, REQ-36, REQ-37, REQ-38, REQ-39, REQ-40, REQ-41, REQ-42, REQ-43, REQ-44, REQ-45, REQ-46, REQ-47, REQ-48 | stall-signal | certified | The user follows the turn and its subagents |
| [subagent-conversation](batches/batch-subagent-conversation.md) | Subagent conversation | REQ-49, REQ-50, REQ-51, REQ-52, REQ-53, REQ-54, REQ-55 | turn-panel | certified | The user reads the live conversation of a subagent |
| [workflow-subagents](batches/batch-workflow-subagents.md) | Workflow subagents | REQ-56, REQ-57, REQ-58, REQ-59, REQ-60 | subagent-conversation | certified | The turn panel shows the agents of a workflow |

Execution order: `latest-text`, `stall-signal`, `turn-panel`, `subagent-conversation`, `workflow-subagents`.

## Assumptions and decisions

- **Five batches, one per feature, in a line.** Each batch extends the turn model and the activity monitor of the one before. `stall-signal` adds the open tool calls of each conversation, which the subagent cards of `turn-panel` show. `subagent-conversation` opens from the cards of `turn-panel`.
- **New module `activity`**, backend and frontend, born in `batch-latest-text`. It holds the new components of this plan, except the conversation body, which stays in the module `external` with ConversationView.
- **New components.** Each batch names them in "What this batch builds". There are 20: 7 in `latest-text`, 2 in `stall-signal`, 6 in `turn-panel`, 4 in `subagent-conversation`, 1 in `workflow-subagents`.
- **Workflow subagents, human decision of 2026-11-26.** The fifth batch comes last, because it extends the turn model, the activity monitor and the subagent file lookup of the four batches before it. How it tells the state of a workflow subagent and where it places it come from the real files (`batch-workflow-subagents`, "Facts read in the real files").
- **The transcripts are the only source**, read-only, for hosted and external sessions. Some facts about Claude Code's files are checked on a real session at the start of `latest-text`. If one does not hold, the batch stops and asks the human (`batch-latest-text`, "Claude Code data to check").
- **Name `liveActivity`** for the new field of a session summary, because `lastActivity` already exists and orders the list (`batch-latest-text`, "Name `liveActivity`").
- **Gatekeeper decisions of 2026-11-26** (text of the stall signal, the call that starts a subagent, shape of the turn panel) are in `requirements.md`, "Assumptions".
- **Group rule of the turn panel. Gatekeeper decision, 2026-11-26.** Subagents started at the same step form one group (requirements, "At the same time"; `batch-turn-panel`, "Group rule").
- **"Task" for the user items of a subagent conversation. Gatekeeper decision, 2026-11-26** (`batch-subagent-conversation`, "Name of the user items").
- **Tests.** Vitest and Playwright in the browser in every batch. The tester writes one Electron e2e spec, in the Electron group, for REQ-48 (`batch-turn-panel`, "Desktop window", knowledge base `electron-e2e-separate`).
- **Technical debt.** The register has no open item, so no batch closes one.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT, and closes in the batch that serves it. REQ-15 (short durations) closes in `latest-text`. `stall-signal` and `turn-panel` reuse its format and do not list it again.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-latest-text/INT-2`, `INT-5`, `INT-7`, `INT-8`, `INT-10` | latest-text |
| REQ-2 | `batch-latest-text/INT-6`, `INT-8`, `INT-9`, `INT-11`, `INT-12`, `INT-13`, `INT-16` | latest-text |
| REQ-3 | `batch-latest-text/INT-1`, `INT-5`, `INT-6`, `INT-8` | latest-text |
| REQ-4 | `batch-latest-text/INT-2`, `INT-8`, `INT-16` | latest-text |
| REQ-5 | `batch-latest-text/INT-6` | latest-text |
| REQ-6 | `batch-latest-text/INT-3`, `INT-8` | latest-text |
| REQ-7 | `batch-latest-text/INT-16` | latest-text |
| REQ-8 | `batch-latest-text/INT-15`, `INT-16` | latest-text |
| REQ-9 | `batch-latest-text/INT-15`, `INT-16` | latest-text |
| REQ-10 | `batch-latest-text/INT-4`, `INT-6` | latest-text |
| REQ-11 | `batch-latest-text/INT-5`, `INT-10`, `INT-16` | latest-text |
| REQ-12 | `batch-latest-text/INT-9`, `INT-10`, `INT-12` | latest-text |
| REQ-13 | `batch-latest-text/INT-2`, `INT-8`, `INT-16` | latest-text |
| REQ-14 | `batch-latest-text/INT-7`, `INT-9` | latest-text |
| REQ-15 | `batch-latest-text/INT-14` | latest-text |
| REQ-16 | `batch-stall-signal/INT-4`, `INT-6`, `INT-7` | stall-signal |
| REQ-17 | `batch-stall-signal/INT-1` | stall-signal |
| REQ-18 | `batch-stall-signal/INT-2`, `INT-3`, `INT-4`, `INT-6` | stall-signal |
| REQ-19 | `batch-stall-signal/INT-2`, `INT-3`, `INT-6` | stall-signal |
| REQ-20 | `batch-stall-signal/INT-2`, `INT-3`, `INT-6` | stall-signal |
| REQ-21 | `batch-stall-signal/INT-7` | stall-signal |
| REQ-22 | `batch-stall-signal/INT-4`, `INT-7` | stall-signal |
| REQ-23 | `batch-stall-signal/INT-7` | stall-signal |
| REQ-24 | `batch-stall-signal/INT-5`, `INT-7` | stall-signal |
| REQ-25 | `batch-stall-signal/INT-4`, `INT-7` | stall-signal |
| REQ-26 | `batch-stall-signal/INT-1`, `INT-3`, `INT-6` | stall-signal |
| REQ-27 | `batch-turn-panel/INT-5`, `INT-6`, `INT-7`, `INT-9`, `INT-11`, `INT-14`, `INT-15` | turn-panel |
| REQ-28 | `batch-turn-panel/INT-1`, `INT-4` | turn-panel |
| REQ-29 | `batch-turn-panel/INT-1`, `INT-12` | turn-panel |
| REQ-30 | `batch-turn-panel/INT-1`, `INT-12` | turn-panel |
| REQ-31 | `batch-turn-panel/INT-2`, `INT-12` | turn-panel |
| REQ-32 | `batch-turn-panel/INT-3`, `INT-10` | turn-panel |
| REQ-33 | `batch-turn-panel/INT-4`, `INT-10` | turn-panel |
| REQ-34 | `batch-turn-panel/INT-3`, `INT-10` | turn-panel |
| REQ-35 | `batch-turn-panel/INT-4`, `INT-10` | turn-panel |
| REQ-36 | `batch-turn-panel/INT-4`, `INT-10` | turn-panel |
| REQ-37 | `batch-turn-panel/INT-2`, `INT-12` | turn-panel |
| REQ-38 | `batch-turn-panel/INT-2`, `INT-12` | turn-panel |
| REQ-39 | `batch-turn-panel/INT-3`, `INT-12` | turn-panel |
| REQ-40 | `batch-turn-panel/INT-4`, `INT-11` | turn-panel |
| REQ-41 | `batch-turn-panel/INT-4`, `INT-11` | turn-panel |
| REQ-42 | `batch-turn-panel/INT-13` | turn-panel |
| REQ-43 | `batch-turn-panel/INT-5`, `INT-8` | turn-panel |
| REQ-44 | `batch-turn-panel/INT-4`, `INT-10` | turn-panel |
| REQ-45 | `batch-turn-panel/INT-5`, `INT-13` | turn-panel |
| REQ-46 | `batch-turn-panel/INT-12` | turn-panel |
| REQ-47 | `batch-turn-panel/INT-9`, `INT-11`, `INT-13` | turn-panel |
| REQ-48 | `batch-turn-panel/INT-11`, `INT-14`, `INT-15` | turn-panel |
| REQ-49 | `batch-subagent-conversation/INT-1`, `INT-2`, `INT-3`, `INT-5`, `INT-8`, `INT-9` | subagent-conversation |
| REQ-50 | `batch-subagent-conversation/INT-1`, `INT-4`, `INT-6`, `INT-7`, `INT-8` | subagent-conversation |
| REQ-51 | `batch-subagent-conversation/INT-3`, `INT-6` | subagent-conversation |
| REQ-52 | `batch-subagent-conversation/INT-3` | subagent-conversation |
| REQ-53 | `batch-subagent-conversation/INT-10` | subagent-conversation |
| REQ-54 | `batch-subagent-conversation/INT-8`, `INT-10` | subagent-conversation |
| REQ-55 | `batch-subagent-conversation/INT-8`, `INT-9`, `INT-10` | subagent-conversation |
| REQ-56 | `batch-workflow-subagents/INT-1`, `INT-3`, `INT-5`, `INT-6` | workflow-subagents |
| REQ-57 | `batch-workflow-subagents/INT-1`, `INT-5`, `INT-6` | workflow-subagents |
| REQ-58 | `batch-workflow-subagents/INT-1`, `INT-4`, `INT-5`, `INT-6` | workflow-subagents |
| REQ-59 | `batch-workflow-subagents/INT-2` | workflow-subagents |
| REQ-60 | `batch-workflow-subagents/INT-3`, `INT-4`, `INT-5` | workflow-subagents |

Every INT serves at least one REQ. There is no enabling intervention.

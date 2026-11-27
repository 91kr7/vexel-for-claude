---
status: validated
---

# Batches — Turn panel with subagents only, as a list

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [subagents-only](batches/batch-subagents-only.md) | Turn panel with subagents only | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 | — | certified | The panel shows only the subagents of the turn, in start order |
| [subagent-list](batches/batch-subagent-list.md) | Subagents as a list | REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | subagents-only | todo | The subagents show as a list, with a group joined on the left |

Execution order: `subagents-only`, then `subagent-list`.

## Assumptions and decisions

- **One batch per feature.** `subagents-only` has no dependency: `plan-session_activity` is merged on `main`. `subagent-list` depends on `subagents-only`, which is certified and merged on `main`.
- **No new component.** `subagents-only` changes three components of the module `activity`: `turnTreeOf`, useTurn and TurnTreeView. The specs of TurnRoute and TurnPanel change with no code change (`batch-subagents-only`, "Decisions").
- **`subagent-list`: no new component.** It changes SubagentCard and TurnTreeView. For the groups of earlier turns it also changes TurnModel, `turnTreeOf` and useTurn. The specs of TurnRoute and TurnPanel change with no code change (`batch-subagent-list`, "Decisions").
- **The tree stops carrying the main steps. Gatekeeper decision, 2026-11-27.** The reason is in `batch-subagents-only`, "Decisions".
- **Gatekeeper decisions of 2026-11-27.** They are in `requirements.md`, "Assumptions". The two of `subagent-list` (line and ticks, any depth) are also in `batch-subagent-list`, "Decisions", with a third one: the groups of earlier turns.
- **Replaced requirements of `plan-session_activity`.** They are in `requirements.md`, "Constraints on the whole plan". `subagent-list` changes `plan-session_activity/REQ-37`.
- **Tests and Electron.** Tests are the tester's work. No automatic cycle runs the Electron group (each batch file, "Tests" and "No Electron run").
- **Technical debt.** The register has no open item, so no batch closes one.

## Departures

None. No human decision contradicts the spec.

## Coverage check

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-subagents-only/INT-1`, `INT-2`, `INT-4`, `INT-5` | subagents-only |
| REQ-2 | `batch-subagents-only/INT-3`, `INT-5` | subagents-only |
| REQ-3 | `batch-subagents-only/INT-3`, `INT-5` | subagents-only |
| REQ-4 | `batch-subagents-only/INT-7` | subagents-only |
| REQ-5 | `batch-subagents-only/INT-6` | subagents-only |
| REQ-6 | none | subagents-only |
| REQ-7 | none | subagents-only |
| REQ-8 | `batch-subagent-list/INT-1`, `INT-2` | subagent-list |
| REQ-9 | `batch-subagent-list/INT-1`, `INT-2` | subagent-list |
| REQ-10 | `batch-subagent-list/INT-3`, `INT-5`, `INT-6`, `INT-7` | subagent-list |
| REQ-11 | `batch-subagent-list/INT-3` | subagent-list |
| REQ-12 | `batch-subagent-list/INT-3`, `INT-5`, `INT-6`, `INT-7` | subagent-list |
| REQ-13 | `batch-subagent-list/INT-1`, `INT-4` | subagent-list |

- Every INT of both batches serves at least one REQ. There is no enabling intervention.
- Every REQ closes in one batch. No REQ spans two batches.
- REQ-6 and REQ-7 have no INT. The existing code already meets them, and the batch does not change it (`batch-subagents-only`, "Decisions"). They stay in the batch so that its tests check them after the change. They are the only exception to the rule "every REQ has at least one INT". Gatekeeper decision, 2026-11-27: accepted, as regression checks for the tester.

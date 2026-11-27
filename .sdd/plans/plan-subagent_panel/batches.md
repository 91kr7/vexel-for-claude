---
status: validated
---

# Batches — Subagents panel: running subagents only, as a list

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [subagents-only](batches/batch-subagents-only.md) | Turn panel with subagents only | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 | — | certified | The panel shows only the subagents of the turn, in start order |
| [subagent-list](batches/batch-subagent-list.md) | Subagents as a list | REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | subagents-only | implemented | The subagents show as a list, with a group joined on the left |
| [running-subagents](batches/batch-running-subagents.md) | Running subagents only | REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22 | subagent-list | todo | The panel lists the subagents running now, of any turn |

Execution order: `subagents-only`, then `subagent-list`, then `running-subagents`.

## Assumptions and decisions

- **One batch per feature.** `subagents-only` has no dependency: `plan-session_activity` is merged on `main`. `subagent-list` depends on `subagents-only`, which is certified and merged on `main`. `running-subagents` depends on `subagent-list`: it changes the code that batch left, in `turnTreeOf`, useTurn and TurnTreeView.
- **No new component.** `subagents-only` changes three components of the module `activity`: `turnTreeOf`, useTurn and TurnTreeView. The specs of TurnRoute and TurnPanel change with no code change (`batch-subagents-only`, "Decisions").
- **`subagent-list`: no new component.** It changes SubagentCard and TurnTreeView. For the groups of earlier turns it also changes TurnModel, `turnTreeOf` and useTurn. The specs of TurnRoute and TurnPanel change with no code change (`batch-subagent-list`, "Decisions").
- **`running-subagents`: no new component.** It changes `turnTreeOf`, useTurn, TurnTreeView, TurnPanel, TurnPanelButton and SubagentConversation. TurnModel, ActivityMonitor and TurnRoute keep their code (`batch-running-subagents`, "Decisions").
- **The tree stops carrying the main steps. Gatekeeper decision, 2026-11-27.** The reason is in `batch-subagents-only`, "Decisions".
- **Gatekeeper decisions of 2026-11-27.** They are in `requirements.md`, "Assumptions". The two of `subagent-list` (line and ticks, any depth) are also in `batch-subagent-list`, "Decisions", with a third one: the groups of earlier turns. The one of `running-subagents` (a subagent whose parent ended) is also in `batch-running-subagents`, "Decisions", with two more: the bar of an ended subagent and the text of `unavailable`.
- **Replaced requirements.** They are in `requirements.md`, "Constraints on the whole plan". `subagent-list` changes `plan-session_activity/REQ-37`. `running-subagents` replaces REQ-2, REQ-4, REQ-5, REQ-6, REQ-7 and REQ-12 of this plan, and some REQs of `plan-session_activity`.
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
| REQ-14 | `batch-running-subagents/INT-1`, `INT-2`, `INT-5` | running-subagents |
| REQ-15 | `batch-running-subagents/INT-2`, `INT-4`, `INT-5`, `INT-6`, `INT-8`, `INT-9` | running-subagents |
| REQ-16 | `batch-running-subagents/INT-1` | running-subagents |
| REQ-17 | `batch-running-subagents/INT-3` | running-subagents |
| REQ-18 | `batch-running-subagents/INT-1` | running-subagents |
| REQ-19 | `batch-running-subagents/INT-1`, `INT-10` | running-subagents |
| REQ-20 | `batch-running-subagents/INT-6`, `INT-9` | running-subagents |
| REQ-21 | `batch-running-subagents/INT-7`, `INT-8` | running-subagents |
| REQ-22 | `batch-running-subagents/INT-11`, `INT-12` | running-subagents |

- Every INT of the three batches serves at least one REQ. There is no enabling intervention.
- Every REQ closes in one batch. No REQ spans two batches.
- REQ-2, REQ-4, REQ-5, REQ-6, REQ-7 and REQ-12 stay closed in their batches. From `running-subagents` on, REQ-14, REQ-15, REQ-18, REQ-19 and REQ-20 replace them, and the tests of that batch check the new REQs.
- REQ-18 has one INT: `batch-running-subagents/INT-1` keeps the ended members out of the groups, and the line rule of TurnTreeView already gives no line to a group of one row.
- REQ-22: TurnPanel already keeps the conversation open when its subagent ends. `batch-running-subagents/INT-11` and `INT-12` keep its bar from showing a wrong "Running".
- REQ-6 and REQ-7 have no INT. The existing code already meets them, and the batch does not change it (`batch-subagents-only`, "Decisions"). They stay in the batch so that its tests check them after the change. They are the only exception to the rule "every REQ has at least one INT". Gatekeeper decision, 2026-11-27: accepted, as regression checks for the tester.

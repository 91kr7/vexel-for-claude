---
status: validated
---

# Batches — Turn panel with subagents only

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [subagents-only](batches/batch-subagents-only.md) | Turn panel with subagents only | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 | — | implemented | The panel shows only the subagents of the turn, in start order |

Execution order: `subagents-only`.

## Assumptions and decisions

- **One batch.** The spec has one feature. The batch has no dependency: `plan-session_activity` is merged on `main`.
- **No new component.** The batch changes three components of the module `activity`: `turnTreeOf`, useTurn and TurnTreeView. The specs of TurnRoute and TurnPanel change with no code change (`batch-subagents-only`, "Decisions").
- **The tree stops carrying the main steps. Gatekeeper decision, 2026-11-27.** The reason is in `batch-subagents-only`, "Decisions".
- **Gatekeeper decisions of 2026-11-27.** They are in `requirements.md`, "Assumptions".
- **Replaced requirements of `plan-session_activity`.** They are in `requirements.md`, "Constraints on the whole plan".
- **Tests and Electron.** Tests are the tester's work. No automatic cycle runs the Electron group (`batch-subagents-only`, "Tests" and "No Electron run").
- **Technical debt.** The register has no open item, so the batch closes none.

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

- Every INT serves at least one REQ. There is no enabling intervention.
- REQ-6 and REQ-7 have no INT. The existing code already meets them, and the batch does not change it (`batch-subagents-only`, "Decisions"). They stay in the batch so that its tests check them after the change. They are the only exception to the rule "every REQ has at least one INT". Gatekeeper decision, 2026-11-27: accepted, as regression checks for the tester.

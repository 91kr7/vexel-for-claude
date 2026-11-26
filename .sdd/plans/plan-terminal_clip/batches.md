---
status: validated
---

# Batches — Terminal last column still cut at the right edge

Requirements → `requirements.md`. Batch files → `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| terminal-width | Terminal width | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12 | — | todo | The user starts the desktop app and reads every last character whole |

Execution order: terminal-width, the only batch.

## Assumptions and decisions

- **One batch.** The spec has one feature. Every code change touches SessionView, module sessions.
- **No new component.** The batch only changes SessionView.
- **Cause first.** The batch starts with a reproduction on the current code, a throwaway check of the developer that is never committed. With no reproduced cause, or a cause outside SessionView, the batch stops and reports. The rule and the candidate causes are in the batch file, "Before any change".
- **Tests by the tester only.** The developer writes no test file. The tester turns the reproduction into the regression e2e of the default browser group (gatekeeper decision, as in `plan-git_explorer` and `plan-session_activity`).
- **Tests that show the cut.** The new tests must fail on the code before the fix, with a tolerance of at most 1 device pixel (spec, "Risks"). The details are in the batch file, "Tests".
- **Electron tests.** The desktop start (REQ-12) and maximize and restore (REQ-5, REQ-11) run in the Electron group only, written by the tester (knowledge base `electron-e2e-separate`).
- **Technical debt.** `.sdd/tech-debt.md` has no open item about this defect (spec, "Reference"), so the batch closes none.

## Departures

None.

## Coverage check

Every REQ → at least one INT. Every REQ closes in terminal-width. No REQ spans two batches.

| REQ | Batch | INT |
|-----|-------|-----|
| REQ-1 | terminal-width | INT-1 |
| REQ-2 | terminal-width | INT-1 |
| REQ-3 | terminal-width | INT-1 |
| REQ-4 | terminal-width | INT-1 |
| REQ-5 | terminal-width | INT-1, INT-2 |
| REQ-6 | terminal-width | INT-1 |
| REQ-7 | terminal-width | INT-1 |
| REQ-8 | terminal-width | INT-1 |
| REQ-9 | terminal-width | INT-1 |
| REQ-10 | terminal-width | INT-1 |
| REQ-11 | terminal-width | INT-2 |
| REQ-12 | terminal-width | INT-2 |

Every INT serves at least one REQ. There is no enabling intervention.

If the reproduction finds no cut after a series of size changes, INT-2 changes no code. REQ-11 and REQ-12 then close on their tests alone.

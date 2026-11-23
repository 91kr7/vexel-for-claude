---
status: validated
---

# Batches — Terminal text cut at the right edge

Requirements → `requirements.md`. Batch files → `batches/`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| terminal-width | Terminal width | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10 | — | implemented | The user restores the window and reads every line to its end |

Execution order: terminal-width, the only batch.

## Assumptions and decisions

- **One batch.** The spec has one feature. Every intervention touches SessionView, module sessions.
- **No new component.** The batch changes only the fit of SessionView. The server and AppLayout do not change.
- **Technical decisions.** They are in the batch file, "Decisions", because the implementer reads only that file.
- **Tests of the window buttons (REQ-6).** Maximize and restore run in the Electron e2e group only (knowledge base `electron-e2e-separate`). Everything else runs in Vitest or in the browser e2e.
- **Technical debt.** `.sdd/tech-debt.md` has no open item about this defect, so the batch closes none.

## Departures

None.

## Coverage check

Every REQ → at least one INT. Every REQ closes in terminal-width. No REQ spans two batches.

| REQ | Batch | INT |
|-----|-------|-----|
| REQ-1 | terminal-width | INT-1 |
| REQ-2 | terminal-width | INT-1 |
| REQ-3 | terminal-width | INT-1, INT-2, INT-3 |
| REQ-4 | terminal-width | INT-1, INT-2 |
| REQ-5 | terminal-width | INT-1, INT-2 |
| REQ-6 | terminal-width | INT-1, INT-2 |
| REQ-7 | terminal-width | INT-1, INT-2 |
| REQ-8 | terminal-width | INT-1 |
| REQ-9 | terminal-width | INT-1, INT-2, INT-3 |
| REQ-10 | terminal-width | INT-1 |

Every INT serves at least one REQ. There is no enabling intervention.

---
status: validated
---

# Batches — Favorite session

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [favorite](batches/batch-favorite.md) | Favorite session | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13 | — | certified | The user marks a session as favorite from the list |

Execution order: `favorite`.

## Assumptions and decisions

- **One batch.** The spec has one feature. No foundation batch is needed.
- **New components.** The batch names four in "What this batch builds": the favorite store, the favorite route, the favorite indicator and the favorite button. All are in the sessions area.
- **Same design as the name.** The mark follows the Claude Code session id, like the name of `plan-session_list_improvements/batch-rename`. So it survives Resume (REQ-7) and Dismiss (REQ-10). The details are in the "Decisions" of the batch file.
- **Live update (REQ-8).** It covers the session list. The history dialog shows the current mark when it opens. Gatekeeper decision, 2026-11-11.
- **No desktop change, no Electron e2e.** Knowledge base `electron-e2e-separate`. The data folder of the e2e server already exists in `playwright.config.ts`.
- **REQ-10 closes without its own code.** It follows from the store being separate from the tracker (INT-1, INT-5). The batch lists a test for it.

## Departures

None. No human decision contradicts the spec.

## Coverage check

Every REQ is served by at least one INT, and closes in the batch `favorite`.

| REQ | INT | Closes in |
|-----|-----|-----------|
| REQ-1 | `batch-favorite/INT-6`, `INT-7`, `INT-10`, `INT-12` | favorite |
| REQ-2 | `batch-favorite/INT-4`, `INT-6`, `INT-12` | favorite |
| REQ-3 | `batch-favorite/INT-2`, `INT-4`, `INT-8`, `INT-9`, `INT-12` | favorite |
| REQ-4 | `batch-favorite/INT-5`, `INT-8`, `INT-9`, `INT-13` | favorite |
| REQ-5 | `batch-favorite/INT-1`, `INT-5`, `INT-6`, `INT-10` | favorite |
| REQ-6 | `batch-favorite/INT-1`, `INT-7` | favorite |
| REQ-7 | `batch-favorite/INT-2`, `INT-3` | favorite |
| REQ-8 | `batch-favorite/INT-2`, `INT-4`, `INT-11`, `INT-12` | favorite |
| REQ-9 | `batch-favorite/INT-2`, `INT-4`, `INT-12` | favorite |
| REQ-10 | `batch-favorite/INT-1`, `INT-5` (implicit, see above) | favorite |
| REQ-11 | `batch-favorite/INT-8`, `INT-9`, `INT-13` | favorite |
| REQ-12 | `batch-favorite/INT-9`, `INT-10` | favorite |
| REQ-13 | `batch-favorite/INT-10`, `INT-12` | favorite |

Every INT serves at least one REQ. No enabling intervention.

---
slug: update_check
date: 2026-11-12
spec: .sdd/analysis/update_check.md
status: validated
---

# Batches — update_check

Requirements: `requirements.md`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [newer-version-notice](batches/batch-newer-version-notice.md) | Newer version notice | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12 | — | implemented | The user sees that a newer version exists |

Execution order: newer-version-notice (single batch).

## Assumptions and decisions

The technical decisions live in the batch file, section "Decisions for this batch". This list gives their origin.

- **Gatekeeper decisions:**
  - Closing the notice holds only in the open page.
  - Versions compare as semantic versions, with the leading `v` ignored.
  - The notice is a non-blocking box with English text and the look of the existing UI.
  - No test calls the real GitHub. The release source is replaceable (batch-newer-version-notice/INT-4, INT-8).
- **Planner decisions, accepted by the gatekeeper:**
  - The check runs in the server, once at its start. A desktop app that reuses a server already running shows the result of that server's start, and runs no new check. In practice the desktop app reuses a server only when `npm start` already runs.
  - The installed version and the repository come from `package.json`.
  - The look follows the NeedsInputSnackbar.
  - The GUI text is set in the batch file.
- **Desktop app.** No desktop code changes. The window already sends `http`/`https` links to the system browser. Following the knowledge base entry `electron-e2e-separate`, Electron e2e tests go in the Electron group only.

## Departures

None.

## Coverage check

batch-newer-version-notice:

| REQ | INT |
|-----|-----|
| REQ-1 | INT-2, INT-4 |
| REQ-2 | INT-3, INT-4 |
| REQ-3 | INT-2 |
| REQ-4 | INT-1, INT-7 |
| REQ-5 | INT-6 |
| REQ-6 | INT-6 |
| REQ-7 | INT-6, INT-7 |
| REQ-8 | INT-7 |
| REQ-9 | INT-2, INT-3, INT-5 |
| REQ-10 | INT-4, INT-7 |
| REQ-11 | INT-4, INT-5 |
| REQ-12 | INT-2 |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ, except INT-8. INT-8 is the enabling intervention: it keeps every e2e run away from GitHub.
- Every REQ closes in the single batch newer-version-notice.

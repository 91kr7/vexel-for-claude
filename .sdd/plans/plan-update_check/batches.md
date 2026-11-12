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
| [newer-version-notice](batches/batch-newer-version-notice.md) | Newer version notice | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12 | — | certified | The user sees that a newer version exists |
| [installed-version](batches/batch-installed-version.md) | Installed version in the top bar | REQ-13, REQ-14, REQ-15 | newer-version-notice | todo | The user sees the installed version in the top bar |

Execution order: newer-version-notice, then installed-version.

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
- **Batch installed-version** (decisions in its batch file):
  - Gatekeeper decision: REQ-14 asks for the same version number, not the same form. The top bar shows `v0.2.2`, the notice keeps "You have 0.2.2.". The certified batch does not change.
  - Gatekeeper decision: no test calls the real GitHub. The e2e setting of batch-newer-version-notice/INT-8 already covers it.
  - Planner decision: the top bar reads the installed version from a new local route of the server, not from a value fixed in the frontend build. The server gives the same value to the release check, so the two numbers cannot differ. A value fixed at build time would show an old number when `dist/web` is older than `package.json`.
  - The installed version is right only if each release sets `version` in `package.json` (knowledge base entry `release-bumps-package-version`).

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
- REQ-1 to REQ-12 close in batch newer-version-notice.

batch-installed-version:

| REQ | INT |
|-----|-----|
| REQ-13 | INT-3, INT-4 |
| REQ-14 | INT-1, INT-2 |
| REQ-15 | INT-1, INT-2, INT-3 |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. No enabling intervention.
- REQ-13, REQ-14 and REQ-15 close in batch installed-version. REQ-14 also relies on the notice of batch newer-version-notice, already certified.

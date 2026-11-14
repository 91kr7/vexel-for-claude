---
slug: release_changelog
date: 2026-11-14
spec: .sdd/analysis/release_changelog.md
status: validated
---

# Batches — release_changelog

Requirements: `requirements.md`.

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [release-instruction](batches/batch-release-instruction.md) | Changelog instruction for releases | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6 | — | certified | A requested release carries a changelog |
| [notice-changelogs](batches/batch-notice-changelogs.md) | Changelogs in the newer version notice | REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17 | — | certified | The user reads what changed in the missing versions |

Execution order: release-instruction, then notice-changelogs. The two batches do not depend on each other. The first one sets the markup subset that the second one renders.

## Assumptions and decisions

The technical decisions live in the batch files, section "Decisions for this batch". This list gives their origin.

- **Gatekeeper decisions:**
  - REQ-4 and REQ-6 come from the analysis Assumptions. REQ-15 and REQ-17 keep constraints the notice already has under `plan-update_check`.
- **Assumption: no images in the notice.** Images in a release description are left out. The notice loads no remote content and shows only text and links. Reason: it touches less, and the analysis asks for readable text (Requirements, Functional).
- **Planner decisions:**
  - The changelogs come from the GitHub release list, read by the server after a `newer` release check. The release check itself does not change (analysis, Scope).
  - The release list address comes from the release check address. The existing e2e setting of `AI_CLIENT_RELEASE_SOURCE_URL` keeps the new request away from GitHub too.
  - The client renders a small markup subset by itself, with no new dependency. The `CLAUDE.md` of batch release-instruction asks for that subset. Older or hand-written descriptions with other markup show that markup as plain text.
  - The notice keeps its width of at most 320 px. Only its height grows, up to the window, with a scroll area.
- **Desktop app.** No desktop code changes. The window already sends `http`/`https` links to the system browser.

## Departures

None.

## Coverage check

batch-release-instruction:

| REQ | INT |
|-----|-----|
| REQ-1 | INT-1 |
| REQ-2 | INT-1 |
| REQ-3 | INT-1 |
| REQ-4 | INT-1 |
| REQ-5 | INT-1 |
| REQ-6 | INT-1 |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. No enabling intervention.
- REQ-1 to REQ-6 close in batch release-instruction.

batch-notice-changelogs:

| REQ | INT |
|-----|-----|
| REQ-7 | INT-1, INT-2, INT-3, INT-4, INT-5, INT-7 |
| REQ-8 | INT-2, INT-7 |
| REQ-9 | INT-6, INT-7 |
| REQ-10 | INT-6 |
| REQ-11 | INT-6 |
| REQ-12 | INT-8 |
| REQ-13 | INT-1, INT-2, INT-7 |
| REQ-14 | INT-3, INT-5, INT-7 |
| REQ-15 | INT-3, INT-7 |
| REQ-16 | INT-3 |
| REQ-17 | INT-2 |

- Every REQ is served by at least one INT.
- Every INT serves at least one REQ. No enabling intervention.
- REQ-7 to REQ-17 close in batch notice-changelogs.

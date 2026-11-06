---
status: validated
---

# Batches — Light theme with a Light/Dark switch

| Batch | Feature | REQ closed | Depends | Status | Human acceptance |
|-------|---------|------------|---------|--------|------------------|
| [light-theme](batches/batch-light-theme.md) | Light theme | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16 | — | implemented | The user switches the client to the light theme |
| [remembered-theme](batches/batch-remembered-theme.md) | Remembered theme | REQ-17, REQ-18, REQ-19, REQ-20 | light-theme | todo | The client keeps the dark theme the user chose |

## Assumptions and decisions

- **Two batches, one per feature.** The switch belongs to `light-theme`. Without the light theme it does nothing visible, and without it the user cannot reach the light theme (`requirements.md`, "Assumptions").
- **Start theme between the batches.** After `light-theme` alone, the client starts dark, as today. `remembered-theme` adds the saved choice and the light default. Both batches merge together, so the human decision on the light default holds at the end of the plan.
- **One mark on the page root.** The light set overrides the dark tokens under that mark. Components keep their token names and do not change for colour, except SessionView for the terminal (batch `light-theme`, "Decisions").
- **Choice in `localStorage`.** Per browser and per desktop window, with no backend change (batch `remembered-theme`, "Decisions").
- **No desktop change for restarts.** Electron keeps the page's `localStorage` between launches. Only the startup page changes in the desktop area.
- **Electron e2e group.** The desktop checks of `remembered-theme` go in `npm run test:e2e:desktop`, not in the default e2e run (knowledge base `electron-e2e-separate`).
- **Earlier plans.** `plan-claude_sessions_client-ui_redesign-material3_mock-studio_dark/REQ-1` and `/REQ-2` now hold for the dark theme only (`requirements.md`, "Constraints"). The rule "dark Studio colours" of the desktop startup page (`plan-desktop_app`, batch `desktop-window`, "Decisions") is replaced by REQ-20.

## Departures

- **Light on first start (REQ-19).** Departing from the spec, human decision (2026-11-06). The spec says the client starts dark with no remembered choice (`.sdd/analysis/light_theme.md`, line 60). The human chose light. The spec must be corrected.
- **Startup page always light (REQ-20).** This is a human decision of 2026-11-06 that the spec does not cover. It is not a contradiction, but the spec should record it next to line 60.

## Coverage check

Every REQ is served by at least one INT, and every INT serves at least one REQ. No intervention is enabling only. Each REQ closes in one batch.

| REQ | Closes in | INT |
|-----|-----------|-----|
| REQ-1 | light-theme | INT-11 |
| REQ-2 | light-theme | INT-9, INT-10 |
| REQ-3 | light-theme | INT-8, INT-10 |
| REQ-4 | light-theme | INT-8 |
| REQ-5 | light-theme | INT-10 |
| REQ-6 | light-theme | INT-1 |
| REQ-7 | light-theme | INT-1 |
| REQ-8 | light-theme | INT-1 |
| REQ-9 | light-theme | INT-3 |
| REQ-10 | light-theme | INT-1 |
| REQ-11 | light-theme | INT-7 |
| REQ-12 | light-theme | INT-5, INT-6 |
| REQ-13 | light-theme | INT-1, INT-7 |
| REQ-14 | light-theme | INT-2, INT-3, INT-4 |
| REQ-15 | light-theme | INT-3 |
| REQ-16 | light-theme | INT-4 |
| REQ-17 | remembered-theme | INT-2 |
| REQ-18 | remembered-theme | INT-1 |
| REQ-19 | remembered-theme | INT-1 |
| REQ-20 | remembered-theme | INT-3 |

INT ids are local to their batch: INT-1 to INT-11 are in `batch-light-theme`, INT-1 to INT-3 in `batch-remembered-theme`.

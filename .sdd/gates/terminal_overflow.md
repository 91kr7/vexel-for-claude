# Gates — terminal_overflow

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-23 | analyse | question analyst | decided | Fix, own file with reference `terminal_addons.md` line 66; precedent `session_list_width.md`, KB `short-request-slugs` |
| 2026-11-23 | analyse | question analyst | decided | Trigger unknown: every space-changing situation covered; desktop on Ubuntu, browser client kept |
| 2026-11-23 | analyse | G1 analysis | pass | narrow, 63/80 lines; no placeholders, no technical choices |
| 2026-11-23 | plan | question planner | decided | Q1 trigger unknown: every situation covered; source spec "Assumptions" |
| 2026-11-23 | plan | question planner | decided | Q2 "inside the panel" keeps the 16 px margin free; source `plan-ui_restyle/REQ-34`, spec "Reference" |
| 2026-11-23 | plan | G2 requirements | pass | REQ-1..10 cover every spec requirement; one REQ per independent situation |
| 2026-11-23 | plan | G3 coverage | pass | 1 batch, 3 INT on `SessionView.tsx` (exists); REQ lists consistent; every REQ in a scenario |
| 2026-11-23 | plan | G3 coverage | pass | Planner note: SessionView spec 12 px gap/padding vs `plan-ui_restyle/REQ-34` 16 px; outside the perimeter, no change |
| 2026-11-23 | dev | G4 terminal-width | pass | Build green (re-run); diff = `SessionView.tsx` + spec `session-view.md`; no tests, no plan files |
| 2026-11-23 | dev | G4 terminal-width | decided | Own fit replaces FitAddon (INT-1: measure on the panel); private `_renderService` as FitAddon reads it; no visible change |
| 2026-11-23 | dev | G4 terminal-width | decided | `@xterm/addon-fit` now unused, kept in `package.json`: removal outside the batch; human to review |
| 2026-11-23 | dev | G4 terminal-width | pass | Leaving view may send one `resize` when a resize lands during the fade: pre-existing, unchanged by the batch |
| 2026-11-23 | dev | G5 terminal-width | pass | Diff = tests and test infra only; no disabled tests; REQ-1..10 each tested |
| 2026-11-23 | dev | G5 terminal-width | pass | Re-run green: 44 unit (SessionView), 11 e2e `terminal-width.spec.ts`; tester closing run 4450 unit, 1050/1051 e2e, Electron 1/1 |
| 2026-11-23 | dev | G5 terminal-width | pass | `tab-change-transitions.spec.ts:353` (Settings, 300 ms limit) failed under full load only: 5/5 on branch, 5/5 on main; no terminal involved |
| 2026-11-24 | closing | flaky `tab-change-transitions.spec.ts:353` | human decision | Human: load failures must not remain after the timeout raise; limit now `SLOW_MS / 2`; KB `e2e-load-proof-time-limits` |
| 2026-11-24 | closing | same class, `project-search.spec.ts:187`, `cascading-lists-transitions.spec.ts:174` | decided | Median of the slowest letter per round; cascade fails only on a frame that proves the overrun; 48/48 green at 3 workers |

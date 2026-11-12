# Gates — recent_projects

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-12 | analysis | question analyst Q1 | decided | Evolution: the request adds a rail function and corrects nothing in `claude_sessions_client.md` |
| 2026-11-12 | analysis | question analyst Q2 | human decision | List = every Claude Code project folder on the machine, terminal-only use included (same source as "Recenti") |
| 2026-11-12 | analysis | question analyst Q3 | human decision | Choosing a project asks for the session name, then starts the session |
| 2026-11-12 | analysis | question analyst Q4 | decided | Removing a project is out of scope: not in the request |
| 2026-11-12 | analysis | G1 analysis | pass | 84 lines vs ordinary budget 200; request verbatim; no placeholders; no technical choices |
| 2026-11-12 | analysis | mock panel vs dialog | decided | Mock `.sdd/mockups/recent_projects/mock.html`: list opens in the side column, the rail button is a view like Sessions; name prompt is a dialog |
| 2026-11-12 | plan | question planner Q1 | decided | Session count, folder count and start toast from the mock are not built: not in the analysis Requirements |
| 2026-11-12 | plan | G2 requirements | pass | REQ-1..24 cover the analysis; REQ-13/24 pair desktop+English per feature, accepted |
| 2026-11-12 | plan | G3 coverage | pass | 2 vertical batches, REQ-1..13 and REQ-14..24; modify paths exist; project-session-start/INT-6 points to the component batch project-list creates, accepted; every REQ in a scenario |
| 2026-11-12 | dev | G4 development project-list | pass | build green (rerun); diff limited to INT files, styles.css, specs, indexes |
| 2026-11-12 | dev | divergence Alt+L / Ctrl+Shift+L | decided | Shortcuts go back to the sessions view before focusing the list; keeps the existing shortcut contract |
| 2026-11-12 | dev | divergence panel label and avatar | decided | Panel label stays "Session List" (existing e2e, resize edge); neutral Avatar named by the plan, mock colors are sample data |
| 2026-11-12 | dev | question tester (first-open focus) | decided | Focus stays on "Projects" while the first load has no row: literal reading of batch-project-list/INT-7 and the AppLayout spec; minimal intervention |
| 2026-11-12 | dev | G5 tests project-list | pass | unit 113 and e2e project-list 9 green (rerun); tests and playwright.config only; studio-dark rail count updated to the new contract |
| 2026-11-12 | dev | G4 development project-session-start | pass | build green (rerun); diff limited to INT files, styles.css, specs, indexes |
| 2026-11-12 | dev | test file touched by developer | decided | start-session-route.test.ts: call line only, needed for `tsc -b` after the INT-3 signature change; no assertion changed |
| 2026-11-12 | dev | divergence side view after start | decided | Side column stays on Projects after a start, as in mock step 3; the session is in the session list |
| 2026-11-12 | dev | G5 tests project-session-start (round 1) | sent back | Code defect: SessionNameDialog `maxLength` counts UTF-16 units, spec and REQ-18 want 200 code points; to developer |
| 2026-11-12 | dev | regression visual-language.spec.ts:313 | escalated | Fails on main too (notices entry "npm dependencies" has no link); older than this cycle |
| 2026-11-12 | dev | regression external-sessions.spec.ts:127 | pass | Passes on main and twice on the branch alone; intermittent timeout |
| 2026-11-12 | dev | G4 development (fix round 1) | pass | build green (rerun); diff limited to SessionNameDialog.tsx and its spec |
| 2026-11-12 | dev | G5 tests (fix round 1) | sent back | 2 unit tests check `maxLength`, not the contract of the updated spec; to tester |
| 2026-11-12 | dev | regression visual-language.spec.ts:313 | human decision | "fixa": the check now covers only notice entries with shipped files; 14 passed |
| 2026-11-12 | dev | G5 tests (fix round 2) | pass | batch unit 45 and e2e 19 green; tests only; no maxLength check left |
| 2026-11-12 | closing | full suites rerun | pass | unit 2832 green (second run; 3 intermittent fails in the first run passed alone); e2e 588 passed, terminal-search.spec.ts:227 intermittent, passed alone |
| 2026-11-12 | closing | merge | pass | every batch certified; merged into main with --no-ff |

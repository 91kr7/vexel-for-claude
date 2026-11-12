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

# Gates — claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | startup | foreign change package.json | human decision | Uncommitted `start` PORT 4001→4004; human chose to discard it |
| 2026-11-06 | analysis | question analyst fix or evolution | decided | Evolution; studio_dark analysis line 42 made Italian a deliberate choice |
| 2026-11-06 | analysis | question analyst defaults | decided | English only, no switch; every user-facing text; mock English reused; 24-hour clock; text only |
| 2026-11-06 | analysis | G1 analysis | pass | narrow, 72/80 lines; scope traced to the request |
| 2026-11-06 | plan | stale e2e server on 3100 | human decision | PID 2058924 left running; tester rebuilds `dist/web` before every e2e run |
| 2026-11-06 | plan | question planner state names | decided | Running / Needs input / Idle / Ended / Error; mock names reused where they map one to one (analysis Assumptions, REQ-13) |
| 2026-11-06 | plan | question planner Claude name line | decided | "Claude"; analysis requirement on the name lines outranks the mock's "Claude Code" |
| 2026-11-06 | plan | question planner capitals | decided | Title Case for titles, buttons, labels, chips, states; sentence case for sentences and counters; mock idiom |
| 2026-11-06 | plan | G2 requirements | pass | REQ-8 and REQ-13 from analysis Assumptions; REQ-11 traced to "sees or hears" |
| 2026-11-06 | plan | planner correction REQ-2 / REQ-16 | pass | "Fallito" is a tool outcome (`ConversationView.tsx:110`), StateBadge has four states; analysis Requirements mislabel it |
| 2026-11-06 | plan | mock texts not used | decided | "Orchestrated Sessions" dropped for REQ-15 fit; Stop/Interrupt, Permission Required, empty state are different elements; for human review |
| 2026-11-06 | plan | `.archi` GUI language line | decided | Updated by the `english-ui` developer; batch decision, no INT |
| 2026-11-06 | plan | G3 coverage | pass | 16 REQ / 26 INT, one batch, paths exist, every REQ in a scenario |
| 2026-11-06 | dev | divergence INT-18, INT-14, INT-16, INT-26 | decided | No code needed: loading text from ProgressIndicator default (INT-8), accessible names are the visible text, no Italian left |
| 2026-11-06 | dev | divergence resume dialog date | decided | `en-GB` locale keeps the it-IT shape: day first, 24-hour, seconds (REQ-8) |
| 2026-11-06 | dev | G4 english-ui | pass | Build re-run green; diff = 20 INT sources + specs, indexes, `.archi`; no test or plan file; no Italian left in `src/web` |
| 2026-11-06 | test | G5 english-ui | pass | Unit 731, e2e 246 (tester, full suites); gatekeeper re-run of batch tests 30 + 7 + 5 green; tests only, no `.only`/`.skip`; REQ-12, REQ-16 in external specs |
| 2026-11-06 | closing | merge into main | pass | The only batch certified; no source change after the full run |

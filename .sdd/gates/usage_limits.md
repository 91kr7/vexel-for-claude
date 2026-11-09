# Gates — usage_limits

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-09 | analysis | question analyst | decided | Evolution, not fix; source `.sdd/analysis/session_usage.md` (plan limits out of scope) |
| 2026-11-09 | analysis | G1 analysis | pass | 82 lines, `ordinary`; 70/90% emphasis is a borderline addition tied to the request goal, flagged for human review |
| 2026-11-09 | plan | G2 requirements | pass | 18 REQs one-sentence, yes/no; REQ-14 beyond analysis, escalated |
| 2026-11-09 | plan | question planner (REQ-14) | human decision | Keep; analysis aligned with a line in Functional requirements |
| 2026-11-09 | plan | question planner (data source) | human decision | OAuth usage endpoint, token read-only from `<claudeDir>/.credentials.json` |
| 2026-11-09 | plan | question planner (refresh 60 s) | decided | Technical, no source; spec sets no interval and no setting |
| 2026-11-09 | plan | question planner (popover) | decided | Panel not modal, as REQ-4 forbids closing dialogs |
| 2026-11-09 | plan | G3 coverage | pass | 18 REQ covered by 15 INT, one batch, paths checked, 11 scenarios |
| 2026-11-09 | plan | decided | decided | Button after theme switch; failed refresh hides figures |
| 2026-11-09 | dev | question developer (answer shape) | decided | Use `limits` array of the real answer, fallback to keys; plan updated, REQ-7 and REQ-18 |
| 2026-11-09 | dev | question developer (labels) | decided | Labels as `/usage`; source requirements.md "Names", REQ-18 |
| 2026-11-09 | dev | question developer (scoped rows) | decided | Show every weekly_scoped row, 0% included; allowlist of CLI not reproducible; flagged for human review |
| 2026-11-09 | dev | G4 development | pass | Build green on re-run; diff only explained files; no test or plan file touched; token not logged |
| 2026-11-09 | test | question tester (stale top-bar e2e) | decided | Update two earlier top-bar tests to expect the new button; REQ-1, `top-bar.md` |
| 2026-11-09 | test | G5 tests, round 1 | sent back | Route 500 on synchronous reader throw (`plan-usage-route.ts`); 2 stale top-bar e2e |
| 2026-11-09 | dev | G4 development | pass | Fix limited to `plan-usage-route.ts`; no test or plan file touched |
| 2026-11-09 | test | G5 tests, round 2 | pass | Unit 2279/2279; e2e 529 pass, 1 flaky `terminal-search.spec.ts:227` under load, 3/3 alone; no only/skip added besides a root-only guard |

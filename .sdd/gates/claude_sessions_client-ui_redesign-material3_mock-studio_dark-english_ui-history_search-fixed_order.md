# Gates — claude_sessions_client-ui_redesign-material3_mock-studio_dark-english_ui-history_search-fixed_order

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst fix or evolution | decided | Evolution; movement specified in `claude_sessions_client.md` line 39 and `claude_sessions_client-ui_redesign-material3_mock.md` line 60 |
| 2026-11-06 | analysis | question analyst state groups | escalated | User-visible list structure: one list, groups kept, or two fixed groups |
| 2026-11-06 | analysis | question analyst state groups | human decision | Groups stay; order fixed inside each group |
| 2026-11-06 | analysis | question analyst keyboard reordering | escalated | Scope addition beyond the request (WCAG 2.5.7) |
| 2026-11-06 | analysis | question analyst keyboard reordering | human decision | Drag and drop only |
| 2026-11-06 | analysis | G1 analysis | pass | narrow, 68/80 lines; drop-outside-group, drag feedback, reload survival traced to the request |
| 2026-11-06 | plan | question planner REQ-5 unchanged order on reload | decided | Confirmed; follows from the analysis rule that only the user changes the order |
| 2026-11-06 | plan | question planner REQ-8 group change during drag | decided | Drop ignored; safe reading of the analysis Risks; for human review |
| 2026-11-06 | plan | question planner order storage | decided | Browser only; analysis asks for page reload only, local single-user tool; for human review |
| 2026-11-06 | plan | question planner first load | decided | Starts from today's activity order, then fixed; smallest change from current behaviour |
| 2026-11-06 | plan | G2 requirements | pass | 10 REQ cover the analysis; REQ-8 from Risks; REQ-9 kept apart from REQ-5 as the distinct after-drag path |
| 2026-11-06 | plan | question planner "Resume Here" new entry | decided | Not a departure: Resume Here always moves external → running, and the analysis Assumptions already put a session that changes group at the end |
| 2026-11-06 | plan | G3 coverage | pass | 10 REQ / 10 INT, two batches by feature, paths exist; `batch-drag-reorder/INT-1` path deferred to the store `batch-fixed-order/INT-3` creates; every REQ in a scenario |
| 2026-11-06 | dev | divergence `batch-fixed-order/INT-1` group rule not exported | decided | `nextSessionOrder` reuses `groupSessions`, same rule, no second public function |
| 2026-11-06 | dev | divergence SessionList `order` optional | decided | Keeps existing callers; no visible change |
| 2026-11-06 | dev | G4 fixed-order | pass | Build re-run green; diff = 5 INT sources + 4 specs, sessions index, status; no test or plan file |
| 2026-11-06 | dev | tester change `e2e/session-entries.spec.ts` | pass | Old activity-first assertions replaced by REQ-1, REQ-2; contract change of this plan |
| 2026-11-06 | dev | G5 fixed-order | pass | Re-run 65/65 unit, 14/14 e2e (`fixed-order`, `session-entries`); no source change, no skip or only; REQ-1..5 tested |

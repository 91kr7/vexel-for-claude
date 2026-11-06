# Gates — session_usage

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: `claude_sessions_client.md` line 163 left token and cost reports out of scope |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 110/200 lines; placement, occupancy formula, window size, warning levels and pricing are analyst defaults, kept |
| 2026-11-06 | plan | question planner Q1 | decided | REQ-4: fixed model table + "[1m]" marker, else 200k; REQ-5 fallback |
| 2026-11-06 | plan | question planner Q2 | decided | REQ-29: estimate label as tooltip in the list, as text in the header |
| 2026-11-06 | plan | question planner Q3 | decided | REQ-30: no known price → "—" with the incomplete mark, not "<$0.01" |
| 2026-11-06 | plan | question planner Q4 | decided | REQ-8: warning colour from 70%, error colour from 90% |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..35 in 3 features cover the spec |
| 2026-11-06 | plan | G3 coverage | pass | 3 chained batches, REQ-1..35 covered, all modify paths exist; SessionView untouched (parallel cycle); token parts in a popover to keep the header on one row |
| 2026-11-06 | dev | question developer Q1 | decided | Window table keeps only models seen at 1M on this machine (opus-5-5, sonnet-5-5); others default 200k with the REQ-5 fallback |
| 2026-11-06 | dev | G4 context-occupancy | pass | Build green (re-run); files map to INT-1..13; accepted: `more` flag on chunked reads (no climbing percentages at start), oversize line read whole, routes return summary copies |
| 2026-11-06 | test | G5 context-occupancy | pass | Re-run by gatekeeper: 5 batch files 50/50; tester 383 unit on 29 files (changed files and direct users), 29 e2e |
| 2026-11-06 | dev | G4 tokens-consumed | pass | Build green (re-run); files map to INT-1..7; three transcript facts checked read-only on real data; accepted: `subagentFilesOf` as module function, value held until subagent files are read; usage-monitor and usage-api tests must include `tokens` (INT-5) |

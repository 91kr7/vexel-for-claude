# Gates — git_explorer

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-10 | analysis | question analyst (fix or evolution) | decided | Evolution; `.sdd/analysis/claude_sessions_client.md` line 191 puts diff views out of scope |
| 2026-11-10 | analysis | G1 analysis | pass | 107 lines, `ordinary`; refresh at turn end and non-functional lines traced to "modifiche effettuate", flagged for human review |
| 2026-11-10 | plan | question planner (explorer shape) | human decision | Panel of the session page, header button, tabs Changes and History |
| 2026-11-10 | plan | question planner (refresh scope) | human decision | Same repository, not same folder; departure from spec "Refresh", REQ-25 |
| 2026-11-10 | plan | question planner (interrupted turn) | decided | Counts as a turn end for REQ-25 |
| 2026-11-10 | plan | question planner (untracked files) | decided | Unstaged group, kind "untracked", as `git status` groups them |
| 2026-11-10 | plan | G2 requirements | pass | 26 REQ cover the spec; REQ-26 traced to spec Risks |
| 2026-11-10 | plan | G3 coverage | pass | 26 REQ, 4 vertical batches in sequence, 37 INT; modify paths exist; lists match; every REQ in a scenario |

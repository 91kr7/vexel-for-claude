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
| 2026-11-10 | dev | G4 development, explorer-access | pass | Build green on re-run; diff only INT files, specs, indexes; no test or plan file touched |
| 2026-11-10 | dev | divergence INT-7 | decided | Button also shown on a git error, so REQ-6 can appear; REQ-2 holds for none and no git |
| 2026-11-10 | dev | divergence INT-11 | decided | Electron e2e spec goes to the tester |
| 2026-11-10 | test | G5 tests, explorer-access | pass | Re-run 70 unit, 8 e2e green; Electron 1 accepted from report; only test files and `playwright.config.ts` |
| 2026-11-10 | dev | G4 development, uncommitted-changes | sent back | Diff over 5 MB gives an error; `requirements.md` "Large content" asks a cut diff with a note |
| 2026-11-10 | dev | divergence GitRunner change | decided | New read commands and exit-code option needed; runner spec foresaw them |
| 2026-11-10 | dev | divergence no tab bar | decided | One tab only; `batch-history` INT-9 adds the tabs |
| 2026-11-10 | dev | G4 development, uncommitted-changes | pass | Over 5 MB now cut; note text "5,000 lines" inexact in that rare case, accepted, flagged for human review |

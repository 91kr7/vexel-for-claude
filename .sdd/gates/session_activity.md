# Gates — session_activity

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-26 | analysis | question analyst type | human decision | Evolution of `session_list_improvements.md`, asked through `/sdd-analyse` |
| 2026-11-26 | analysis | G1 analysis | pass | 160 lines, `ordinary`; no placeholders; analyst defaults listed to the human before the commit |
| 2026-11-26 | plan | question planner Q1 stall text | decided | Option A: spec examples, `session_activity.md` lines 60-63 |
| 2026-11-26 | plan | question planner Q2 subagent call | decided | The call that starts a subagent is not a running tool for the signal; the subagent's tools count (spec line 63, example "sdd-tester: mvn test") |
| 2026-11-26 | plan | question planner Q3 panel shape | decided | Same place as the git explorer, opening one closes the other: request "come il git explorer"; one panel slot, terminal not squeezed by two 50% panels |
| 2026-11-26 | plan | G2 requirements | pass | Every spec requirement covered by REQ-1..55 or a plan constraint; REQ-14/45 kept as the spec words them |
| 2026-11-26 | plan | question planner group rule | decided | Subagents started at the same step form one group; REQ-31 places each subagent at its step; Claude Code starts parallel subagents in one message |
| 2026-11-26 | plan | question planner "Task" items | decided | User items of a subagent conversation are written by the parent agent, so "Task", not "You" |
| 2026-11-26 | plan | G3 coverage | pass | 55 REQs covered, lists consistent, linear dependencies, acceptance covers every REQ; modify of components born in earlier batches names the module (no path yet); `turn-panel/INT-16` is a test spec, as `plan-git_explorer` INT-11: goes to the tester at dev time |
| 2026-11-26 | dev | G4 development, latest-text | pass | Build re-run green; 18 files, all explained by INT-1..16, specs and indexes; no test file; module `activity` indexed |
| 2026-11-26 | dev | divergences latest-text | decided | Accepted: stop notices of the main transcript mark a subagent stopped; later work clears an interrupt; turn start waits for the next read; metadata kept during rewrites. All refine INT-5/INT-9, no visible change beyond the REQs |
| 2026-11-26 | dev | question developer nested subagents | decided | Keep the open assumption: every file of `subagents/` is read; confirm with REQ-38 in `turn-panel` |
| 2026-11-26 | dev | question developer workflow subagents | escalated | `subagents/workflows/` holds 148 agent files of 6 runs (Nov 4-24); excluding them narrows "subagent compresi" |

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
| 2026-11-26 | dev | question developer workflow subagents | human decision | Include the subagents of Claude Code workflows (`subagents/workflows/wf_*/`) in this cycle, as a fifth batch |
| 2026-11-26 | plan | G2 requirements, workflow subagents | pass | REQ-56..60 cover the human decision; REQ-1..55 unchanged; REQ-60 apart for the end detection |
| 2026-11-26 | plan | question planner workflow type | decided | Show "workflow-subagent", the type Claude Code records (REQ-4 definition); the label shows as the task description in the panel |
| 2026-11-26 | plan | question planner turn-panel INT-16 | decided | Remove it: an e2e spec is the tester's work; REQ-48 served by turn-panel INT-11, INT-14, INT-15, tested by one Electron spec |
| 2026-11-26 | plan | G3 coverage, workflow-subagents | pass | REQ-56..60 covered and in scenarios; live workflow check made optional: the run rule must hold whether the journal is written during the run or at its end |
| 2026-11-26 | test | G5 tests, latest-text | pass | Re-run 547 unit (batch and dependants), 9 e2e green; only test files and `playwright.config.ts`; `session-cards.spec.ts:334` updated to the new line, contract in `session-list.md` |
| 2026-11-26 | dev | G4 development, stall-signal | pass | Build re-run green; files explained by INT-1..7, specs and indexes; `useNow` export of ElapsedTime follows the shared-timer decision |
| 2026-11-26 | dev | divergence stall-signal test stub | decided | `live-activity.test.ts`: two stubs on the fake model so `tsc -b` compiles after the INT-4 contract; no assertion changed; the tester updates the assertions |
| 2026-11-26 | dev | divergence stall-signal workflow calls | decided | A subagent with no `toolUseId` excludes no call; workflow subagents belong to batch `workflow-subagents` (REQ-57) |
| 2026-11-26 | test | G5 tests, stall-signal | pass | Re-run 575 unit, 15 e2e green; only test files and `playwright.config.ts`; thinking now counts as activity (batch decision), one monitor test follows it |
| 2026-11-26 | dev | G4 development, turn-panel | sent back | `subagentMetaOf` read `model`; real metadata keeps it in `pickedEffortModel` (40 files checked) |
| 2026-11-26 | dev | G4 development, turn-panel | pass | Build re-run green; files explained by INT-1..15, specs and indexes; one type stub in `live-activity.test.ts` |
| 2026-11-26 | dev | divergences turn-panel | decided | Accepted: extra pure component `turnTreeOf` (indexed); group under the last call of its run; subagent text of its whole run; 400-char tool argument; nested-link memory of 2,000 calls; texts "Turn not available.", "Show 1 earlier step" |
| 2026-11-26 | test | G5 tests, turn-panel | sent back | 1 red: `turn-model-steps.test.ts` "keeps the name and the argument of a call with no id"; spec `turn-model.md` line 69 drops only the outcome; diff holds test files and `playwright.config.ts` only |
| 2026-11-26 | dev | G4 fix, turn-panel | pass | `turn-model.ts` takes the input from the call's own block; spec line updated; build green; no test file |
| 2026-11-26 | test | G5 tests, turn-panel | pass | Re-test after f5be575: 618 unit, 12 browser e2e green, Electron 1 from report; one intermittent API test of `latest-text` fixed in its fixture (turn start and subagent line in the same millisecond), 17 runs green under load |
| 2026-11-26 | dev | G4 development, subagent-conversation | pass | Build re-run green; files explained by INT-1..10, specs and indexes; no test file touched |
| 2026-11-26 | dev | divergences subagent-conversation | decided | Accepted: extra `locateSubagentFile` (indexed); TurnTreeView passes the open action; avatar "T" with "Task"; read loop repeated rather than changing `conversation-stream-route.ts`; card fields inside a button; focus on "Back" at open |
| 2026-11-26 | test | G5 tests, subagent-conversation | pass | Re-run 489 unit, 29 e2e (batch and dependants) green; only test files, a test helper and `playwright.config.ts` |

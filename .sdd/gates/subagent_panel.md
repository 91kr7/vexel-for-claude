# Gates — subagent_panel

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-27 | analysis | question analyst type | decided | Evolution of `session_activity.md`: the panel does what it asked, the human changes the requirement; that cycle is merged (PR #44) |
| 2026-11-27 | analysis | G1 analysis | pass | 59 lines, `narrow`; request kept; the no-subagent message follows from removing the main steps |
| 2026-11-27 | plan | G2 requirements | pass | REQ-1..7 cover the spec; replaced `plan-session_activity` REQ-29/30/31/42 listed; planner defaults accepted (start = first line, group = one message, order at every level, "No subagents in this turn.") |
| 2026-11-27 | plan | G3 coverage | pass | One batch, 7 INTs on existing paths, acceptance covers REQ-1..7; REQ-6/7 have no INT by decision: already met, kept as regression checks; dropping main steps from the turn route accepted (no frame per main step, `plan-session_activity` REQ-45) |
| 2026-11-27 | dev | G4 development, subagents-only | pass | Source typechecks and builds (scratchpad output, `dist/web` of the running app untouched); `tsc -b` red only in 7 test files whose logic expects steps: left to the tester; stub-only edits in 6 test files; dead step styles removed from `styles.css` |
| 2026-11-27 | test | G5 tests, subagents-only | sent back | Green (unit 5227, browser e2e 1108) but the group rule merges subagents of two messages when only a tool result lies between them, against the REQ-3 assumption "At the same time"; code defect, inside the plan perimeter |
| 2026-11-27 | dev | G4 fix, subagents-only | pass | Groups by the `message.id` of the calls (checked on real transcripts), step rule kept as fallback for lines without id; `tsc -b` green; no test file |
| 2026-11-27 | dev | divergence subagents-only | decided | TurnModel links carry `message`: needed by the REQ-3 fix, no other contract change |

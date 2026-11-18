# Gates — session_list_improvements

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-06 | analysis | question analyst Q1 | decided | Evolution: no earlier analysis asked for these behaviours |
| 2026-11-06 | analysis | question analyst Q2 | decided | Client-only name, hosted and external: `/rename` in the terminal interferes with the session; base NFR forbids writing history |
| 2026-11-06 | analysis | G1 analysis | pass | ordinary, 109/200 lines; three points covered; additions accepted: multi-tool count, 1 s minimum, 200-char limit |
| 2026-11-06 | plan | question planner Q1 | decided | REQ-36: "Resume Here" keeps the name; spec "survives a Resume", same conversation |
| 2026-11-06 | plan | question planner Q2 | decided | REQ-33: field stops at 200 characters after trimming, no error message |
| 2026-11-06 | plan | question planner Q3 | decided | REQ-27: name applies to notifications shown after the rename |
| 2026-11-06 | plan | G2 requirements | pass | REQ-1..39 cover the spec; label places split per REQ (each can fail alone) |
| 2026-11-06 | plan | question planner Q4 | decided | REQ-26: stop confirmation shows the folder, not the label, so it does not change |
| 2026-11-06 | plan | G3 coverage | pass | 3 vertical batches, REQ-1..39 covered, all modify paths exist; one enabling INT (e2e names folder); Resume of an ended session via a new route that removes the old entry |
| 2026-11-06 | dev | G4 dismiss-resume | pass | Build green (re-run); files map to INT-1..10; divergences accepted: `dismiss` returns a boolean, resume of a non-ended session → 409 `not_ended`, no Claude id → 404, `resumable` type in LiveSessionStore, styles; 1 old list-route test expects no `resumable` |
| 2026-11-06 | test | G5 dismiss-resume | pass | Re-run by gatekeeper: 7 files 73/73; tester 226 + 109 unit, 86 e2e; page-frame setup changed to follow REQ-7 (open session leaving the list closes); fixed-order flake 1/3 under 6 workers, passed 5/5 alone |
| 2026-11-06 | dev | G4 running-tool | pass | Build green (re-run); files map to INT-1..8; REQ-24 assumption checked on real transcripts; divergences accepted: raw input via `readItem` for the last open call, `runningTool` type in LiveSessionStore; external tool may lag > 2 s right after the scan turns it working (risk noted) |
| 2026-11-06 | test | G5 running-tool round 1 | sent back | 1 red in `running-tool-monitor.test.ts`: tool kept after the Claude session id changes and no transcript exists yet (`#read` returns before recomputing); RunningToolMonitor spec "Transcript of a session" |
| 2026-11-06 | dev | G4 running-tool fix round 1 | pass | `#read` always recomputes the shown tool; typecheck green |
| 2026-11-06 | test | G5 running-tool round 2 | pass | Re-run by gatekeeper: 5 batch files 51/51; e2e 4/4 and session-entries 11/11 from round 1 untouched by the fix |
| 2026-11-06 | dev | G4 rename | pass | Build green (re-run); files map to INT-1..10; name reaches notifications and tray through the label (checked in code, to be tested); accepted: name moves with a new Claude id, 3 old tests count list buttons and must follow REQ-25, fixed e2e names folder |
| 2026-11-06 | test | G5 rename | pass | Re-run by gatekeeper: 5 batch files 70/70. Closing pass: unit 1458/1458; default e2e 333 + 9 resolved (7 page-frame button counts, feedback-states setup rewritten per REQ-7 (gatekeeper decision a), local-access passed alone: race on the global list) |

## Fix of 2026-11-18: Rename pencil position

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-18 | analysis | type of request | decided | Fix of the rename batch; the human named it a fix and pointed at the rename batch |
| 2026-11-18 | analysis | G1 analysis | pass | Minimal diff on the existing analysis, 118 lines under the ordinary budget; today layout not verified, left to plan and dev |
| 2026-11-18 | plan | question planner Q2 | decided | Name row is the label row (row 2); pencil is on row 1 today (code check by the planner) |
| 2026-11-18 | plan | question planner Q1 | decided | Ended actions return to the top right corner of row 1; source commit f856169 (unmerged, branch feat/card_metrics_spacing) |
| 2026-11-18 | plan | G2 requirements | pass | REQ-40 to REQ-43 trace to the fix lines of the analysis; ended-actions assumption corrected |
| 2026-11-18 | plan | G3 coverage | pass | One batch rename-pencil, REQ-40 to REQ-43 each have an INT, paths exist, no departure |
| 2026-11-18 | dev | G4 development | pass | Diff holds `SessionList.tsx`, `styles.css`, the session-list spec and index; build green re-run by the gatekeeper |
| 2026-11-18 | dev | divergence developer | decided | `RenameSlot` is an internal span of `SessionList.tsx`, like the star slot; no spec of its own |
| 2026-11-18 | test | G5 tests round 1 | sent back | REQ-43 defect: pencil still displayed during the name edit (`hidden` overridden by the global button rule, anchor missing); sent to the developer with a diagnosis |
| 2026-11-18 | dev | G4 development round 2 | pass | Diff of the fix is one rule `.entry-rename[hidden]` in `styles.css`; build green |
| 2026-11-18 | test | G5 tests | pass | Re-run by the gatekeeper after the fix: unit 4352/4352; e2e 965 passed, 2 failed outside the plan (`history-search:417`, `tab-change-transitions:305`); rename-pencil 9/9 |
| 2026-11-18 | test | failure outside perimeter | human decision | `history-search:417` (latency) and `context-occupancy:172` fail on `main` too; the human asked to fix both in separate branches; `tab-change-transitions:305` passed 3 of 3 alone |

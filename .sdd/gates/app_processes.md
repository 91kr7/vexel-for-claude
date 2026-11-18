# Gates — app_processes

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-18 | analysis | request scoping | human decision | Human chose all hanging processes, Terminate with confirmation, via /sdd-auto |
| 2026-11-18 | analysis | question analyst | decided | Evolution of settings_dialog.md, which left new settings out of scope |
| 2026-11-18 | analysis | question analyst | decided | Current instance has Terminate; request asks one on every process, human chose it knowing it closes the app |
| 2026-11-18 | analysis | G1 analysis | pass | 109 lines, ordinary budget 200 |
| 2026-11-18 | plan | question planner | decided | Hanging also covers an app or test server whose launcher is gone; raw request names old and test servers as hanging |
| 2026-11-18 | plan | question planner | decided | "Processes" is a side menu after "Updates"; settings_dialog REQ-53 |
| 2026-11-18 | plan | G2 requirements | pass | |
| 2026-11-18 | plan | question planner | decided | Desktop window quits after terminating the current instance; REQ-26 promises it closes the app |
| 2026-11-18 | plan | question planner | decided | Keep REQ-12, covered by a component test |
| 2026-11-18 | plan | G3 coverage | pass | Desktop quit INT added to terminate-process |
| 2026-11-18 | plan | question planner | decided | Desktop quit skips the tray quit question; the user just confirmed the terminate |
| 2026-11-18 | dev processes-list | divergence developer | decided | main.ts drops AI_CLIENT_LAUNCHER from its own env so sessions do not inherit it; within INT-6 and REQ-19 |
| 2026-11-18 | dev processes-list | G4 development | pass | |
| 2026-11-18 | dev processes-list | G5 tests | decided | settings-layout:155 measured during the popup zoom of a3d61c7; tester waits for settle, test only |
| 2026-11-18 | dev processes-list | G5 tests | escalated | Older main-*.test.ts leave 36 inner test servers running; tester's SIGTERM blocked by permissions |
| 2026-11-18 | dev processes-list | G5 tests | pass | Gatekeeper rerun: 186 unit, 6 e2e; no new leftover process |
| 2026-11-18 | dev terminate-process | divergence developer | decided | WarningDialog accent="error" is the rose tone; no new prop |
| 2026-11-18 | dev terminate-process | divergence developer | decided | Desktop quit tested through WindowActions only; main.ts has no testable export, no refactor for it |
| 2026-11-18 | dev terminate-process | G4 development | pass | Terminate route registered after the local access guard |
| 2026-11-18 | dev terminate-process | G5 tests | sent back | REQ-33: focus lost after a terminate removes the row, Esc no longer closes the popup |

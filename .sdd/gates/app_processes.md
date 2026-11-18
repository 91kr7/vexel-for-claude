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

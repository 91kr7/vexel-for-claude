# Gates — app_processes

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-18 | analysis | request scoping | human decision | Human chose all hanging processes, Terminate with confirmation, via /sdd-auto |
| 2026-11-18 | analysis | question analyst | decided | Evolution of settings_dialog.md, which left new settings out of scope |
| 2026-11-18 | analysis | question analyst | decided | Current instance has Terminate; request asks one on every process, human chose it knowing it closes the app |
| 2026-11-18 | analysis | G1 analysis | pass | 109 lines, ordinary budget 200 |

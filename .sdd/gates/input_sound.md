# Gates — input_sound

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-19 | analysis | question analyst Q1 type | decided | Evolution; `session_notifications.md:115` put sounds out of scope |
| 2026-11-19 | analysis | question analyst Q4 browser | decided | Desktop app only; `session_notifications.md:93` lets only the desktop app notify |
| 2026-11-19 | analysis | question analyst Q3 settings switch | escalated | Not in the request; useful addition |
| 2026-11-19 | analysis | question analyst Q3 settings switch | human decision | On/off switch in Settings, on by default, no sound choice or volume |
| 2026-11-19 | analysis | question analyst Q2 focused window | escalated | Visible behaviour the request does not settle |
| 2026-11-19 | analysis | question analyst Q2 focused window | human decision | Sound plays also when the window has the focus |
| 2026-11-19 | analysis | G1 analysis | pass | 76 lines, narrow; additions trace to the request or the human decisions |
| 2026-11-19 | plan | question planner Q1 re-entry within 5 s | decided | One global 5 s window; source `session_notifications.md:61` |
| 2026-11-19 | plan | question planner Q2 switch turned on late | decided | No sound; source REQ-1, sound on entering "needs input" |
| 2026-11-19 | plan | question planner Q3 place of switch | decided | New "Sound" section after the existing ones; touches least |
| 2026-11-19 | plan | G2 requirements | pass | REQ-1 to REQ-14 plus plan constraints cover every analysis requirement |
| 2026-11-19 | plan | G3 coverage | pass | REQ-1 to REQ-14 covered; batch sound-switch INT-4 modifies the player of needs-input-sound INT-6, no path yet as it does not exist; page-load gap kept as a risk in `batches.md` |
| 2026-11-19 | dev | G4 needs-input-sound | pass | Diff is INT-1 to INT-7 plus specs and indexes; build green re-run by the gatekeeper; chime generated in-house, no third-party notice |

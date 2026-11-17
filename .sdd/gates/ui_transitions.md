# Gates — ui_transitions

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-17 | analysis | request scoping | human decision | Human chose all eight proposed effects and OS reduced-motion only, no UI toggle |
| 2026-11-17 | analysis | G1 analysis | escalated | Theme change variant (dissolve or circle) assumed by the analyst, visible behaviour |
| 2026-11-17 | analysis | G1 analysis | human decision | Theme change uses the colour dissolve |
| 2026-11-17 | analysis | G1 analysis | pass | |
| 2026-11-17 | plan | question planner | decided | Durations 300 ms per effect, 600 ms per cascade; within spec Non-functional |
| 2026-11-17 | plan | question planner | decided | Slide-in/fade-out cover external sessions too; spec requirement 7 has no exclusion |
| 2026-11-17 | plan | question planner | decided | Theme dissolve on any change while open, not on first paint; spec requirement 6 and assumptions |
| 2026-11-17 | plan | G2 requirements | pass | |
| 2026-11-17 | plan | question planner | escalated | Session list panel has no collapse/expand; spec effect 4 rests on a missing control |
| 2026-11-17 | plan | question planner | human decision | Drop the session list panel effect; analysis corrected |
| 2026-11-17 | plan | G3 coverage | escalated | Shared Dialog frame also animates the New session dialog, not named in spec |
| 2026-11-17 | plan | G3 coverage | human decision | Every modal dialog animates, New session included; analysis corrected |
| 2026-11-17 | plan | G3 coverage | decided | Removed untracked batch-session-list-panel.md created in this cycle, planner has no delete tool |
| 2026-11-17 | plan | G3 coverage | pass | Wording "eight effects" in batches.md sent for fix with the validation |
| 2026-11-17 | dev modal-dialogs | G4 development | pass | |
| 2026-11-17 | dev modal-dialogs | G5 tests | pass | Intermittent session-action-shortcuts-resume:165 noted, recheck in final full run |
| 2026-11-17 | dev popovers | divergence developer | decided | Own buttons inert while leaving, same contract as leaving Dialog; no REQ changed |
| 2026-11-17 | dev popovers | G4 development | pass | |
| 2026-11-17 | dev popovers | G5 tests | pass | |
| 2026-11-17 | dev git-explorer-panel | divergence developer | decided | Close during open slide starts from open position, as dialogs; final state per REQ-28 |
| 2026-11-17 | dev git-explorer-panel | divergence developer | decided | Reopen during close mounts a fresh panel; today close already unmounts, no behaviour change |
| 2026-11-17 | dev git-explorer-panel | G4 development | pass | overflow hidden on conversation workspace explained by INT slide |

# Gates — popup_glass

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-20 | analyse | input | human decision | Image missing; popup = session termination confirmation, 60% = opacity, scope = all floating surfaces |
| 2026-11-20 | analyse | G1 analysis | pass | narrow, 68/80 lines; Processes "Terminate" confirm kept as same-kind termination popup |
| 2026-11-20 | plan | question planner | decided | Q1: REQ-1 (60%) wins over readability; source analysis Request section |
| 2026-11-20 | plan | question planner | decided | Q2: REQ-9 judged by a human acceptance scenario on Settings in the desktop app |
| 2026-11-20 | plan | G2 requirements | sent back | REQ-6 not yes/no verifiable |
| 2026-11-20 | plan | G2 requirements | pass | REQ-6 rewritten yes/no |
| 2026-11-20 | plan | G3 coverage | pass | 2 batches, all modify paths exist; "N new messages" button kept out as a button, not a popup |
| 2026-11-20 | dev | G4 glass-popups | pass | Build green; SettingsButton.tsx justified by INT-7; backdrop fades its colour, not opacity (blur visible during open); vx-surface-2 kept for the border |
| 2026-11-20 | dev | G5 glass-popups | escalated | Light theme popup text under 4.5:1 conflicts with plan-light_theme/REQ-14 |
| 2026-11-20 | dev | G5 glass-popups | human decision | 60% wins; REQ-14 superseded inside popups; light-theme.spec.ts:742 adapted |
| 2026-11-20 | dev | G5 glass-popups | pass | Batch e2e and unit re-run green (40 e2e, 52 unit) |

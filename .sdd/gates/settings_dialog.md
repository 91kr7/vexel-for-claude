# Gates — settings_dialog

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-16 | analysis | question analyst (fix or evolution) | decided | Evolution: the request adds what `keyboard_shortcuts.md` and `light_theme.md` left out of scope |
| 2026-11-16 | analysis | question analyst (top bar controls) | human decision | Theme, look and shortcuts button move from the top bar into the popup only |
| 2026-11-16 | analysis | question analyst (key rules, restore) | human decision | Today's rules, reject with message; restore per row and restore all; all client shortcuts editable |
| 2026-11-16 | analysis | G1 analysis | pass | 122 lines, class ordinary |
| 2026-11-16 | plan | G2 requirements | pass | REQ-1..42 cover the spec, no addition |
| 2026-11-16 | plan | question planner (restore default in conflict) | decided | Reject with message; source spec human decision on conflicts |
| 2026-11-16 | plan | question planner (rows with two keys, digits 1-9) | decided | One combination replaces all keys; nine rows; touches less |
| 2026-11-16 | plan | question planner (tooltip, reserved key message) | decided | "Settings (Alt+S)"; message names the owner, spec lists keys only |
| 2026-11-16 | plan | question planner (row per action) | decided | Rows with several actions split to one per action; follows from the two-keys and digits decisions, no REQ changed |
| 2026-11-16 | plan | G3 coverage | pass | 3 batches, all REQ covered, modify paths exist, acceptance covers every closed REQ |
| 2026-11-16 | dev | G4 settings-popup | pass | Build green; deleted `ThemeSwitch.test.tsx`/`LookSwitch.test.tsx` justified by INT-8/INT-9; stale e2e specs left to the tester |
| 2026-11-16 | dev | settings button placement | human decision | Button moves to the bottom of the navigation rail; analysis corrected, tester stopped, its partial work stashed |
| 2026-11-16 | plan | G3 coverage (rail placement) | pass | REQ-1/REQ-2 rewritten, INT-6 rewritten, INT-10/INT-11 added to settings-popup |
| 2026-11-16 | dev | G4 settings-popup (rail) | pass | Build green; diff limited to INT-6/10/11 files, specs and index |

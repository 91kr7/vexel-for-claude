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
| 2026-11-16 | dev | G5 settings-popup | pass | 58 unit + 79 e2e re-run green; light-theme "theme change keeps the new-session dialog open" deleted, unreachable after REQ-16/REQ-19 |
| 2026-11-16 | dev | question tester (Electron tests) | decided | 4 changed tests of `e2e/desktop-window.spec.ts` run at the plan's closing run |
| 2026-11-16 | analysis | G1 analysis (updates section) | pass | Human decisions on the Updates section; 138 lines |
| 2026-11-16 | plan | G2 requirements (updates) | pass | REQ-43..52 cover the Updates block of the spec |
| 2026-11-16 | plan | question planner (updates texts, notice, result) | decided | Title Case "Check for Updates" as the other buttons; notice shown after a newer result; result reset on reopening |
| 2026-11-16 | plan | G3 coverage (update-check) | pass | New batch depends on shortcuts-section; modify paths exist; acceptance covers REQ-43..52 |
| 2026-11-16 | dev | G4 shortcuts-section | pass | Build green; ShortcutsPanel moved to `settings/ShortcutsSection.tsx` (rename, no visible change) accepted; deleted tests of removed components justified by INT-1/INT-7 |
| 2026-11-16 | dev | G5 shortcuts-section | pass | 149 unit + 51 e2e re-run green; tests only in the diff |
| 2026-11-16 | dev | G4 editable-shortcuts | pass | Build green; INT-6..10 applied to `settings/ShortcutsSection.tsx` |
| 2026-11-16 | dev | divergence developer (tooltips, AltGr) | decided | Tooltip lists every key of its row (REQ-38); AltGr press rejected as "no Ctrl or Alt" since it can never match |
| 2026-11-16 | dev | G5 editable-shortcuts round 1 | sent back | ReservedKeys gave "Claude Code" for Meta+Ctrl/Alt presses (REQ-29); e2e denied to the tester, human chose to re-delegate |
| 2026-11-16 | dev | G4 editable-shortcuts fix | pass | Only `reserved-keys.ts` and its spec changed; build green |
| 2026-11-16 | dev | G5 editable-shortcuts round 2 | pass | 519 unit + 16 batch e2e re-run green; tester ran 73 e2e |
| 2026-11-16 | dev | G4 update-check | pass | Build green; `newer-version-loader.ts` change (shared body parsing for INT-5) accepted, no behaviour change |
| 2026-11-16 | dev | G5 update-check | pass | 225 unit + 6 batch e2e re-run green; closing run: 3859 unit, 762/764 e2e, 26 Electron |
| 2026-11-16 | dev | closing run failures | escalated | `plan-usage.spec.ts` wheel scroll fails on `main` too; `project-search.spec.ts:117` fails only under load, passes alone on branch and on `main` |
| 2026-11-16 | dev | closing run failures | human decision | Merge anyway; plan-usage failure is older than this cycle |

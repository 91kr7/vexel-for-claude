# Gates — dark_blue_theme

| Date | Phase | Gate | Verdict | Reason |
|------|-------|------|---------|--------|
| 2026-11-16 | analysis | question analyst Q1 | decided | Evolution: adds a theme and restyles on purpose; source request text |
| 2026-11-16 | analysis | question analyst Q2-Q4, Q6 | human decision | Layout for all themes, mock colours only Dark Blue; restyle only, no new functions; fonts unchanged; window buttons unchanged |
| 2026-11-16 | analysis | question analyst Q5 | decided | Label "Dark Blue", Dark stays default, shortcut cycles three themes; least change |
| 2026-11-16 | analysis | question analyst Q7 | decided | Dark Blue terminal frame from mock, ANSI unchanged, Light keeps dark terminal; source `.sdd/analysis/light_theme.md` |
| 2026-11-16 | analysis | mock copy | decided | Mock copied to `.sdd/mockups/dark_blue_theme/mock.html` so it lives in the repository |
| 2026-11-16 | analysis | G1 analysis | pass | 126 lines, ordinary budget; no placeholders; scope matches human decisions |
| 2026-11-16 | plan | G2 requirements | pass | REQ-1..42 cover the analysis; REQ-8, REQ-29, REQ-31 traced to analysis risk and `light_theme.md` |
| 2026-11-16 | plan | question planner Q1 | escalated | Analysis says Dark default, code starts in Light (`src/web/theme/theme-store.ts` START_THEME) |
| 2026-11-16 | plan | first-start theme | human decision | Dark Blue becomes the first-start theme; departure from the analysis, REQ-35 rewritten |
| 2026-11-16 | plan | question planner Q2 | decided | Windows 11 dark colours only for Dark; Dark Blue keeps mock colours; Windows 11 keeps its corners |
| 2026-11-16 | plan | question planner Q3 | decided | Toast stacks above the needs-input snackbar |
| 2026-11-16 | plan | question planner Q4 | decided | Card line 2 and header pill keep client text; source analysis assumptions |
| 2026-11-16 | plan | theme persistence | human decision | Active theme saved for every theme and kept at next start; REQ-32 widened to Light, Dark, Dark Blue |
| 2026-11-16 | plan | G3 coverage | pass | 42 REQ / 5 batches; cited paths exist; no cycles; acceptance sections present; REQ-32 change sent with validation |
| 2026-11-16 | dev shared-shapes | G4 development | pass | Build green; diff limited to tokens.css, windows11.css, styles.css, specs and index |
| 2026-11-16 | dev shared-shapes | divergence developer | decided | INT-6..10 done in styles.css, no TSX change; role tokens alias level tokens so Windows 11 needs no duplicate mapping |
| 2026-11-16 | dev shared-shapes | G5 tests | sent back | Red: REQ-4 focus rings cut in Settings > Shortcuts (pane body, list bottom); banner radius spec mismatch |
| 2026-11-16 | dev shared-shapes | question tester | decided | Warning banner takes the 7px card radius (REQ-3); developer aligns `warning-dialog.md`, tester aligns the two tests |
| 2026-11-16 | dev shared-shapes | G4 development (fix) | pass | CSS-only ring fixes in styles.css; warning-dialog and settings-dialog specs aligned; build green |
| 2026-11-16 | dev shared-shapes | G5 tests (round 2) | pass | Test files only; no only/skip; re-run shared-shapes + settings-popup: 30 passed |

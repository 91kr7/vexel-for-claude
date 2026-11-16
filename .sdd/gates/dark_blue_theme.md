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
| 2026-11-16 | dev window-frame | G4 development | pass | Web + desktop build green; diff limited to INT files, windows11.css, specs and indexes |
| 2026-11-16 | dev window-frame | divergence developer | decided | Popover and update notice follow the 38px bar; Windows buttons on role chrome to keep their spec |
| 2026-11-16 | dev window-frame | divergence developer | decided | Footer path in a pill per REQ-12 wording though the mock shows plain text; flagged for human review |
| 2026-11-16 | dev window-frame | G5 tests | sent back | Red: REQ-11 active bar 22px instead of 24px (offset measured inside the button border) |
| 2026-11-16 | dev window-frame | G4 development (fix) | pass | One CSS rule for the rail bar offsets; build green |
| 2026-11-16 | dev window-frame | G5 re-run | sent back | window-frame green; `e2e/studio-dark.spec.ts:698` still asserts the old 40px footer (REQ-12 says 32px): to the tester |
| 2026-11-16 | dev window-frame | question tester | decided | Header action button radius is `--radius-pill` per `.sdd/modules/app/specs/web-entry.md`; stale assertion aligned |
| 2026-11-16 | dev window-frame | G5 tests (round 3) | pass | Test files only; no only/skip; re-run window-frame, studio-dark, hosted-session, open-session, header-footer: 69 passed |
| 2026-11-16 | dev session-cards | G4 development | pass | Build green; diff limited to INT files, windows11.css, specs and indexes |
| 2026-11-16 | dev session-cards | divergence developer | decided | Open needs-input card keeps its amber border (INT-3) with accent bar, surface and shadow; flagged for human review |
| 2026-11-16 | dev session-cards | external card border | human decision | No dashed border on external session cards; solid card border |
| 2026-11-16 | dev session-cards | list alignment | human decision | Every list of the client takes the session-card look; mock covers only the first page, the rest is extrapolated |
| 2026-11-16 | plan | G3 coverage (amendment) | pass | REQ-43 in session-cards INT-9; REQ-44..48 in new batch list-cards; paths exist; no cycles |
| 2026-11-16 | dev session-cards | G5 tests | sent back | Red: card line gaps (button gap), needs-input open bar 2.5px (REQ-19), Plan Usage focus ring cut (REQ-4) |
| 2026-11-16 | dev session-cards | question tester Q1 | decided | Open needs-input card shows the full 3.5px accent bar inside its amber border; source REQ-19 |
| 2026-11-16 | dev session-cards | question tester Q2 | decided | Open card time turns secondary like the label: spec aligned to the existing behaviour, least change |
| 2026-11-16 | dev session-cards | question tester Q3 | decided | Top bar colour asserts in light-theme and windows-look are stale (top-bar spec `--role-chrome`): tester; Plan Usage ring is a defect: developer |
| 2026-11-16 | dev session-cards | G4 development (fix) | pass | CSS fixes and INT-9 in styles.css; session-list and plan-usage-button specs; build green |
| 2026-11-16 | dev session-cards | G5 tests (round 2) | sent back | Batch contracts green; regression `e2e/open-session-external.spec.ts:111`: user box and tool card share surface 2 since shared-shapes INT-10 |
| 2026-11-16 | dev session-cards | regression ConversationView | decided | Tool card back to the surface-1 level to keep three looks (studio_dark REQ-37, REQ-39) |
| 2026-11-16 | dev session-cards | G4 development (fix) | pass | Tool card on `--role-chrome`; conversation-view spec; build green |
| 2026-11-16 | dev session-cards | G5 tests (round 3) | pass | Re-run open-session-external, session-cards, external-session, shared-shapes, studio-dark: 75 passed |
| 2026-11-16 | dev session-view | G4 development | pass | CSS only plus sessions specs and index; build green |
| 2026-11-16 | dev session-view | divergence developer | decided | Frame inner padding stays 12px (terminal rows); no darker focus shadow; stale 40px footer line in session-view spec fixed |
| 2026-11-16 | dev session-view | G5 tests | sent back | Red: frame shadow paints 8px over the git explorer (session-view spec, REQ-26) |
| 2026-11-16 | dev session-view | G4 development (fix) | pass | Git explorer panel stacks above the frame; build green |
| 2026-11-16 | dev session-view | G5 tests (round 2) | pass | Re-run session-view, git-explorer, terminal-panel, hosted-session: 77 passed |
| 2026-11-16 | dev list-cards | G4 development | pass | Build green; diff limited to INT files, windows11.css, specs and indexes; ListStyles spec and index row present |
| 2026-11-16 | dev list-cards | divergence developer | decided | ListStyles shared CSS group documented as a component; windows11.css keeps 4px list corners; commit rows show no selected style (list hidden while a commit is open) |
| 2026-11-16 | dev list-cards | G5 tests | pass | Test files only; no only/skip; re-run list-cards, shared-shapes, board-dialogs: 43 passed |
| 2026-11-16 | dev dark-blue | G4 development | pass | Web + desktop build green; diff limited to INT files, Icons.tsx, specs and indexes |
| 2026-11-16 | dev dark-blue | divergence developer | decided | New tokens for terminal frame, scrollbar and fields; MoonStarIcon for the Dark Blue card; three-card grid; muted text lightened to #808fa4 for 4.5:1 (REQ-41) |
| 2026-11-16 | dev dark-blue | scrollbar gap | human decision | In every list the scrollbar keeps a gap from the cards |
| 2026-11-16 | dev dark-blue | card metrics | human decision | Session card line 3 (context and cost) smaller and left aligned |
| 2026-11-16 | dev dark-blue | last batch | decided | New batch list-polish after dark-blue; dark-blue tester told to skip the full suites |
| 2026-11-16 | plan | card metrics position | human decision | Percentage and cost smaller, same position; REQ-51 dropped |
| 2026-11-16 | plan | question planner | decided | Last activity time keeps its size; request names only context and cost |
| 2026-11-16 | plan | G3 coverage (list-polish) | pass | REQ-49, REQ-50 in batch list-polish; REQ-51 withdrawn; last batch moves to list-polish |
| 2026-11-16 | plan | state label | human decision | Session state name moves from the right of line 1 to the left, next to the name |
| 2026-11-16 | plan | state label order | decided | Dot, name, star, state name; name truncates first; Rename keeps its corner |
| 2026-11-16 | plan | G3 coverage (REQ-52) | pass | REQ-52 → list-polish INT-6; batch still last |
| 2026-11-16 | plan | state label (correction) | human decision | The move is in the session header, not the cards: state pill goes left, after the session name |
| 2026-11-16 | plan | header order | decided | Name, state pill, line pill; line pill truncates first; actions stay right |
| 2026-11-16 | plan | G3 coverage (REQ-52 corrected) | pass | INT-6 on SessionHeader.tsx; cards unchanged; feature name left as is |
| 2026-11-16 | plan | card divider | human decision | No horizontal divider above the metrics line of session cards; refines REQ-21 |
| 2026-11-16 | plan | G3 coverage (REQ-53) | pass | REQ-53 → list-polish INT-7 |
| 2026-11-16 | dev dark-blue | G5 tests (partial) | human decision | Tests stopped to implement list-polish first; one combined test round for dark-blue and list-polish |
